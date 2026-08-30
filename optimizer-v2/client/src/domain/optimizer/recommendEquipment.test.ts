import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../dataset/model';
import { recommendEquipment } from './recommendEquipment';

const sourceUrl = 'https://swordbloxonlinerebirth.fandom.com/wiki/Armor';

function equipment(
  overrides: Partial<EquipmentRecord> & Pick<EquipmentRecord, 'id' | 'name' | 'slot'>,
): EquipmentRecord {
  return {
    weaponPaths: [],
    attack: 0,
    defense: 0,
    dexterity: 0,
    levelRequirement: 1,
    floor: 1,
    acquisitionType: 'shop',
    acquisitionDetail: 'Floor 1 Shop',
    availability: 'always',
    sourceUrl,
    lastReviewedAt: '2026-08-29',
    verificationStatus: 'verified',
    ...overrides,
  };
}

const currentSword = equipment({
  id: 'iron-greatsword',
  name: 'Iron Greatsword',
  slot: 'main-hand',
  weaponPaths: ['two-handed'],
  attack: 3,
  skillRequirement: 1,
});
const currentArmor = equipment({
  id: 'beginner-armor',
  name: 'Beginner Armor',
  slot: 'armor',
  defense: 0.5,
  dexterity: 3,
  acquisitionType: 'starter',
  acquisitionDetail: 'Starter Inventory',
});
const steelGreatsword = equipment({
  id: 'steel-greatsword',
  name: 'Steel Greatsword',
  slot: 'main-hand',
  weaponPaths: ['two-handed'],
  attack: 10,
  skillRequirement: 5,
  sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed',
});
const fieldsWarrior = equipment({
  id: 'fields-warrior',
  name: 'Fields Warrior',
  slot: 'armor',
  defense: 1.5,
  dexterity: 6,
  levelRequirement: 3,
});
const upperHead = equipment({
  id: 'training-circlet',
  name: 'Training Circlet',
  slot: 'upper-head',
  dexterity: 2,
});

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'profile-1',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 5,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': currentSword.id,
    armor: currentArmor.id,
  },
  ownedItemIds: [],
  datasetVersion: 'test-release',
};

function dataset(equipmentRows: EquipmentRecord[]): DatasetSnapshot {
  return {
    version: 'test-release',
    publishedAt: '2026-08-29T00:00:00.000Z',
    lastReviewedAt: '2026-08-29',
    sourceSummary: 'Test data',
    formulaSetVersion: 'sbor-stats-v1',
    pointsPerLevel: 3,
    formulas: [],
    equipment: equipmentRows,
  };
}

describe('recommendEquipment', () => {
  it('makes a qualifying owned upgrade the immediate action', () => {
    const result = recommendEquipment(
      { ...profile, ownedItemIds: [steelGreatsword.id] },
      dataset([currentSword, currentArmor, steelGreatsword]),
    );

    expect(result.immediateAction).toEqual({
      kind: 'equip-owned',
      itemId: steelGreatsword.id,
      summary: 'Equip Steel Greatsword now',
    });
  });

  it('uses the strongest obtainable improvement when no owned upgrade qualifies', () => {
    const result = recommendEquipment(
      { ...profile, goal: 'damage' },
      dataset([currentSword, currentArmor, steelGreatsword, fieldsWarrior]),
    );

    expect(result.immediateAction).toEqual({
      kind: 'obtain-upgrade',
      itemId: steelGreatsword.id,
      summary: 'Obtain Steel Greatsword next',
    });
  });

  it('returns no more than three targets with distinct slots', () => {
    const result = recommendEquipment(
      { ...profile, goal: 'damage' },
      dataset([
        currentSword,
        currentArmor,
        steelGreatsword,
        fieldsWarrior,
        upperHead,
      ]),
    );

    expect(result.upgradeTargets).toHaveLength(3);
    expect(new Set(result.upgradeTargets.map((target) => target.slot)).size).toBe(3);
  });

  it('does not recommend a tradeoff whose losses outweigh its gain', () => {
    const durableArmor = equipment({
      id: 'durable-armor',
      name: 'Durable Armor',
      slot: 'armor',
      defense: 10,
      dexterity: 10,
    });
    const brittleArmor = equipment({
      id: 'brittle-armor',
      name: 'Brittle Armor',
      slot: 'armor',
      defense: 11,
      dexterity: 0,
    });

    const result = recommendEquipment(
      { ...profile, equipped: { armor: durableArmor.id } },
      dataset([durableArmor, brittleArmor]),
    );

    expect(result.immediateAction.kind).toBe('keep-current');
    expect(result.upgradeTargets).toEqual([]);
  });

  it('includes requirements, acquisition, provenance, and projected deltas', () => {
    const result = recommendEquipment(
      { ...profile, goal: 'damage' },
      dataset([currentSword, currentArmor, steelGreatsword]),
    );

    expect(result.upgradeTargets[0]).toEqual(
      expect.objectContaining({
        itemId: steelGreatsword.id,
        slot: 'main-hand',
        immediate: true,
        acquisitionDetail: 'Floor 1 Shop',
        requirementText: 'Level 1 · Weapon Skill 5',
        sourceUrl: steelGreatsword.sourceUrl,
        delta: expect.objectContaining({ attackPerHit: expect.any(Number) }),
      }),
    );
    expect(result.upgradeTargets[0]).not.toHaveProperty('eligibilityNote');
  });
});
