import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../spacetimedb/src/schema.ts', import.meta.url),
  'utf8',
);

test('appends new build columns after every deployed column with defaults', () => {
  assert.match(
    source,
    /headRevisionId: t\.string\(\),[\s\S]*?createdAt: t\.timestamp\(\),[\s\S]*?updatedAt: t\.timestamp\(\),[\s\S]*?archivedAt: t\.timestamp\(\)\.optional\(\)\.default\(undefined\),/,
  );
  assert.match(
    source,
    /datasetVersion: t\.string\(\),\s*createdAt: t\.timestamp\(\),\s*accessPreferences: t\.string\(\)\.optional\(\)\.default\(undefined\),/,
  );
});

test('appends new tables after the complete deployed schema order', () => {
  assert.match(
    source,
    /mechanic,\s*releaseStrategyPolicy,\s*buildPlanProgress,\s*userPreference,\s*userInventory,\s*}\);/,
  );
});

test('defines inventory as an additive private identity row', () => {
  assert.match(
    source,
    /export const userInventory = table\(\s*\{ name: 'user_inventory' \},\s*\{\s*identity: t\.identity\(\)\.primaryKey\(\),\s*inventoryJson: t\.string\(\),\s*updatedAt: t\.timestamp\(\),\s*},\s*\);/,
  );
});
