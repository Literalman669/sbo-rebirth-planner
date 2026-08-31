import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const reliabilityUri = 'http://127.0.0.1:3000';
const reliabilityDatabase = 'sbo-rebirth-optimizer-v2-test';
const root = new URL('../', import.meta.url);
const spacetimeModule = new URL('../spacetimedb/', import.meta.url);

export const RELIABILITY_MEASUREMENTS = Object.freeze({
  optimizerDeterminismIterations: 1000,
  optimizerDeterminismElapsedMs: 956.8,
  localBuilds: 250,
  cloudRevisions: 100,
  sameTokenConvergenceRevisions: 20,
  shareRevokeCycles: 50,
  routeCycles: 20,
  browserViewports: ['1440x1000', '768x1024', '390x844', '320x700'],
  indexedDbMigration: 'v4-to-v5-with-inventory-preservation',
  equipmentQueryRecords: 1000,
  equipmentQueryIterations: 100,
  equipmentQueryBudgetMs: 1000,
  equipmentQueryElapsedMs: 38.2,
  inventoryQueryRecords: 1000,
  inventoryQueryIterations: 100,
  inventoryQueryBudgetMs: 1000,
  inventoryQueryElapsedMs: 84.3,
  accessibilityGate: 'zero serious or critical axe violations',
  testDurations: {
    cloudRevisionDesktopStressMs: 9700,
    sharingIntegrationSeconds: 0.182,
    publicationFocusedSeconds: 4.5,
    browserRouteCycleDuration: 5.4,
  },
  builtChunks: {
    'data-vendor-BpuTNvJb.js': 89295,
    'index-B4sdvBPO.css': 48402,
    'index-D-lC1Qjn.js': 932428,
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
