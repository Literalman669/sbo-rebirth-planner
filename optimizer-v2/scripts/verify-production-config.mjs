import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const expected = {
  database: 'sbo-rebirth-optimizer-v2',
  server: 'maincloud',
  cliVersion: '2.8.3',
  clientUri: 'https://maincloud.spacetimedb.com',
  issuer: 'https://auth.spacetimedb.com/oidc',
};

export function validateStaticProductionConfig({
  config,
  cliVersionOutput,
  clientId,
  clientUri,
  clientDatabase,
}) {
  const errors = [];
  if (config?.database !== expected.database) {
    errors.push(`Production database must be ${expected.database}`);
  }
  if (config?.server !== expected.server) {
    errors.push(`Production server must be ${expected.server}`);
  }
  if (!cliVersionOutput.includes(`tool version ${expected.cliVersion}`)) {
    errors.push(`SpacetimeDB CLI must be ${expected.cliVersion}`);
  }
  if (!/^client_[A-Za-z0-9]+$/.test(clientId ?? '')) {
    errors.push('SPACETIMEAUTH_CLIENT_ID must begin with client_');
  }
  if (clientUri !== expected.clientUri) {
    errors.push(`VITE_SPACETIME_URI must be ${expected.clientUri}`);
  }
  if (clientDatabase !== expected.database) {
    errors.push(`VITE_SPACETIME_DATABASE must be ${expected.database}`);
  }
  return errors;
}

export function assertProductionAuthOutput(output, clientId) {
  if (
    !output.includes('production') ||
    !output.includes(expected.issuer) ||
    !output.includes(clientId)
  ) {
    throw new Error('Maincloud does not have the required production auth configuration');
  }
}

async function main() {
  const config = JSON.parse(
    await readFile(new URL('../spacetime.production.json', import.meta.url), 'utf8'),
  );
  const cliVersionOutput = execFileSync('spacetime', ['--version'], {
    encoding: 'utf8',
  });
  const clientId = process.env.SPACETIMEAUTH_CLIENT_ID ?? '';
  const errors = validateStaticProductionConfig({
    config,
    cliVersionOutput,
    clientId,
    clientUri: process.env.VITE_SPACETIME_URI,
    clientDatabase: process.env.VITE_SPACETIME_DATABASE,
  });
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const coverage = spawnSync(
    process.execPath,
    ['scripts/validate-release-coverage.mjs', 'client/src/data/fallback-release.json'],
    { encoding: 'utf8' },
  );
  if (coverage.status !== 0) {
    throw new Error(`Fallback coverage failed:\n${coverage.stderr}`);
  }
  const authOutput = execFileSync(
    'spacetime',
    [
      'sql',
      '--no-config',
      expected.database,
      "SELECT mode, issuer, audience FROM auth_config WHERE key = 'primary'",
      '--server',
      expected.server,
      '--format',
      'json',
      '--yes',
    ],
    { encoding: 'utf8' },
  );
  assertProductionAuthOutput(authOutput, clientId);
  process.stdout.write('Production configuration verified.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
