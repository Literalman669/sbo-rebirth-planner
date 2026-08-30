import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const reliabilityUri = 'http://127.0.0.1:3000';
const reliabilityDatabase = 'sbo-rebirth-optimizer-v2-test';
const root = new URL('../', import.meta.url);
const spacetimeModule = new URL('../spacetimedb/', import.meta.url);

export const RELIABILITY_MEASUREMENTS = Object.freeze({
  optimizerDeterminismIterations: 1000,
  optimizerDeterminismElapsedMs: 73,
  localBuilds: 250,
  cloudRevisions: 100,
  sameTokenConvergenceRevisions: 20,
  shareRevokeCycles: 50,
  routeCycles: 20,
  browserViewports: ['1440x1000', '390x844'],
  testDurations: {
    cloudRevisionDesktopStressMs: 925,
    sharingIntegrationSeconds: 40.1,
    publicationFocusedSeconds: 6.0,
    browserRouteCycleDuration: 'not captured',
  },
  builtChunks: {
    'data-vendor-DbPbAp63.js': 87149,
    'index-aTb0C0Q0.css': 18879,
    'index-CdbLZwQd.js': 125295,
    'react-vendor-CBRsJp3P.js': 353721,
    'rolldown-runtime-CbXtAM7H.js': 589,
    'spacetime-vendor-Do-ucTAG.js': 129149,
  },
});

const reliabilityLayers = Object.freeze([
  { id: 'unit', command: 'npm', args: ['run', 'test:unit'], cwd: root },
  { id: 'typecheck', command: 'npm', args: ['run', 'typecheck'], cwd: root },
  { id: 'coverage', command: 'npm', args: ['run', 'validate:coverage'], cwd: root },
  { id: 'spacetimedb-build', command: 'spacetime', args: ['build'], cwd: spacetimeModule },
  { id: 'integration', command: 'npm', args: ['run', 'test:integration'], cwd: root },
  { id: 'pages', command: 'npm', args: ['run', 'test:pages'], cwd: root },
]);

export function assertFixedReliabilityTarget(uri, database) {
  if (uri !== reliabilityUri || database !== reliabilityDatabase) {
    throw new Error(
      'Reliability mutation is restricted to the fixed local test database',
    );
  }
}

function run(layer) {
  const result = spawnSync(layer.command, layer.args, {
    cwd: layer.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return result.status ?? 1;
}

export function summarizeReliability(layerResults) {
  const layers = layerResults.map(({ id, exitCode }) => ({
    id,
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
  }));

  return {
    kind: 'sbo-rebirth-reliability-summary',
    status: layers.every((layer) => layer.status === 'passed') ? 'passed' : 'failed',
    layers,
    thresholds: RELIABILITY_MEASUREMENTS,
  };
}

function emitReliabilitySummary(summary) {
  console.log(JSON.stringify(summary));
}

export function runReliability({ runChild = run, emitSummary = emitReliabilitySummary } = {}) {
  assertFixedReliabilityTarget(reliabilityUri, reliabilityDatabase);

  const summary = summarizeReliability(
    reliabilityLayers.map((layer) => ({ id: layer.id, exitCode: runChild(layer) })),
  );
  emitSummary(summary);

  const failedLayers = summary.layers.filter((layer) => layer.status === 'failed');
  if (failedLayers.length > 0) {
    throw new Error(
      failedLayers
        .map((layer) => `${layer.id} failed with exit code ${layer.exitCode}`)
        .join('; '),
    );
  }

  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runReliability();
}
