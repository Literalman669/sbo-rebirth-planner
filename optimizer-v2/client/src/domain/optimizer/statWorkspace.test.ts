import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import {
  adjustStat,
  maxAvailableForStat,
  previewStatChange,
  recommendUnspentAllocation,
  resetStats,
} from './statWorkspace';

function profile(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'stats-workspace',
    level: 10,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 10, def: 7, agi: 5, vit: 5, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'beginner-armor',
    },
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
    ...overrides,
  };
}

describe('stat workspace', () => {
  it('adds five without exceeding the earned budget or stat cap', () => {
    const current = profile();
    expect(adjustStat(current, 'str', 5, 3)).toEqual({
      ...current.stats,
      str: current.stats.str + 3,
    });
  });

  it('applies the deterministic recommendation around locked stats', () => {
    const current = profile();
    const result = recommendUnspentAllocation(
      current,
      fallbackRelease,
      new Set(['def']),
    );

    expect(result.def).toBe(current.stats.def);
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(
      current.level * 3,
    );
  });

  it('resets stats and reports the maximum legal value for one stat', () => {
    const current = profile();
    expect(resetStats()).toEqual({ str: 0, def: 0, agi: 0, vit: 0, luk: 0 });
    expect(maxAvailableForStat(current, 'str', 3)).toBe(13);
  });

  it('previews verified metric changes without mutating the profile', () => {
    const current = profile();
    const preview = previewStatChange(
      current,
      { ...current.stats, str: 13 },
      fallbackRelease,
    );

    expect(preview.deltas.attackPerHit).toBeGreaterThan(0);
    expect(current.stats.str).toBe(10);
  });
});
