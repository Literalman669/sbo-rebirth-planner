import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { equipmentTotalsForProfile } from './equipmentTotals';

function profile(equipped: CharacterProfile['equipped']): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'build-a',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped,
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
  };
}

describe('equipment totals', () => {
  it('sums only equipped verified optimizer records', () => {
    expect(
      equipmentTotalsForProfile(
        profile({
          'main-hand': 'iron-greatsword',
          armor: 'fields-warrior',
        }),
        fallbackRelease,
      ),
    ).toEqual({ attack: 3, defense: 1.5, dexterity: 6 });
  });

  it('ignores equipped IDs unavailable in the selected dataset', () => {
    expect(
      equipmentTotalsForProfile(
        profile({ 'main-hand': 'missing-item', armor: 'fields-warrior' }),
        fallbackRelease,
      ),
    ).toEqual({ attack: 0, defense: 1.5, dexterity: 6 });
  });
});
