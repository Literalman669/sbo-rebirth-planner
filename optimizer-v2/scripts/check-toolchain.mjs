import { execFileSync } from 'node:child_process';

const nodeVersion = process.versions.node;
if (!nodeVersion.startsWith('22.')) {
  throw new Error(`Node 22.x required; found ${nodeVersion}`);
}

const spacetimeVersion = execFileSync('spacetime', ['--version'], {
  encoding: 'utf8',
});

if (!spacetimeVersion.includes('spacetimedb tool version 2.8.3;')) {
  throw new Error(`SpacetimeDB 2.8.3 required; found:\n${spacetimeVersion}`);
}

console.log(`Toolchain OK: Node ${nodeVersion}, SpacetimeDB 2.8.3`);
