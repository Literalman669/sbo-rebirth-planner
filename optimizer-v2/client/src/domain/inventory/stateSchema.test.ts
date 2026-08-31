import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVENTORY,
  mergeInventoryStates,
  normalizeInventoryState,
  type InventoryState,
} from './state';
import {
  migrateInventoryState,
  parseInventoryBackup,
} from './stateSchema';

function inventory(
  patch: Partial<InventoryState> = {},
): InventoryState {
  return {
    schemaVersion: 1,
    ownedItemIds: [],
    favoriteItemIds: [],
    comparisonItemIds: [],
    notes: {},
    ...patch,
  };
}

describe('inventory state', () => {
  it('normalizes IDs deterministically without changing comparison order', () => {
    expect(
      normalizeInventoryState(
        inventory({
          ownedItemIds: [' steel-greatsword ', 'beginner-armor', 'steel-greatsword'],
          favoriteItemIds: ['iron-greatsword', 'beginner-armor', 'iron-greatsword'],
          comparisonItemIds: [' steel-greatsword ', 'beginner-armor', 'steel-greatsword'],
          notes: {
            ' steel-greatsword ': '  Boss drop target  ',
            'beginner-armor': '   ',
          },
        }),
      ),
    ).toEqual({
      schemaVersion: 1,
      ownedItemIds: ['beginner-armor', 'steel-greatsword'],
      favoriteItemIds: ['beginner-armor', 'iron-greatsword'],
      comparisonItemIds: ['steel-greatsword', 'beginner-armor'],
      notes: { 'steel-greatsword': 'Boss drop target' },
    });
  });

  it('merges local and cloud state without losing either owned set', () => {
    const local = inventory({
      ownedItemIds: ['iron-greatsword'],
      favoriteItemIds: ['iron-greatsword'],
      comparisonItemIds: ['a', 'b'],
      notes: { c: 'Local note', d: 'Local only' },
    });
    const cloud = inventory({
      ownedItemIds: ['beginner-armor'],
      favoriteItemIds: ['beginner-armor'],
      comparisonItemIds: ['b', 'c'],
      notes: { c: 'Cloud note' },
    });

    expect(mergeInventoryStates(local, cloud)).toEqual({
      schemaVersion: 1,
      ownedItemIds: ['beginner-armor', 'iron-greatsword'],
      favoriteItemIds: ['beginner-armor', 'iron-greatsword'],
      comparisonItemIds: ['a', 'b', 'c'],
      notes: { c: 'Cloud note', d: 'Local only' },
    });
  });

  it('returns a clone of the empty inventory for a missing stored row', () => {
    const first = migrateInventoryState(undefined);
    const second = migrateInventoryState(null);

    expect(first).toEqual(EMPTY_INVENTORY);
    expect(second).toEqual(EMPTY_INVENTORY);
    expect(first).not.toBe(EMPTY_INVENTORY);
    expect(first.ownedItemIds).not.toBe(second.ownedItemIds);
  });

  it('rejects corrupt stored lists instead of silently truncating them', () => {
    expect(() =>
      migrateInventoryState(
        inventory({ comparisonItemIds: ['1', '2', '3', '4', '5'] }),
      ),
    ).toThrow('Stored inventory is invalid');
    expect(() =>
      migrateInventoryState(
        inventory({ ownedItemIds: ['iron-greatsword', 'iron-greatsword'] }),
      ),
    ).toThrow('Stored inventory is invalid');
  });

  it('rejects oversized or malformed personal notes', () => {
    expect(() =>
      migrateInventoryState(inventory({ notes: { sword: 'x'.repeat(501) } })),
    ).toThrow('Stored inventory is invalid');
    expect(() =>
      migrateInventoryState(inventory({ notes: { '': 'invalid key' } })),
    ).toThrow('Stored inventory is invalid');
    expect(() =>
      migrateInventoryState(inventory({ notes: { sword: 'unsafe\0note' } })),
    ).toThrow('Stored inventory is invalid');
  });

  it('preserves safe multiline personal notes', () => {
    expect(
      migrateInventoryState(
        inventory({ notes: { sword: 'First line\nSecond line' } }),
      ).notes.sword,
    ).toBe('First line\nSecond line');
  });

  it('parses a versioned backup and rejects a mismatched envelope', () => {
    const valid = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-08-31T12:00:00.000Z',
      datasetVersion: '2026.08.30.1',
      inventory: inventory({ ownedItemIds: ['iron-greatsword'] }),
    });

    expect(parseInventoryBackup(valid)).toEqual({
      schemaVersion: 1,
      exportedAt: '2026-08-31T12:00:00.000Z',
      datasetVersion: '2026.08.30.1',
      inventory: inventory({ ownedItemIds: ['iron-greatsword'] }),
    });
    expect(() =>
      parseInventoryBackup(
        JSON.stringify({ ...JSON.parse(valid), schemaVersion: 2 }),
      ),
    ).toThrow('Inventory backup is invalid');
  });
});
