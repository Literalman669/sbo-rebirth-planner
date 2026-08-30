import { describe, expect, it } from 'vitest';
import {
  parseArmorListPage,
  parseShieldListPage,
  parseStatsPage,
  parseWeaponListPage,
} from './wikiTableParser';
import armorFixture from './fixtures/armor.wikitext?raw';
import daggerFixture from './fixtures/dagger.wikitext?raw';
import statsFixture from './fixtures/stats.wikitext?raw';
import shieldsFixture from './fixtures/shields.wikitext?raw';

const fixtures = {
  armor: armorFixture,
  dagger: daggerFixture,
  stats: statsFixture,
  shields: shieldsFixture,
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

  const malformedTables = [
    {
      name: 'a row with a missing acquisition cell using LF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Skill Level',
        '!Attack Stat',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|1',
        '|2.5',
        '|}',
      ].join('\n'),
      warning: 'Malformed weapon row:',
    },
    {
      name: 'a nonnumeric attack stat using CRLF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Skill Level',
        '!Attack Stat',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|1',
        '|many',
        '|Starter Inventory',
        '|}',
      ].join('\r\n'),
      warning: 'Invalid or ambiguous attack:',
    },
    {
      name: 'a negative attack stat using LF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Skill Level',
        '!Attack Stat',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|1',
        '|-2.5',
        '|Starter Inventory',
        '|}',
      ].join('\n'),
      warning: 'Invalid or ambiguous attack:',
    },
    {
      name: 'duplicate Attack Stat headings using CRLF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Skill Level',
        '!Attack Stat',
        '!Attack Stat',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|1',
        '|2.5',
        '|2.5',
        '|Starter Inventory',
        '|}',
      ].join('\r\n'),
      warning: 'Expected weapon table headers were not found',
    },
    {
      name: 'changed column order using LF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Attack Stat',
        '!Skill Level',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|2.5',
        '|1',
        '|Starter Inventory',
        '|}',
      ].join('\n'),
      warning: 'Expected weapon table headers were not found',
    },
    {
      name: 'an unknown acquisition using CRLF',
      wikitext: [
        '{| class="wikitable"',
        '!Weapon Name',
        '!Skill Level',
        '!Attack Stat',
        '!How to Obtain',
        '|-',
        '|[[Iron Dagger]]',
        '|1',
        '|2.5',
        '|Ask around town',
        '|}',
      ].join('\r\n'),
      warning: 'Unrecognized acquisition:',
    },
  ] as const;

  it.each(malformedTables)(
    'warns and produces no proposal for $name',
    ({ wikitext, warning }) => {
      const result = parseWeaponListPage('Dagger', wikitext);

      expect(result).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(warning);
    },
  );

  it.each([
    { name: 'LF', newline: '\n' },
    { name: 'CRLF', newline: '\r\n' },
  ])('parses the same reviewed row with $name line endings', ({ newline }) => {
    const wikitext = [
      '{| class="wikitable"',
      '!Weapon Name',
      '!Skill Level',
      '!Attack Stat',
      '!How to Obtain',
      '|-',
      '|[[Iron Dagger]]',
      '|1',
      '|2.5',
      '|Starter Inventory, [[Shops#Floor 1 Shop|Floor 1 Shop]]',
      '|}',
    ].join(newline);

    const result = parseWeaponListPage('Dagger', wikitext);

    expect(result.warnings).toEqual([]);
    expect(result).toHaveLength(1);
    expect(result[0]?.value).toMatchObject({
      id: 'iron-dagger',
      attack: 2.5,
      skillRequirement: 1,
      acquisitionType: 'starter',
      acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
    });
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
    const malformed = fixture('armor').replace(
      /\|3\r?\n\|Starter/,
      '|unknown\n|Starter',
    );
    const result = parseArmorListPage(malformed);

    expect(result).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/invalid dexterity/i);
  });
});

describe('parseShieldListPage', () => {
  it('extracts the current four-column Wooden Shield row', () => {
    const result = parseShieldListPage(fixture('shields'));

    expect(result).toHaveLength(1);
    expect(result[0]?.value).toMatchObject({
      id: 'wooden-shield',
      slot: 'shield',
      weaponPaths: ['one-handed', 'rapier', 'dagger'],
      defense: 0.6,
      dexterity: 0,
      levelRequirement: 1,
      acquisitionType: 'starter',
    });
  });
});
