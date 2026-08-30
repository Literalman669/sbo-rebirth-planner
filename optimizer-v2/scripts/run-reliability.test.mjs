import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFixedReliabilityTarget } from './run-reliability.mjs';

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
