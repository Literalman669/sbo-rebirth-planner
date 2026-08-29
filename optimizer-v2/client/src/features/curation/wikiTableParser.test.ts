import { describe, expect, it } from 'vitest';
import {
  parseArmorListPage,
  parseStatsPage,
  parseWeaponListPage,
} from './wikiTableParser';
import armorFixture from './fixtures/armor.wikitext?raw';
import daggerFixture from './fixtures/dagger.wikitext?raw';
import statsFixture from './fixtures/stats.wikitext?raw';

const fixtures = {
  armor: armorFixture,
  dagger: daggerFixture,
  stats: statsFixture,
};
const fixture = (name: keyof typeof fixtures) => fixtures[name];

describe('parseStatsPage', () => {
  it('extracts only the eight formulas stated by the current Stats revision', () => {
    const result = parseStatsPage(fixture('stats'));

    expect(result.map((proposal) => proposal.value.id)).toEqual([
      'attack-from-str',
      'damage-reduction-from-def',
      'bonus-hp-from-vit',
      'stamina',
      'walk-speed-from-agi',
      'sprint-speed-from-agi',
      'crit-bonus-from-luk',
      'drop-bonus-from-luk',
    ]);
    expect(result.warnings).toContain(
      'The canonical source does not state points awarded per level',
    );
  });

  it('adds points-per-level only when an explicit three-point rule exists', () => {
    const result = parseStatsPage(
      `${fixture('stats')}\nPlayers receive 3 stat points per level.`,
    );

    expect(result.map((proposal) => proposal.value.id)).toContain(
      'points-per-level',
    );
  });
});

describe('parseWeaponListPage', () => {
  it('extracts the verified Iron Dagger starter row', () => {
    const result = parseWeaponListPage('Dagger', fixture('dagger'));

    expect(result).toHaveLength(1);
    expect(result[0]?.value).toMatchObject({
      id: 'iron-dagger',
      name: 'Iron Dagger',
      slot: 'main-hand',
      weaponPaths: ['dagger'],
      attack: 2.5,
      levelRequirement: 1,
      skillRequirement: 1,
      floor: 1,
      acquisitionType: 'starter',
      acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
      verificationStatus: 'candidate',
    });
  });

  it('warns and excludes ambiguous numeric rows', () => {
    const ambiguous = fixture('dagger').replace('|2.5', '|2.5 - 4.0');
    const result = parseWeaponListPage('Dagger', ambiguous);

    expect(result).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/ambiguous attack/i);
  });

  it('warns and excludes unrecognized acquisition text', () => {
    const ambiguous = fixture('dagger').replace(
      'Starter Inventory, [[Shops#Floor 1 Shop|Floor 1 Shop]]',
      'Ask around town',
    );
    const result = parseWeaponListPage('Dagger', ambiguous);

    expect(result).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/acquisition/i);
  });
});

describe('parseArmorListPage', () => {
  it('extracts Beginner Armor with starter and shop acquisition', () => {
    const result = parseArmorListPage(fixture('armor'));

    expect(result).toHaveLength(1);
    expect(result[0]?.value).toMatchObject({
      id: 'beginner-armor',
      name: 'Beginner Armor',
      slot: 'armor',
      weaponPaths: [],
      defense: 0.5,
      dexterity: 3,
      levelRequirement: 1,
      floor: 1,
      acquisitionType: 'starter',
      acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
      verificationStatus: 'candidate',
    });
  });

  it('warns and excludes malformed table rows', () => {
    const malformed = fixture('armor').replace('|3\n|Starter', '|unknown\n|Starter');
    const result = parseArmorListPage(malformed);

    expect(result).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/invalid dexterity/i);
  });
});
