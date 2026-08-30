import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import {
  buildEquipmentIndex,
  queryEquipment,
} from './equipmentQuery';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'equipment-query',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 20,
  stats: { str: 20, def: 10, agi: 10, vit: 10, luk: 10 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: ['midnight-platemail'],
  datasetVersion: fallbackRelease.version,
};

describe('equipment query', () => {
  const index = buildEquipmentIndex(fallbackRelease);

  it('matches canonical names and aliases while preserving eligibility reasons', () => {
    const result = queryEquipment(index, profile, {
      slot: 'armor',
      search: 'midnight platemail',
      sort: 'name',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    });
    expect(result[0]).toMatchObject({
      item: { id: 'midnight-platemail' },
      state: 'equip-now',
      owned: true,
    });
  });

  it('returns literal access and future-level reasons', () => {
    const gamepass = queryEquipment(index, profile, {
      slot: 'armor',
      search: 'blackwyrm coat vi',
      sort: 'name',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    });
    expect(gamepass[0]).toMatchObject({
      state: 'unavailable',
      reasons: ['Enable gamepass access'],
    });

    const futureProfile = { ...profile, level: 1 };
    const future = queryEquipment(index, futureProfile, {
      slot: 'armor',
      search: 'midnight platemail',
      sort: 'level',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    });
    expect(future[0]).toMatchObject({
      state: 'unlock-later',
      reasons: ['Requires Level 4'],
    });
  });

  it('keeps unknown prices after known prices and excludes them from value ranking', () => {
    const priced = queryEquipment(index, profile, {
      slot: 'armor',
      search: 'midnight',
      sort: 'price',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    });
    const firstUnknown = priced.findIndex((row) => row.price === null);
    expect(firstUnknown).toBeGreaterThan(0);
    expect(priced.slice(firstUnknown).every((row) => row.price === null)).toBe(
      true,
    );
  });

  it('queries a 1,000-record index repeatedly within the CI budget', () => {
    const baseCatalog = fallbackRelease.catalog.find(
      (item) => item.id === 'midnight-platemail',
    )!;
    const baseProjection = fallbackRelease.equipment.find(
      (item) => item.id === 'midnight-platemail',
    )!;
    const catalog = Array.from({ length: 1_000 }, (_, indexValue) => ({
      ...baseCatalog,
      id: `perf-armor-${indexValue}`,
      name: `Performance Armor ${indexValue}`,
      aliases: [`Perf ${indexValue}`],
      acquisitions: baseCatalog.acquisitions.map((acquisition) => ({
        ...acquisition,
        id: `perf-armor-${indexValue}:acquisition`,
      })),
    }));
    const equipment = Array.from({ length: 1_000 }, (_, indexValue) => ({
      ...baseProjection,
      id: `perf-armor-${indexValue}`,
      name: `Performance Armor ${indexValue}`,
    }));
    const snapshot: DatasetSnapshot = {
      ...fallbackRelease,
      version: 'performance-1',
      catalog,
      equipment,
    };
    const performanceIndex = buildEquipmentIndex(snapshot);
    const started = performance.now();
    let lastResult = queryEquipment(performanceIndex, profile, {
      slot: 'armor',
      search: 'performance armor 999',
      sort: 'name',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    });
    for (let repeat = 1; repeat < 100; repeat += 1) {
      lastResult = queryEquipment(performanceIndex, profile, {
        slot: 'armor',
        search: 'performance armor 999',
        sort: 'name',
        showFuture: true,
        ownedOnly: false,
        pricedOnly: false,
      });
    }

    expect(lastResult.map((row) => row.item.id)).toContain('perf-armor-999');
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
