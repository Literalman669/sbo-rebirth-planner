import { describe, expect, it } from 'vitest';
import type { CharacterProfile, StatBlock } from '../build/model';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import { fallbackRelease } from '../../data/fallbackRelease';
import { generateProgressTasks } from './tasks';

const zero: StatBlock = { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'progress-build',
  level: 10,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
  ownedItemIds: [],
  datasetVersion: fallbackRelease.version,
};
const levelRows = Array.from({ length: 10 }, (_, index) => ({
  level: 11 + index,
  added: { ...zero, str: 3 },
  totals: { ...profile.stats, str: profile.stats.str + (index + 1) * 3 },
}));
const plan: RecommendationPlan = {
  datasetVersion: fallbackRelease.version,
  immediateAction: {
    kind: 'obtain-upgrade',
    itemId: 'fields-warrior',
    summary: 'Obtain Fields Warrior next',
  },
  statPlan: {
    spendNow: { points: 0, added: zero, totals: profile.stats },
    levels: 10,
    futurePoints: 30,
    futureAdded: { ...zero, str: 30 },
    levelRows,
    final: levelRows[9]!.totals,
    milestones: [],
  },
  upgradeTargets: [
    {
      itemId: 'fields-warrior',
      slot: 'armor',
      immediate: true,
      acquisitionDetail: 'Floor 1 Shop',
      requirementText: 'Level 3',
      sourceUrl: 'https://example.com/fields-warrior',
      priceText: '2,000 Col',
      verifiedCost: { amount: 2000, currency: 'Col' },
      delta: {},
      rawDelta: { defense: 1, dexterity: 3, resistances: {} },
      unmodeledEffects: [],
    },
  ],
  warnings: [],
  explanation: [],
};

describe('progress task generation', () => {
  it('preserves verified targets and adds a manual next-floor milestone', () => {
    const tasks = generateProgressTasks(
      profile,
      plan,
      fallbackRelease,
      'plan-abcd',
    );

    expect(tasks.find((task) => task.actionKey === 'spend-stats:level:11')).toMatchObject({
      category: 'stat-allocation',
      planFingerprint: 'plan-abcd',
      automatic: true,
      targetLevel: 11,
      targetStats: levelRows[0]!.totals,
    });
    expect(tasks.find((task) => task.actionKey === 'equipment:armor:fields-warrior')).toMatchObject({
      category: 'equipment-upgrade',
      itemId: 'fields-warrior',
      slot: 'armor',
      verifiedCost: { amount: 2000, currency: 'Col' },
      sourceUrl: 'https://example.com/fields-warrior',
    });
    expect(tasks.at(-1)).toMatchObject({
      actionKey: 'floor:unlock:3',
      category: 'floor-milestone',
      targetFloor: 3,
      automatic: false,
    });
  });

  it('does not mutate the profile or optimizer plan', () => {
    const profileBefore = structuredClone(profile);
    const planBefore = structuredClone(plan);

    generateProgressTasks(profile, plan, fallbackRelease, 'plan-abcd');

    expect(profile).toEqual(profileBefore);
    expect(plan).toEqual(planBefore);
  });
});
