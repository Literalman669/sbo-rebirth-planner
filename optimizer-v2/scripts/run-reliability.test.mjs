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
  assert.deepEqual(summary.thresholds.browserViewports, [
    '1440x1000',
    '768x1024',
    '390x844',
    '320x700',
  ]);
  assert.equal(summary.thresholds.equipmentQueryRecords, 1000);
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
