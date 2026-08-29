import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../dataset/model';
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
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified',
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
  pointsPerLevel: 3,
  formulas: [],
  equipment: [sword],
};

describe('optimizeBuild', () => {
  it('returns a deterministic thirty-point plan tied to the dataset version', () => {
    const result = optimizeBuild(profile, dataset);

    expect(result.datasetVersion).toBe('test-release');
    expect(result.statPlan.totalPoints).toBe(30);
    expect(Object.values(result.statPlan.added).reduce((sum, value) => sum + value, 0)).toBe(30);
    expect(result).toEqual(optimizeBuild(profile, dataset));
  });
});
