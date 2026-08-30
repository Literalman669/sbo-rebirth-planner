import { describe, expect, it } from 'vitest';
import type { CharacterProfile, StatBlock } from '../build/model';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import {
  buildActionChecklist,
  reconcileProfileToLevel,
  sumVerifiedCosts,
} from './actionChecklist';

const zero: StatBlock = { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'action-build',
  level: 10,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
  ownedItemIds: [],
  datasetVersion: 'test-release',
};

const rows = Array.from({ length: 10 }, (_, index) => ({
  level: 11 + index,
  added: { ...zero, str: index < 3 ? 1 : 0, agi: index >= 3 ? 1 : 0 },
  totals: {
    str: 11 + Math.min(index, 2),
    def: 5,
    agi: 5 + Math.max(index - 2, 0),
    vit: 5,
    luk: 5,
  },
}));

const plan: RecommendationPlan = {
  datasetVersion: 'test-release',
  immediateAction: {
    kind: 'obtain-upgrade',
    itemId: 'combat-armor',
    summary: 'Obtain Combat Armor next',
  },
  statPlan: {
    spendNow: { points: 0, added: zero, totals: profile.stats },
    levels: 10,
    futurePoints: 30,
    futureAdded: { str: 3, def: 0, agi: 7, vit: 0, luk: 0 },
    levelRows: rows,
    final: rows[9]!.totals,
    milestones: [],
  },
  upgradeTargets: [
    {
      itemId: 'combat-armor',
      slot: 'armor',
      immediate: true,
      acquisitionDetail: 'Floor 2 Shop',
      requirementText: 'Level 7',
      sourceUrl: 'https://example.com/combat-armor',
      priceText: '3,360 Col',
      verifiedCost: { amount: 3360, currency: 'Col' },
      delta: {},
      rawDelta: { defense: 3, dexterity: 15, resistances: {} },
      unmodeledEffects: [],
    },
  ],
  warnings: [],
  explanation: [],
};

describe('action checklist', () => {
  it('builds stable immediate, level, and equipment action IDs in group order', () => {
    const actions = buildActionChecklist(profile, plan, new Map([
      ['combat-armor', 'Combat Armor'],
    ]));

    expect(actions.slice(0, 4).map((action) => action.id)).toEqual([
      'equipment:armor:combat-armor',
      'spend-stats:level:11',
      'spend-stats:level:12',
      'spend-stats:level:13',
    ]);
    expect(actions[0]).toMatchObject({
      group: 'do-now',
      kind: 'buy',
      verifiedCost: { amount: 3360, currency: 'Col' },
    });
  });

  it('sums verified costs separately from unknown prices', () => {
    const actions = buildActionChecklist(profile, plan, new Map([
      ['combat-armor', 'Combat Armor'],
    ]));
    expect(
      sumVerifiedCosts([
        ...actions,
        {
          id: 'later:unknown',
          group: 'later',
          kind: 'farm',
          title: 'Farm unknown item',
          detail: 'Unknown price',
          itemId: 'unknown-item',
        },
      ]),
    ).toEqual({ totals: { Col: 3360 }, unknownPriceActions: 1 });
  });

  it('reconciles through a target level exactly once and rejects outside levels', () => {
    const reconciled = reconcileProfileToLevel(profile, plan, 13);
    expect(reconciled).toMatchObject({ level: 13, stats: rows[2]!.totals });
    expect(() => reconcileProfileToLevel(reconciled, plan, 13)).toThrow(
      'Target level must be above the current level',
    );
    expect(() => reconcileProfileToLevel(profile, plan, 21)).toThrow(
      'Target level is outside this plan',
    );
  });
});
