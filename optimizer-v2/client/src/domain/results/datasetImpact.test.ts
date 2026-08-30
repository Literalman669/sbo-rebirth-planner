import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { summarizeDatasetImpact } from './datasetImpact';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'impact-build',
  level: 10,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
  ownedItemIds: [],
  datasetVersion: fallbackRelease.version,
};

describe('dataset impact', () => {
  it('reports equipped item and formula changes', () => {
    const changed = {
      ...fallbackRelease,
      version: 'changed-release',
      equipment: fallbackRelease.equipment.map((item) =>
        item.id === 'iron-greatsword' ? { ...item, attack: item.attack + 1 } : item,
      ),
      formulas: fallbackRelease.formulas.map((formula) =>
        formula.id === 'attack-from-str'
          ? { ...formula, expression: `${formula.expression} changed` }
          : formula,
      ),
    };
    expect(
      summarizeDatasetImpact(profile, ['steel-greatsword'], fallbackRelease, changed),
    ).toMatchObject({
      available: true,
      relevant: true,
      changes: expect.arrayContaining([
        'Equipped item changed: Iron Greatsword',
        'Formula changed: attack-from-str',
      ]),
    });
  });

  it('reports no relevant changes and unavailable history distinctly', () => {
    expect(
      summarizeDatasetImpact(profile, [], fallbackRelease, {
        ...fallbackRelease,
        version: 'same-data',
      }),
    ).toEqual({ available: true, relevant: false, changes: [] });
    expect(summarizeDatasetImpact(profile, [], null, fallbackRelease)).toEqual({
      available: false,
      relevant: true,
      changes: ['Historical dataset is unavailable; impact cannot be verified.'],
    });
  });
});
