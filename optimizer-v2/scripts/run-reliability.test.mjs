import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFixedReliabilityTarget,
  runReliability,
  summarizeReliability,
} from './run-reliability.mjs';

test('accepts only the fixed ephemeral reliability database', () => {
  assert.doesNotThrow(() =>
    assertFixedReliabilityTarget(
      'http://127.0.0.1:3000',
      'sbo-rebirth-optimizer-v2-test',
    ),
  );
  assert.throws(() =>
    assertFixedReliabilityTarget(
      'https://maincloud.spacetimedb.com',
      'sbo-rebirth-optimizer-v2',
    ),
  );
});

test('summarizes layer statuses with documented measured thresholds', () => {
  const summary = summarizeReliability([
    { id: 'unit', exitCode: 0 },
    { id: 'typecheck', exitCode: 1 },
  ]);

  assert.deepEqual(summary.layers, [
    { id: 'unit', status: 'passed', exitCode: 0 },
    { id: 'typecheck', status: 'failed', exitCode: 1 },
  ]);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.thresholds.optimizerDeterminismIterations, 1000);
  assert.equal(summary.thresholds.localBuilds, 250);
  assert.equal(summary.thresholds.datasetImpactCandidates, 250);
  assert.equal(summary.thresholds.datasetImpactPinnedVersions, 4);
  assert.equal(summary.thresholds.datasetImpactEndpointOptimizerCalls, 2);
  assert.equal(summary.thresholds.datasetReviewReceiptSchema, 'v1');
  assert.equal(summary.thresholds.progressBuilds, 250);
  assert.equal(summary.thresholds.progressObjectives, 200);
  assert.equal(summary.thresholds.progressHistoryEvents, 1000);
  assert.equal(summary.thresholds.progressPlanChanges, 20);
  assert.equal(summary.thresholds.progressSchemaMigration, 'v1-to-v2');
  assert.equal(summary.thresholds.progressChunkBytes > 0, true);
  assert.deepEqual(summary.thresholds.browserViewports, [
    '1440x1000',
    '768x1024',
    '390x844',
    '320x700',
  ]);
  assert.equal(summary.thresholds.equipmentQueryRecords, 1000);
  assert.equal(summary.thresholds.inventoryQueryRecords, 1000);
  assert.equal(summary.thresholds.inventoryQueryIterations, 100);
  assert.equal(summary.thresholds.inventoryQueryBudgetMs, 1000);
  assert.equal(
    summary.thresholds.indexedDbMigration,
    'v6-to-v7-with-receipt-store-preservation',
  );
  assert.equal(summary.thresholds.cloudRevisions, 100);
  assert.equal(
    Object.entries(summary.thresholds.builtChunks).find(([name]) =>
      name.startsWith('BuildComparisonScreen-'),
    )?.[1],
    10053,
  );
  assert.equal(
    Object.entries(summary.thresholds.builtChunks).find(([name]) =>
      name.startsWith('BuildPresetsScreen-'),
    )?.[1],
    4170,
  );
  assert.equal(
    Object.keys(summary.thresholds.builtChunks).some((name) =>
      name.startsWith('DatasetUpdatesScreen-') && name.endsWith('.js'),
    ),
    true,
  );
});

test('emits a failed summary and rejects when a child exits nonzero', () => {
  let emitted;

  assert.throws(
    () => runReliability({
      runChild: (layer) => (layer.id === 'typecheck' ? 1 : 0),
      emitSummary: (summary) => {
        emitted = summary;
      },
    }),
    /typecheck failed with exit code 1/,
  );

  assert.equal(emitted.status, 'failed');
  assert.deepEqual(
    emitted.layers.find((layer) => layer.id === 'typecheck'),
    { id: 'typecheck', status: 'failed', exitCode: 1 },
  );
});
