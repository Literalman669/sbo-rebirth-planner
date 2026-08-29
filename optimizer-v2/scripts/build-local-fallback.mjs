import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const uri = 'http://127.0.0.1:3000';
const database = 'sbo-rebirth-optimizer-v2-seed';
const root = new URL('../', import.meta.url);
const temporaryPrefix = path.join(tmpdir(), 'sbo-optimizer-v2-seed-');
const dataDir = mkdtempSync(temporaryPrefix);
const spacetime =
  process.platform === 'win32'
    ? path.join(
        process.env.LOCALAPPDATA ?? '',
        'SpacetimeDB',
        'bin',
        'current',
        'spacetimedb-cli.exe',
      )
    : 'spacetime';
const cliConfig = path.join(dataDir, 'seed-cli.toml');

async function healthy() {
  try {
    return (await fetch(`${uri}/v1/ping`)).ok;
  } catch {
    return false;
  }
}

if (await healthy()) throw new Error(`Refusing to reuse an existing service at ${uri}`);
const server = spawn(
  spacetime,
  [
    'start',
    '--listen-addr',
    '127.0.0.1:3000',
    '--in-memory',
    '--data-dir',
    dataDir,
    '--non-interactive',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
server.stdout.on('data', (chunk) => process.stdout.write(chunk));
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  const deadline = Date.now() + 15_000;
  while (!(await healthy())) {
    if (server.exitCode !== null) throw new Error('SpacetimeDB exited early');
    if (Date.now() > deadline) throw new Error('Timed out waiting for SpacetimeDB');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const identityResponse = await fetch(`${uri}/v1/identity`, { method: 'POST' });
  if (!identityResponse.ok) throw new Error('Failed to create seed owner identity');
  const owner = await identityResponse.json();
  execFileSync(spacetime, ['--config-path', cliConfig, 'login', '--token', owner.token], {
    cwd: root,
    stdio: 'ignore',
  });
  execFileSync(
    spacetime,
    [
      '--config-path',
      cliConfig,
      'publish',
      database,
      '--server',
      'local',
      '--module-path',
      './spacetimedb',
      '--yes=all',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  const sharedEnv = {
    ...process.env,
    SBO_SPACETIME_URI: uri,
    SBO_SPACETIME_DATABASE: database,
    SBO_OWNER_TOKEN: owner.token,
  };
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-first-release.mjs'], {
    cwd: root,
    env: sharedEnv,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/export-fallback-release.mjs'], {
    cwd: root,
    env: sharedEnv,
    stdio: 'inherit',
  });
  execFileSync(
    process.execPath,
    ['scripts/validate-release-coverage.mjs', 'client/src/data/fallback-release.json'],
    { cwd: root, stdio: 'inherit' },
  );
} finally {
  if (process.platform === 'win32' && server.pid) {
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    server.kill('SIGTERM');
  }
  if (dataDir.startsWith(temporaryPrefix)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}
