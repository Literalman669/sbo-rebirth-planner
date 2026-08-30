import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { playwrightArgumentsFor, runIntegrationPhases } from './integration-phase-plan.mjs';
import { terminateOwnedProcessGroup } from './owned-process-group.mjs';

const uri = 'http://127.0.0.1:3000';
const database = 'sbo-rebirth-optimizer-v2-test';
const host = '127.0.0.1';
const browserPort = 4173;
const serverPort = 3000;
const root = new URL('../', import.meta.url);
const temporaryPrefix = path.join(tmpdir(), 'sbo-optimizer-v2-stdb-');
const spacetimeExecutable = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA ?? '', 'SpacetimeDB', 'bin', 'current', 'spacetimedb-cli.exe')
  : 'spacetime';

export function assertFixedIntegrationTarget(targetUri, targetDatabase) {
  if (targetUri !== uri || targetDatabase !== database) {
    throw new Error('Refusing integration publish outside the fixed local test database');
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function assertPortAvailable(port, message) {
  const reservation = createServer();
  try {
    await new Promise((resolve, reject) => {
      reservation.once('error', reject);
      reservation.listen(port, host, resolve);
    });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EADDRINUSE') throw new Error(message);
    throw error;
  } finally {
    if (reservation.listening) {
      await new Promise((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())));
    }
  }
}

const assertBrowserPortAvailable = () => assertPortAvailable(
  browserPort,
  `Refusing to reuse an existing browser server at http://${host}:${browserPort}`,
);
const assertServerPortAvailable = () => assertPortAvailable(
  serverPort,
  `Refusing to reuse an existing service at ${uri}`,
);

async function isHealthy() {
  try {
    return (await fetch(`${uri}/v1/ping`)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(server) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`SpacetimeDB exited before becoming ready (${server.exitCode})`);
    if (await isHealthy()) return;
    await wait(100);
  }
  throw new Error('Timed out waiting for local SpacetimeDB');
}

async function waitForOwnedServerExit(server, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (server.exitCode === null && Date.now() < deadline) await wait(100);
  if (server.exitCode === null) throw new Error('Owned local SpacetimeDB did not exit');
}

async function waitForServerPortRelease() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await assertServerPortAvailable();
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== `Refusing to reuse an existing service at ${uri}`) throw error;
    }
    await wait(100);
  }
  throw new Error('Owned local SpacetimeDB did not release port 3000');
}

async function createCredential(label) {
  const response = await fetch(`${uri}/v1/identity`, { method: 'POST' });
  if (!response.ok) throw new Error(`Failed to create the isolated ${label} identity (${response.status})`);
  const credential = await response.json();
  if (typeof credential !== 'object' || credential === null || typeof credential.token !== 'string' || credential.token.length === 0) {
    throw new Error(`The local server returned an invalid ${label} credential`);
  }
  return credential;
}

async function configurePhaseDatabase(cliConfigPath) {
  const owner = await createCredential('publisher');
  const user = await createCredential('browser test');
  execFileSync(spacetimeExecutable, ['--config-path', cliConfigPath, 'login', '--token', owner.token], { cwd: root, stdio: 'ignore' });
  execFileSync(spacetimeExecutable, [
    '--config-path', cliConfigPath, 'publish', database, '--server', 'local', '--module-path', './spacetimedb', '--yes=all',
  ], { cwd: root, stdio: 'inherit' });
  const response = await fetch(`${uri}/v1/database/${database}/call/configure_auth`, {
    method: 'POST',
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(['development', '', '']),
  });
  if (!response.ok) throw new Error(`Failed to configure local development auth (${response.status})`);
  return { ownerToken: owner.token, userToken: user.token };
}

async function startPhaseServer() {
  await assertBrowserPortAvailable();
  await assertServerPortAvailable();
  const serverDataDir = mkdtempSync(temporaryPrefix);
  const server = spawn(spacetimeExecutable, [
    'start', '--listen-addr', '127.0.0.1:3000', '--in-memory', '--data-dir', serverDataDir, '--non-interactive',
  ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return { server, serverDataDir, cliConfigPath: path.join(serverDataDir, 'integration-cli.toml') };
}

async function stopPhaseServer({ server, serverDataDir }) {
  try {
    if (server.exitCode === null) {
      if (process.platform === 'win32' && server.pid) {
        spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        await terminateOwnedProcessGroup({
          pid: server.pid,
          signal: process.kill,
          waitForExit: () => waitForOwnedServerExit(server, 3_000).then(() => true).catch(() => false),
        });
      }
    }
    await waitForOwnedServerExit(server);
    await waitForServerPortRelease();
  } finally {
    if (serverDataDir.startsWith(temporaryPrefix)) rmSync(serverDataDir, { recursive: true, force: true });
  }
}

async function runPhase(phase) {
  console.log(`[integration] phase ${phase.id}: starting`);
  const lifecycle = await startPhaseServer();
  try {
    await waitForServer(lifecycle.server);
    const credentials = await configurePhaseDatabase(lifecycle.cliConfigPath);
    const result = spawnSync('npm', playwrightArgumentsFor(phase), {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, SBO_TEST_OWNER_TOKEN: credentials.ownerToken, SBO_TEST_USER_TOKEN: credentials.userToken },
    });
    if (result.error) throw result.error;
    const exitCode = result.status ?? 1;
    console.log(`[integration] phase ${phase.id}: ${exitCode === 0 ? 'passed' : 'failed'}`);
    return exitCode;
  } finally {
    await stopPhaseServer(lifecycle);
  }
}

export async function runLocalIntegration({ runPhase: phaseRunner = runPhase } = {}) {
  assertFixedIntegrationTarget(uri, database);
  await runIntegrationPhases(phaseRunner);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runLocalIntegration();
}
