import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../dataset/model';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { optimizeBuild } from './optimizeBuild';

const sword: EquipmentRecord = {
  id: 'iron-greatsword',
  name: 'Iron Greatsword',
  slot: 'main-hand',
  weaponPaths: ['two-handed'],
  attack: 3,
  defense: 0,
  dexterity: 0,
  levelRequirement: 1,
  skillRequirement: 1,
  floor: 1,
  acquisitionType: 'starter',
  acquisitionDetail: 'Starter Inventory',
  availability: 'always',
  sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed',
  sourceRevision: '26187',
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified',
};

const steelGreatsword: EquipmentRecord = {
  ...sword,
  id: 'steel-greatsword',
  name: 'Steel Greatsword',
  attack: 10,
  skillRequirement: 5,
  acquisitionType: 'shop',
  acquisitionDetail: 'Floor 1 Shop',
};

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'profile-1',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 1,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: { 'main-hand': sword.id },
  ownedItemIds: [],
  datasetVersion: 'test-release',
};

const dataset: DatasetSnapshot = {
  version: 'test-release',
  publishedAt: '2026-08-29T00:00:00.000Z',
  lastReviewedAt: '2026-08-29',
  sourceSummary: 'Test data',
  formulaSetVersion: 'sbor-stats-v1',
  strategyPolicyVersion: 'sbor-policy-v1',
  pointsPerLevel: 3,
  formulas: [],
  mechanics: bootstrapRelease.mechanics,
  catalog: [],
  equipment: [sword],
};

describe('optimizeBuild', () => {
  it('rejects an overspent profile before producing recommendations', () => {
    expect(() =>
      optimizeBuild(
        { ...profile, stats: { str: 15, def: 0, agi: 3, vit: 7, luk: 0 } },
        dataset,
      ),
    ).toThrowError(
      'Invested stats exceed the available point budget by 1.',
    );
  });

  it('rejects a profile with fewer than thirty open stat slots', () => {
    expect(() =>
      optimizeBuild(
        {
          ...profile,
          level: 834,
          stats: { str: 500, def: 500, agi: 500, vit: 500, luk: 500 },
        },
        dataset,
      ),
    ).toThrowError(
      'Current unspent points and the next ten levels require 32 open stat slots, but only 0 remain.',
    );
  });

  it('reserves capacity for current unspent points before the future plan', () => {
    expect(() =>
      optimizeBuild(
        {
          ...profile,
          level: 834,
          stats: { str: 500, def: 500, agi: 500, vit: 500, luk: 460 },
        },
        dataset,
      ),
    ).toThrowError(
      'Current unspent points and the next ten levels require 72 open stat slots, but only 40 remain.',
    );
  });

  it('returns a deterministic thirty-point plan tied to the dataset version', () => {
    const result = optimizeBuild(profile, dataset);

    expect(result.datasetVersion).toBe('test-release');
    expect(result.statPlan.futurePoints).toBe(30);
    expect(Object.values(result.statPlan.futureAdded).reduce((sum, value) => sum + value, 0)).toBe(30);
    expect(result.statPlan.spendNow.points).toBe(0);
    expect(result.statPlan.levelRows).toHaveLength(10);
    expect(result).toEqual(optimizeBuild(profile, dataset));
  });

  it('keeps an upgrade with an omitted weapon skill out of the immediate action', () => {
    const result = optimizeBuild(
      { ...profile, weaponSkill: undefined },
      { ...dataset, equipment: [sword, steelGreatsword] },
    );

    expect(result.immediateAction.kind).toBe('keep-current');
    expect(result.upgradeTargets).toContainEqual(
      expect.objectContaining({
        itemId: steelGreatsword.id,
        immediate: false,
        eligibilityNote: 'Requires Weapon Skill 5; confirm in game',
      }),
    );
  });

  it('propagates combined future level and unknown skill requirements to upgrade targets', () => {
    const futureSteelGreatsword: EquipmentRecord = {
      ...steelGreatsword,
      id: 'future-steel-greatsword',
      name: 'Future Steel Greatsword',
      attack: 20,
      levelRequirement: 15,
      skillRequirement: 5,
    };
    const result = optimizeBuild(
      { ...profile, weaponSkill: undefined },
      { ...dataset, equipment: [sword, futureSteelGreatsword] },
    );

    expect(result.immediateAction.kind).toBe('keep-current');
    expect(result.upgradeTargets).toContainEqual(
      expect.objectContaining({
        itemId: futureSteelGreatsword.id,
        immediate: false,
        eligibilityNote:
          'Requires Level 15 · Requires Weapon Skill 5; confirm in game',
      }),
    );
  });

  it('turns current unspent points into an actionable allocation', () => {
    const result = optimizeBuild(
      { ...profile, stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 } },
      dataset,
    );

    expect(result.warnings).toEqual([]);
    expect(result.statPlan.spendNow.points).toBe(24);
    expect(
      Object.values(result.statPlan.spendNow.added).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(24);
    expect(result.statPlan.futurePoints).toBe(30);
  });
});
