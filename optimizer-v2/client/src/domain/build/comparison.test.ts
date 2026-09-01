import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from './model';
import {
  compareBuildEvaluations,
  evaluateBuildForComparison,
} from './comparison';

function profile(
  id: string,
  stats: CharacterProfile['stats'] = {
    str: 14,
    def: 0,
    agi: 3,
    vit: 7,
    luk: 0,
  },
): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: `Build ${id}`,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats,
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
  };
}

describe('build comparison evaluation', () => {
  it('evaluates a complete build with verified projections, actions, and costs', () => {
    const evaluation = evaluateBuildForComparison(
      profile('left'),
      fallbackRelease,
    );

    expect(evaluation).toMatchObject({
      status: 'ready',
      profile: { id: 'left' },
      dataset: { version: fallbackRelease.version },
      metrics: {
        attackPerHit: 3.168,
        damageReductionPerHit: 7.5,
      },
      plan: {
        datasetVersion: fallbackRelease.version,
        statPlan: { futurePoints: 30 },
      },
      costs: {
        totals: expect.any(Object),
        unknownPriceActions: expect.any(Number),
      },
    });
  });

  it('keeps stored profile evidence when dataset, profile, equipment, or optimizer is unavailable', () => {
    expect(evaluateBuildForComparison(profile('missing'), null)).toMatchObject({
      status: 'dataset-unavailable',
      profile: { id: 'missing' },
    });
    expect(
      evaluateBuildForComparison(
        { ...profile('profile-bad'), level: 0 },
        fallbackRelease,
      ),
    ).toMatchObject({ status: 'profile-incomplete' });
    expect(
      evaluateBuildForComparison(
        { ...profile('gear-bad'), equipped: {} },
        fallbackRelease,
      ),
    ).toMatchObject({ status: 'equipment-incomplete' });
    expect(
      evaluateBuildForComparison(
        {
          ...profile('overspent'),
          stats: { str: 25, def: 0, agi: 0, vit: 0, luk: 0 },
        },
        fallbackRelease,
      ),
    ).toMatchObject({
      status: 'optimizer-unavailable',
      explanation: 'Invested stats exceed the available point budget by 1.',
    });
  });

  it('compares stored and projected metrics without producing an overall winner', () => {
    const left = evaluateBuildForComparison(
      profile('left'),
      fallbackRelease,
    );
    const right = evaluateBuildForComparison(
      profile('right', { str: 10, def: 4, agi: 3, vit: 7, luk: 0 }),
      fallbackRelease,
    );
    const comparison = compareBuildEvaluations(left, right);

    expect(comparison.metrics).toContainEqual({
      id: 'str',
      label: 'STR',
      left: 14,
      right: 10,
      leader: 'left',
      format: 'number',
    });
    expect(comparison.metrics).toContainEqual({
      id: 'attackPerHit',
      label: 'Damage per hit',
      left: 3.168,
      right: 3.12,
      leader: 'left',
      format: 'number',
    });
    expect(comparison.metrics).toContainEqual(
      expect.objectContaining({ id: 'level', leader: 'equal' }),
    );
    expect(comparison).not.toHaveProperty('overallWinner');
  });

  it('marks derived metrics unknown when either side cannot be evaluated', () => {
    const left = evaluateBuildForComparison(profile('left'), fallbackRelease);
    const unavailable = evaluateBuildForComparison(
      profile('right', { str: 10, def: 4, agi: 3, vit: 7, luk: 0 }),
      null,
    );
    const comparison = compareBuildEvaluations(left, unavailable);

    expect(comparison.metrics).toContainEqual({
      id: 'attackPerHit',
      label: 'Damage per hit',
      left: 3.168,
      right: null,
      leader: 'unknown',
      format: 'number',
    });
    expect(comparison.metrics).toContainEqual(
      expect.objectContaining({ id: 'str', leader: 'left' }),
    );
  });
});
