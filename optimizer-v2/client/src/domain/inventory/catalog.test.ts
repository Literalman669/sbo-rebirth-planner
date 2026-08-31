import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import { fallbackRelease } from '../../data/fallbackRelease';
import { buildEquipmentIndex } from '../equipment/equipmentQuery';
import type { InventoryState } from './state';
import {
  queryInventoryCatalog,
  unresolvedInventoryIds,
} from './catalog';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'inventory-catalog-build',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 5,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: ['iron-greatsword'],
  datasetVersion: fallbackRelease.version,
};

const inventory: InventoryState = {
  schemaVersion: 1,
  ownedItemIds: ['iron-greatsword'],
  favoriteItemIds: ['steel-greatsword'],
  comparisonItemIds: ['iron-greatsword', 'steel-greatsword'],
  notes: { 'iron-greatsword': 'Starter weapon' },
};

const defaults = {
  search: '',
  slot: 'all' as const,
  ownership: 'all' as const,
  favoriteOnly: false,
  missingUpgradeOnly: false,
  pricedOnly: false,
  sort: 'name' as const,
};

describe('inventory catalog', () => {
  const index = buildEquipmentIndex(fallbackRelease);

  it('searches one slot and decorates canonical inventory state', () => {
    const results = queryInventoryCatalog(index, profile, inventory, {
      ...defaults,
      search: 'greatsword',
      slot: 'main-hand',
    });

    expect(results.map((result) => result.item.id)).toEqual(
      expect.arrayContaining(['iron-greatsword', 'steel-greatsword']),
    );
    expect(results.every((result) => result.item.slot === 'main-hand')).toBe(
      true,
    );
    expect(
      results.find((result) => result.item.id === 'iron-greatsword'),
    ).toMatchObject({ owned: true, compared: true, note: 'Starter weapon' });
    expect(
      results.find((result) => result.item.id === 'steel-greatsword'),
    ).toMatchObject({ favorite: true, compared: true });
  });

  it('filters owned, favorites, prices, and missing upgrades independently', () => {
    expect(
      queryInventoryCatalog(index, profile, inventory, {
        ...defaults,
        slot: 'main-hand',
        ownership: 'owned',
      }).map((result) => result.item.id),
    ).toEqual(['iron-greatsword']);
    expect(
      queryInventoryCatalog(index, profile, inventory, {
        ...defaults,
        favoriteOnly: true,
      }).map((result) => result.item.id),
    ).toEqual(['steel-greatsword']);
    expect(
      queryInventoryCatalog(index, profile, inventory, {
        ...defaults,
        slot: 'armor',
        missingUpgradeOnly: true,
        pricedOnly: true,
        sort: 'projected-improvement',
      }).map((result) => result.item.id),
    ).toContain('fields-warrior');
  });

  it('sorts known prices before missing prices with deterministic name and ID ties', () => {
    const results = queryInventoryCatalog(index, profile, inventory, {
      ...defaults,
      slot: 'armor',
      sort: 'price',
    });
    const known = results.filter((result) => result.price !== null);
    const unknown = results.filter((result) => result.price === null);

    expect(known.length).toBeGreaterThan(0);
    expect(results.slice(0, known.length).every((result) => result.price !== null)).toBe(true);
    expect(results.slice(known.length)).toEqual(unknown);
    expect(
      known.every(
        (result, index) =>
          index === 0 || result.price! >= known[index - 1]!.price!,
      ),
    ).toBe(true);
  });

  it('reports persisted IDs unavailable in the active verified dataset', () => {
    expect(
      unresolvedInventoryIds(index, {
        ...inventory,
        ownedItemIds: ['iron-greatsword', 'removed-item'],
        favoriteItemIds: ['missing-favorite'],
      }),
    ).toEqual(['missing-favorite', 'removed-item']);
  });

  it('queries 1,000 catalog records repeatedly inside the reliability budget', () => {
    const base = fallbackRelease.catalog[0]!;
    const entries = Array.from({ length: 1_000 }, (_, indexValue) => ({
      ...base,
      id: `${base.id}-${String(indexValue).padStart(4, '0')}`,
      name: `${base.name} ${String(indexValue).padStart(4, '0')}`,
    }));
    const stressIndex = {
      ...index,
      entries: entries.map((item) => ({
        item,
        optimizerItem: null,
        searchText: `${item.name} ${item.id}`.toLowerCase(),
        price: null,
        currency: null,
        floor: null,
      })),
    };
    const started = performance.now();
    let finalCount = 0;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      finalCount = queryInventoryCatalog(
        stressIndex,
        profile,
        inventory,
        defaults,
      ).length;
    }
    const elapsed = performance.now() - started;

    expect(finalCount).toBe(1_000);
    expect(elapsed).toBeLessThan(1_000);
  });
});
