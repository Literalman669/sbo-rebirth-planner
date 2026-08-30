import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { analyzeStatBudget } from './completeness';

function profileWithTotal(total: number): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'budget-profile',
    level: 8,
    maxFloor: 1,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: total, def: 0, agi: 0, vit: 0, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

describe('analyzeStatBudget', () => {
  it('reports a balanced budget when all earned points are invested', () => {
    expect(analyzeStatBudget(profileWithTotal(24), 3)).toEqual({
      expected: 24,
      invested: 24,
      difference: 0,
      status: 'balanced',
    });
  });

  it('preserves unaccounted points as a positive difference', () => {
    expect(analyzeStatBudget(profileWithTotal(0), 3)).toMatchObject({
      difference: 24,
      status: 'unaccounted',
    });
  });

  it('preserves overspending as a negative difference', () => {
    expect(analyzeStatBudget(profileWithTotal(25), 3)).toMatchObject({
      difference: -1,
      status: 'overspent',
    });
  });
});
