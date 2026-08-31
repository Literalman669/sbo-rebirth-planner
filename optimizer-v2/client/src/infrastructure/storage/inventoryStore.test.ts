import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { InventoryState } from '../../domain/inventory/state';
import { openPlannerDatabase } from './plannerDatabase';
import { createInventoryStore } from './inventoryStore';

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

describe('inventory store', () => {
  it('loads an isolated empty state and round-trips valid inventory', async () => {
    const store = createInventoryStore({
      databaseName: `inventory-roundtrip-${crypto.randomUUID()}`,
    });
    const empty = await store.load();
    expect(empty).toEqual(inventory());

    await store.save(
      inventory({
        ownedItemIds: ['iron-greatsword'],
        favoriteItemIds: ['beginner-armor'],
      }),
    );
    const loaded = await store.load();
    expect(loaded).toEqual(
      inventory({
        ownedItemIds: ['iron-greatsword'],
        favoriteItemIds: ['beginner-armor'],
      }),
    );
    expect(loaded).not.toBe(empty);
  });

  it('quarantines a corrupt stored row instead of deleting it silently', async () => {
    const databaseName = `inventory-corrupt-${crypto.randomUUID()}`;
    const store = createInventoryStore({ databaseName });
    const database = await openPlannerDatabase(databaseName);
    await database.put('inventory', { schemaVersion: 99 }, 'primary');
    database.close();

    await expect(store.load()).rejects.toThrow('Stored inventory is invalid');

    const inspected = await openPlannerDatabase(databaseName);
    const quarantined = await inspected.getAll('quarantine');
    inspected.close();
    expect(quarantined).toContainEqual(
      expect.objectContaining({
        kind: 'inventory',
        rawJson: JSON.stringify({ schemaVersion: 99 }),
      }),
    );
  });

  it('exports stable versioned JSON with one trailing newline', async () => {
    const store = createInventoryStore({
      databaseName: `inventory-export-${crypto.randomUUID()}`,
      now: () => '2026-08-31T12:00:00.000Z',
    });
    await store.save(
      inventory({
        ownedItemIds: ['iron-greatsword'],
        notes: { 'iron-greatsword': 'Starter weapon' },
      }),
    );

    await expect(store.exportBackup('2026.08.30.1')).resolves.toBe(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: '2026-08-31T12:00:00.000Z',
          datasetVersion: '2026.08.30.1',
          inventory: inventory({
            ownedItemIds: ['iron-greatsword'],
            notes: { 'iron-greatsword': 'Starter weapon' },
          }),
        },
        null,
        2,
      )}\n`,
    );
  });

  it('merges or replaces a validated backup and preserves state after invalid JSON', async () => {
    const store = createInventoryStore({
      databaseName: `inventory-import-${crypto.randomUUID()}`,
    });
    await store.save(
      inventory({
        ownedItemIds: ['iron-greatsword'],
        comparisonItemIds: ['iron-greatsword'],
      }),
    );
    const backup = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-08-31T12:00:00.000Z',
      datasetVersion: '2026.08.30.1',
      inventory: inventory({
        ownedItemIds: ['beginner-armor'],
        favoriteItemIds: ['beginner-armor'],
      }),
    });

    await expect(store.importBackup(backup, 'merge')).resolves.toEqual(
      inventory({
        ownedItemIds: ['beginner-armor', 'iron-greatsword'],
        favoriteItemIds: ['beginner-armor'],
        comparisonItemIds: ['iron-greatsword'],
      }),
    );
    await expect(store.importBackup(backup, 'replace')).resolves.toEqual(
      inventory({
        ownedItemIds: ['beginner-armor'],
        favoriteItemIds: ['beginner-armor'],
      }),
    );
    await expect(store.importBackup('{bad json', 'replace')).rejects.toThrow(
      'Inventory backup is invalid',
    );
    await expect(store.load()).resolves.toEqual(
      inventory({
        ownedItemIds: ['beginner-armor'],
        favoriteItemIds: ['beginner-armor'],
      }),
    );
  });

  it('deletes only the primary inventory row when reset', async () => {
    const store = createInventoryStore({
      databaseName: `inventory-reset-${crypto.randomUUID()}`,
    });
    await store.save(inventory({ ownedItemIds: ['iron-greatsword'] }));
    await store.reset();
    await expect(store.load()).resolves.toEqual(inventory());
  });
});
