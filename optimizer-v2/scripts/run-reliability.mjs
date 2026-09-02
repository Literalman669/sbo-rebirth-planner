import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const reliabilityUri = 'http://127.0.0.1:3000';
const reliabilityDatabase = 'sbo-rebirth-optimizer-v2-test';
const root = new URL('../', import.meta.url);
const spacetimeModule = new URL('../spacetimedb/', import.meta.url);

export const RELIABILITY_MEASUREMENTS = Object.freeze({
  optimizerDeterminismIterations: 1000,
  optimizerDeterminismElapsedMs: 698.9,
  localBuilds: 250,
  datasetImpactCandidates: 250,
  datasetImpactPinnedVersions: 4,
  datasetImpactEndpointOptimizerCalls: 2,
  datasetReviewReceiptSchema: 'v1',
  progressBuilds: 250,
  progressObjectives: 200,
  progressHistoryEvents: 1000,
  progressPlanChanges: 20,
  progressSchemaMigration: 'v1-to-v2',
  progressChunkBytes: 16758,
  cloudRevisions: 100,
  sameTokenConvergenceRevisions: 20,
  shareRevokeCycles: 50,
  routeCycles: 20,
  browserViewports: ['1440x1000', '768x1024', '390x844', '320x700'],
  indexedDbMigration: 'v6-to-v7-with-receipt-store-preservation',
  equipmentQueryRecords: 1000,
  equipmentQueryIterations: 100,
  equipmentQueryBudgetMs: 1000,
  equipmentQueryElapsedMs: 29.6,
  inventoryQueryRecords: 1000,
  inventoryQueryIterations: 100,
  inventoryQueryBudgetMs: 1000,
  inventoryQueryElapsedMs: 269.8,
  accessibilityGate: 'zero serious or critical axe violations',
  testDurations: {
    cloudRevisionDesktopStressMs: 9700,
    sharingIntegrationSeconds: 0.182,
    publicationFocusedSeconds: 4.5,
    browserRouteCycleDuration: 5.4,
  },
  builtChunks: {
    'BuildComparisonScreen-W4tADypl.js': 10053,
    'BuildPresetsScreen-DxRobBog.js': 4170,
    'DatasetUpdatesScreen-BVMoX-vX.js': 15783,
    'ProgressScreen-kHFMmD95.js': 16758,
    'data-vendor-DzUpFvRy.js': 89348,
    'index-CkwylbjW.js': 997406,
    'index-BAcoWALv.css': 66587,
    'react-vendor-Dzb7su-e.js': 354604,
    'rolldown-runtime-CbXtAM7H.js': 589,
    'spacetime-vendor-BWfLuweQ.js': 129149,
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
