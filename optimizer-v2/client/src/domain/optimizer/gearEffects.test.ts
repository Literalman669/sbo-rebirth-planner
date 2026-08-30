import { describe, expect, it } from 'vitest';
import type { CatalogEquipmentRecord } from '../dataset/model';
import { aggregateGearEffects, compareGearEffects } from './gearEffects';

function item(
  overrides: Partial<CatalogEquipmentRecord> &
    Pick<CatalogEquipmentRecord, 'id' | 'name' | 'slot'>,
): CatalogEquipmentRecord {
  return {
    aliases: [],
    weaponPaths: [],
    attack: 0,
    defense: 0,
    dexterity: 0,
    levelRequirement: 1,
    acquisitions: [{
      id: `${overrides.id}:source`,
      type: 'shop',
      detail: 'Floor 1 Shop',
      floor: 1,
      availability: 'always',
      accessType: 'free',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Armor',
      sourceRevision: '26210',
    }],
    resistances: [],
    specialEffects: [],
    verificationStatus: 'verified',
    sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Armor',
    sourceRevision: '26210',
    lastReviewedAt: '2026-08-30',
    ...overrides,
  };
}

describe('gear effects', () => {
  it('aggregates armor, shield, and headwear stats and resistances', () => {
    const equipment = new Map([
      ['armor', item({ id: 'armor', name: 'Armor', slot: 'armor', defense: 5, dexterity: 10, resistances: [{ status: 'Poison', percent: 40, sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Armor', sourceRevision: '26210' }] })],
      ['shield', item({ id: 'shield', name: 'Shield', slot: 'shield', defense: 2 })],
      ['upper', item({ id: 'upper', name: 'Upper', slot: 'upper-head', defense: 1, dexterity: 3, resistances: [{ status: 'Poison', percent: 20, sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Upper%20Headwear', sourceRevision: '26210' }] })],
    ] as const);

    expect(
      aggregateGearEffects(
        { armor: 'armor', shield: 'shield', 'upper-head': 'upper' },
        equipment,
      ),
    ).toEqual({
      attack: 0,
      defense: 8,
      dexterity: 13,
      resistances: { Poison: 60 },
      descriptiveEffects: [],
      unsupportedNumericFields: [],
    });
  });

  it('preserves unknown numeric fields and descriptive effects', () => {
    const mystery = item({
      id: 'mystery',
      name: 'Mystery Helm',
      slot: 'upper-head',
      defense: null,
      specialEffects: ['Shortens stun duration'],
      verificationStatus: 'partial',
    });
    const result = aggregateGearEffects(
      { 'upper-head': 'mystery' },
      new Map([['mystery', mystery]]),
    );

    expect(result.defense).toBe(0);
    expect(result.unsupportedNumericFields).toEqual(['mystery:defense']);
    expect(result.descriptiveEffects).toEqual(['Shortens stun duration']);
  });

  it('compares raw gear changes without scoring descriptive effects', () => {
    const current = item({ id: 'current', name: 'Current', slot: 'armor', defense: 1, dexterity: 3 });
    const target = item({ id: 'target', name: 'Target', slot: 'armor', defense: 2, dexterity: 5, specialEffects: ['Source-described aura'] });
    const comparison = compareGearEffects(current, target);

    expect(comparison.rawDelta).toEqual({
      attack: 0,
      defense: 1,
      dexterity: 2,
      resistances: {},
    });
    expect(comparison.unmodeledEffects).toEqual(['Source-described aura']);
  });
});
