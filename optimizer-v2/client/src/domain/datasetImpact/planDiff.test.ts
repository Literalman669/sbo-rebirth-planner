import { describe, expect, it } from 'vitest';
import type { StatBlock } from '../build/model';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import {
  diffRecommendationPlans,
  type PlanEndpointResult,
} from './planDiff';

const zero: StatBlock = { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
const totals: StatBlock = { str: 10, def: 5, agi: 5, vit: 5, luk: 5 };

function plan(): RecommendationPlan {
  return {
    datasetVersion: '2026.08.30.1',
    immediateAction: { kind: 'keep-current', summary: 'Keep current gear' },
    statPlan: {
      spendNow: { points: 0, added: { ...zero }, totals: { ...totals } },
      levels: 10,
      futurePoints: 30,
      futureAdded: { str: 6, def: 6, agi: 6, vit: 6, luk: 6 },
      levelRows: [
        {
          level: 9,
          added: { str: 1, def: 1, agi: 1, vit: 0, luk: 0 },
          totals: { str: 11, def: 6, agi: 6, vit: 5, luk: 5 },
        },
      ],
      final: { str: 16, def: 11, agi: 11, vit: 11, luk: 11 },
      milestones: [
        {
          afterLevel: 5,
          added: { str: 3, def: 3, agi: 3, vit: 3, luk: 3 },
          totals: { str: 13, def: 8, agi: 8, vit: 8, luk: 8 },
        },
        {
          afterLevel: 10,
          added: { str: 6, def: 6, agi: 6, vit: 6, luk: 6 },
          totals: { str: 16, def: 11, agi: 11, vit: 11, luk: 11 },
        },
      ],
    },
    upgradeTargets: [],
    warnings: [],
    explanation: ['Pinned explanation'],
  };
}

describe('recommendation plan impact', () => {
  it('identifies immediate, level, upgrade, warning, and shopping changes', () => {
    const pinned = plan();
    const target = structuredClone(pinned);
    target.datasetVersion = '2026.09.01.1';
    target.immediateAction = {
      kind: 'obtain-upgrade',
      itemId: 'combat-armor',
      summary: 'Obtain Combat Armor',
    };
    target.statPlan.levelRows[0] = {
      level: 9,
      added: { str: 0, def: 2, agi: 1, vit: 0, luk: 0 },
      totals: { str: 10, def: 7, agi: 6, vit: 5, luk: 5 },
    };
    target.upgradeTargets = [
      {
        itemId: 'combat-armor',
        slot: 'armor',
        immediate: true,
        acquisitionDetail: 'Floor 2 Shop',
        requirementText: 'Level 7',
        sourceUrl:
          'https://swordbloxonlinerebirth.fandom.com/wiki/Combat%20Armor',
        verifiedCost: { amount: 3_360, currency: 'Col' },
        delta: { bonusHp: 30 },
        rawDelta: { defense: 1, resistances: {} },
        unmodeledEffects: [],
      },
    ];
    target.warnings = ['Current data warning'];

    const impact = diffRecommendationPlans(
      { status: 'ready', plan: pinned },
      { status: 'ready', plan: target },
    );

    expect(impact).toMatchObject({
      status: 'changed',
      changedLevelRows: [9],
      shopping: {
        beforeKnownTotal: 0,
        afterKnownTotal: 3_360,
        beforeUnknownCount: 0,
        afterUnknownCount: 0,
        currency: 'Col',
      },
    });
    if (impact.status !== 'changed') throw new Error('expected changed impact');
    expect(impact.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining([
        'immediateAction',
        'levelRows.9',
        'upgradeTargets',
        'warnings',
      ]),
    );
  });

  it('distinguishes unchanged and blocked endpoints', () => {
    const ready: PlanEndpointResult = { status: 'ready', plan: plan() };
    expect(diffRecommendationPlans(ready, structuredClone(ready))).toMatchObject({
      status: 'unchanged',
      changedLevelRows: [],
    });
    expect(
      diffRecommendationPlans(ready, {
        status: 'blocked',
        explanation: 'Invested stats exceed the available point budget.',
      }),
    ).toEqual({
      status: 'blocked',
      targetReason: 'Invested stats exceed the available point budget.',
    });
  });
});
