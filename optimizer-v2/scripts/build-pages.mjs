import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync(
  'npm',
  ['run', 'build', '--workspace', '@sbo/optimizer-client'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, GITHUB_ACTIONS: 'true' },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
