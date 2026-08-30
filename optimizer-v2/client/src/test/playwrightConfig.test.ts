import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { expect, test } from 'vitest';
import integrationConfig from '../../playwright.config';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const optimizerRoot = path.resolve(clientRoot, '..');
const appPort = 4173;

function integrationWebServer() {
  const webServer = integrationConfig.webServer;
  if (!webServer || Array.isArray(webServer)) {
    throw new Error('Integration Playwright config must define one web server');
  }
  return webServer;
}

function runFixedLocalIntegration() {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/run-local-integration.mjs'],
      {
        cwd: optimizerRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, output }));
  });
}

test('integration Playwright config owns a fixed local test server', () => {
  const webServer = integrationWebServer();

  expect(integrationConfig.use?.baseURL).toBe('http://127.0.0.1:4173');
  expect(webServer.command).toBe(
    'npm run dev -- --host 127.0.0.1 --port 4173',
  );
  expect(webServer.url).toBe('http://127.0.0.1:4173');
  expect(webServer.reuseExistingServer).toBe(false);
  expect(webServer.env).toMatchObject({
    VITE_SPACETIME_URI: 'http://127.0.0.1:3000',
    VITE_SPACETIME_DATABASE: 'sbo-rebirth-optimizer-v2-test',
    VITE_TEST_AUTH_TOKEN: process.env.SBO_TEST_USER_TOKEN ?? '',
  });
});

test('fixed-local integration rejects an occupied app port without using its owner', async () => {
  let browserRequests = 0;
  let databaseRequests = 0;
  const occupiedServer = createServer((request, response) => {
    browserRequests += 1;
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end(`unexpected request to ${request.url}`);
  });
  const databaseServer = createServer((request, response) => {
    databaseRequests += 1;
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end(`unexpected request to ${request.url}`);
  });

  databaseServer.listen(3000, '127.0.0.1');
  await once(databaseServer, 'listening');
  occupiedServer.listen(appPort, '127.0.0.1');
  await once(occupiedServer, 'listening');

  try {
    const result = await runFixedLocalIntegration();

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(
      /Refusing to reuse an existing browser server at http:\/\/127\.0\.0\.1:4173/,
    );
    expect(browserRequests).toBe(0);
    expect(databaseRequests).toBe(0);
    expect(occupiedServer.listening).toBe(true);
  } finally {
    occupiedServer.close();
    await once(occupiedServer, 'close');
    databaseServer.close();
    await once(databaseServer, 'close');
  }
});
