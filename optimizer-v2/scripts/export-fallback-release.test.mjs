import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectSingleCurrentRelease,
  serializeFallback,
} from './export-fallback-release.mjs';

test('refuses zero or multiple current releases', () => {
  assert.throws(() => selectSingleCurrentRelease([]), /exactly one/);
  assert.throws(
    () =>
      selectSingleCurrentRelease([
        { version: 'a', isCurrent: true },
        { version: 'b', isCurrent: true },
      ]),
    /exactly one/,
  );
});

test('serializes stable row order with exactly one trailing newline', () => {
  const snapshot = {
    version: '2026.08.29.1',
    formulas: [{ id: 'z' }, { id: 'a' }],
    equipment: [{ id: 'z' }, { id: 'a' }],
    knownGaps: [
      { path: 'melee', band: '300+' },
      { path: 'dagger', band: '250-299' },
    ],
  };

  const first = serializeFallback(snapshot);
  const second = serializeFallback(snapshot);
  assert.equal(first, second);
  assert.ok(first.endsWith('\n'));
  assert.ok(!first.endsWith('\n\n'));
  assert.deepEqual(JSON.parse(first).equipment.map((row) => row.id), ['a', 'z']);
  assert.deepEqual(JSON.parse(first).formulas.map((row) => row.id), ['a', 'z']);
  assert.deepEqual(
    JSON.parse(first).knownGaps.map((row) => `${row.path}:${row.band}`),
    ['dagger:250-299', 'melee:300+'],
  );
});
