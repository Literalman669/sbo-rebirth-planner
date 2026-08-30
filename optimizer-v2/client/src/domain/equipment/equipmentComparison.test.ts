import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { compareEquipment } from './equipmentComparison';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'comparison-build',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'damage',
  weaponSkill: 20,
  stats: { str: 20, def: 10, agi: 10, vit: 10, luk: 10 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: [],
  datasetVersion: fallbackRelease.version,
};

describe('equipment comparison', () => {
  it('returns raw, projected, price, effect, and source metadata', () => {
    const candidate = fallbackRelease.catalog.find(
      (item) => item.id === 'steel-greatsword',
    )!;
    const comparison = compareEquipment(
      profile,
      'main-hand',
      candidate,
      fallbackRelease,
    );

    expect(comparison.rawDelta.attack).toBe(7);
    expect(comparison.projectedDelta.attackPerHit).toBeGreaterThan(0);
    expect(comparison.price).toEqual({ cost: 1392, currency: 'Col' });
    expect(comparison.sourceUrl).toContain('Steel%20Greatsword');
    expect(comparison.unmodeledEffects).toEqual([]);
  });
});
