import {
  execFileSync,
  spawn,
  spawnSync,
} from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const uri = 'http://127.0.0.1:3000';
const database = 'sbo-rebirth-optimizer-v2-test';

if (uri !== 'http://127.0.0.1:3000' || database !== 'sbo-rebirth-optimizer-v2-test') {
  throw new Error(
    'Refusing integration publish outside the fixed local test database',
  );
}

const root = new URL('../', import.meta.url);
const temporaryPrefix = path.join(tmpdir(), 'sbo-optimizer-v2-stdb-');
const serverDataDir = mkdtempSync(temporaryPrefix);
const spacetimeServerExecutable =
  process.platform === 'win32'
    ? path.join(
        process.env.LOCALAPPDATA ?? '',
        'SpacetimeDB',
        'bin',
        'current',
        'spacetimedb-cli.exe',
      )
    : 'spacetime';
const spacetimeCliExecutable = spacetimeServerExecutable;
const isolatedCliConfigPath = path.join(serverDataDir, 'integration-cli.toml');

async function isHealthy() {
  try {
    const response = await fetch(`${uri}/v1/ping`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(serverProcess) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`SpacetimeDB exited before becoming ready (${serverProcess.exitCode})`);
    }
    if (await isHealthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for local SpacetimeDB');
}

if (await isHealthy()) {
  throw new Error(`Refusing to reuse an existing service at ${uri}`);
}

const server = spawn(
  spacetimeServerExecutable,
  [
    'start',
    '--listen-addr',
    '127.0.0.1:3000',
    '--in-memory',
    '--data-dir',
    serverDataDir,
    '--non-interactive',
  ],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

server.stdout.on('data', (chunk) => process.stdout.write(chunk));
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(server);

  const identityResponse = await fetch(`${uri}/v1/identity`, { method: 'POST' });
  if (!identityResponse.ok) {
    throw new Error(`Failed to create the isolated publisher identity (${identityResponse.status})`);
  }
  const ownerCredential = await identityResponse.json();
  if (
    typeof ownerCredential !== 'object' ||
    ownerCredential === null ||
    typeof ownerCredential.token !== 'string' ||
    ownerCredential.token.length === 0
  ) {
    throw new Error('The local server returned an invalid publisher credential');
  }

  execFileSync(
    spacetimeCliExecutable,
    [
      '--config-path',
      isolatedCliConfigPath,
      'login',
      '--token',
      ownerCredential.token,
    ],
    { cwd: root, stdio: 'ignore' },
  );

  execFileSync(
    spacetimeCliExecutable,
    [
      '--config-path',
      isolatedCliConfigPath,
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

  const result = spawnSync(
    'npm',
    ['run', 'test:e2e', '--workspace', '@sbo/optimizer-client'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        SBO_TEST_OWNER_TOKEN: ownerCredential.token,
      },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  if (process.platform === 'win32' && server.pid) {
    spawnSync(
      'taskkill',
      ['/PID', String(server.pid), '/T', '/F'],
      { stdio: 'ignore' },
    );
  } else {
    server.kill('SIGTERM');
  }
  if (serverDataDir.startsWith(temporaryPrefix)) {
    rmSync(serverDataDir, { recursive: true, force: true });
  }
}
