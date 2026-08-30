import { describe, expect, it } from 'vitest';
import type {
  CharacterProfile,
  OptimizationGoal,
  WeaponPath,
} from '../build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../dataset/model';
import { optimizeBuild } from './optimizeBuild';
import {
  assertRecommendationInvariants,
  buildHistoricalStressDataset,
  buildStressDataset,
  buildStressProfile,
} from '../../test/stressFixtures';

const paths: WeaponPath[] = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
];
const goals: OptimizationGoal[] = [
  'balanced',
  'damage',
  'survivability',
  'mobility',
  'farming',
];

function historicalItem(dataset: DatasetSnapshot, itemId: string): EquipmentRecord {
  const item = dataset.equipment.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`historical stress record ${itemId} is missing`);
  return { ...item, weaponPaths: [...item.weaponPaths] };
}

function boundaryDataset(item: EquipmentRecord): DatasetSnapshot {
  const historical = buildHistoricalStressDataset();
  return {
    ...historical,
    equipment: [historicalItem(historical, 'beginner-sword'), item],
  };
}

function boundaryProfile(
  dataset: DatasetSnapshot,
  overrides: Partial<CharacterProfile> = {},
): CharacterProfile {
  return buildStressProfile({
    level: 3,
    maxFloor: 1,
    weaponPath: 'one-handed',
    goal: 'damage',
    weaponSkill: 5,
    equipped: { 'main-hand': 'beginner-sword' },
    ownedItemIds: [],
    datasetVersion: dataset.version,
    ...overrides,
  });
}

function steelSword(
  dataset: DatasetSnapshot,
  overrides: Partial<EquipmentRecord> = {},
): EquipmentRecord {
  return { ...historicalItem(dataset, 'steel-sword'), ...overrides };
}

describe('optimizer cross-product stress', () => {
  it.each(paths.flatMap((path) => goals.map((goal) => [path, goal] as const)))(
    '%s / %s returns only eligible verified advice',
    (weaponPath, goal) => {
      const dataset = buildStressDataset();
      const profile = buildStressProfile({
        weaponPath,
        goal,
        datasetVersion: dataset.version,
      });
      const plan = optimizeBuild(profile, dataset);

      expect(() => assertRecommendationInvariants(plan, profile, dataset)).not.toThrow();
    },
  );

  it.each([
    ['level immediately below', { level: 2 }, { levelRequirement: 3 }, 'keep-current', undefined, ['steel-sword'], false],
    ['level at requirement', { level: 3 }, { levelRequirement: 3 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
    ['level immediately above', { level: 4 }, { levelRequirement: 3 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
    ['floor immediately below', { maxFloor: 1 }, { floor: 2 }, 'keep-current', undefined, [], undefined],
    ['floor at requirement', { maxFloor: 2 }, { floor: 2 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
    ['floor immediately above', { maxFloor: 3 }, { floor: 2 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
    ['weapon skill immediately below', { weaponSkill: 4 }, { skillRequirement: 5 }, 'keep-current', undefined, ['steel-sword'], false],
    ['weapon skill at requirement', { weaponSkill: 5 }, { skillRequirement: 5 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
    ['weapon skill immediately above', { weaponSkill: 6 }, { skillRequirement: 5 }, 'obtain-upgrade', 'steel-sword', ['steel-sword'], true],
  ] as const)(
    '%s preserves the literal steel-sword eligibility outcome',
    (
      _caseName,
      profileOverrides,
      itemOverrides,
      actionKind,
      actionItemId,
      targetIds,
      targetImmediate,
    ) => {
      const historical = buildHistoricalStressDataset();
      const dataset = boundaryDataset(steelSword(historical, itemOverrides));
      const profile = boundaryProfile(dataset, profileOverrides);
      const plan = optimizeBuild(profile, dataset);

      expect(plan.immediateAction.kind).toBe(actionKind);
      if (actionItemId) {
        expect(plan.immediateAction).toMatchObject({ itemId: actionItemId });
      }
      expect(plan.upgradeTargets.map((target) => target.itemId)).toEqual(targetIds);
      if (targetImmediate !== undefined) {
        expect(plan.upgradeTargets).toMatchObject([
          { itemId: 'steel-sword', immediate: targetImmediate },
        ]);
      }
      expect(() => assertRecommendationInvariants(plan, profile, dataset)).not.toThrow();
    },
  );

  it('equips a verified canonical inactive-event item when it is already owned', () => {
    const historical = buildHistoricalStressDataset();
    const dataset = boundaryDataset(
      steelSword(historical, { availability: 'inactive-event' }),
    );
    const profile = boundaryProfile(dataset, { ownedItemIds: ['steel-sword'] });
    const plan = optimizeBuild(profile, dataset);

    expect(plan.immediateAction).toMatchObject({
      kind: 'equip-owned',
      itemId: 'steel-sword',
    });
    expect(plan.upgradeTargets).toMatchObject([
      { itemId: 'steel-sword', immediate: true },
    ]);
    expect(() => assertRecommendationInvariants(plan, profile, dataset)).not.toThrow();
  });

  it('keeps a verified canonical skill-gated item as a future target when weapon skill is omitted', () => {
    const historical = buildHistoricalStressDataset();
    const dataset = boundaryDataset(steelSword(historical));
    const { weaponSkill: _weaponSkill, ...profileWithoutWeaponSkill } =
      boundaryProfile(dataset);
    const plan = optimizeBuild(profileWithoutWeaponSkill, dataset);

    expect(plan.immediateAction.kind).toBe('keep-current');
    expect(plan.upgradeTargets).toMatchObject([
      { itemId: 'steel-sword', immediate: false },
    ]);
    expect(() => assertRecommendationInvariants(plan, profileWithoutWeaponSkill, dataset)).not.toThrow();
  });

  it('uses the exact verified historical release version for recommendations', () => {
    const dataset = buildHistoricalStressDataset();
    const profile = boundaryProfile(dataset);
    const plan = optimizeBuild(profile, dataset);

    expect(dataset.version).toBe('2026.08.29.1');
    expect(profile.datasetVersion).toBe('2026.08.29.1');
    expect(plan.datasetVersion).toBe('2026.08.29.1');
    expect(plan.immediateAction).toMatchObject({
      kind: 'obtain-upgrade',
      itemId: 'steel-sword',
    });
    expect(() => assertRecommendationInvariants(plan, profile, dataset)).not.toThrow();
  });

  it('serializes 1,000 identical optimizer runs deterministically', () => {
    const dataset = buildHistoricalStressDataset();
    const profile = boundaryProfile(dataset);
    const startedAt = performance.now();
    const expected = JSON.stringify(optimizeBuild(profile, dataset));

    for (let run = 2; run <= 1_000; run += 1) {
      expect(JSON.stringify(optimizeBuild(profile, dataset))).toBe(expected);
    }

    process.stdout.write(
      `[optimizer stress] 1,000 identical serialized runs in ${(performance.now() - startedAt).toFixed(1)}ms\n`,
    );
  });
});
