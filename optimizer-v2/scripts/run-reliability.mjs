import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const reliabilityUri = 'http://127.0.0.1:3000';
const reliabilityDatabase = 'sbo-rebirth-optimizer-v2-test';
const root = new URL('../', import.meta.url);
const spacetimeModule = new URL('../spacetimedb/', import.meta.url);

export function assertFixedReliabilityTarget(uri, database) {
  if (uri !== reliabilityUri || database !== reliabilityDatabase) {
    throw new Error(
      'Reliability mutation is restricted to the fixed local test database',
    );
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

export function runReliability() {
  assertFixedReliabilityTarget(reliabilityUri, reliabilityDatabase);

  run('npm', ['run', 'test:unit'], root);
  run('npm', ['run', 'typecheck'], root);
  run('npm', ['run', 'validate:coverage'], root);
  run('spacetime', ['build'], spacetimeModule);
  run('npm', ['run', 'test:integration'], root);
  run('npm', ['run', 'test:pages'], root);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runReliability();
}
