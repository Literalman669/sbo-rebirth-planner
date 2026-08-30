import { describe, expect, it } from 'vitest';
import daggerFixture from '../../features/curation/fixtures/dagger.wikitext?raw';
import type { WikiPageSnapshot } from './model';
import { parseEquipmentSnapshot } from './equipmentParser';

function snapshot(
  pageTitle: string,
  content: string,
  overrides: Partial<WikiPageSnapshot> = {},
): WikiPageSnapshot {
  return {
    pageId: 1,
    pageTitle,
    sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
    revisionId: '26212',
    revisionTimestamp: '2026-06-21T05:38:53Z',
    contentHash: 'sha256:test',
    content,
    ...overrides,
  };
}

describe('parseEquipmentSnapshot', () => {
  it('normalizes a list-table row with pinned acquisition evidence', () => {
    const result = parseEquipmentSnapshot(snapshot('Dagger', daggerFixture));

    expect(result.unresolved).toEqual([]);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0]).toMatchObject({
      id: 'iron-dagger',
      attack: 2.5,
      verificationStatus: 'verified',
      sourceRevision: '26212',
      acquisitions: [
        expect.objectContaining({
          id: 'iron-dagger:acquisition:0',
          type: 'starter',
          accessType: 'free',
          sourceRevision: '26212',
        }),
      ],
    });
  });

  it('keeps malformed list data explicitly unresolved', () => {
    const malformed = daggerFixture.replace('|2.5', '|unknown');
    const result = parseEquipmentSnapshot(snapshot('Dagger', malformed));

    expect(result.equipment).toEqual([]);
    expect(result.unresolved[0]?.reason).toMatch(/invalid or ambiguous attack/i);
  });

  it('normalizes a shield item infobox', () => {
    const content = [
      '{{Equipment',
      '|Equipment Type=Shields',
      '|Level Requirement=1',
      '|Defense=0.6',
      '|How to Obtain=Starter Inventory, Floor 1 Shop',
      '}}',
    ].join('\n');
    const result = parseEquipmentSnapshot(snapshot('Wooden Shield', content));

    expect(result.equipment[0]).toMatchObject({
      id: 'wooden-shield',
      slot: 'shield',
      defense: 0.6,
      weaponPaths: ['one-handed', 'rapier', 'dagger'],
      verificationStatus: 'verified',
    });
  });

  it('normalizes compact underscored armor fields with a sourced Col value', () => {
    const content = [
      '{{Armor',
      '  | title1=Fields Warrior',
      '  | level_req=Level 3',
      '  | defense=1.5',
      '  | dexterity=6',
      '  |equipment_type=[[Armor]]|worth=1,440 Col|can_be_sold=✔|how_to_obtain=[[Shops#Floor 1 Shop|Floor 1 Shop]]}}',
    ].join('\n');
    const result = parseEquipmentSnapshot(snapshot('Fields Warrior', content));

    expect(result.unresolved).toEqual([]);
    expect(result.equipment[0]).toMatchObject({
      id: 'fields-warrior',
      slot: 'armor',
      defense: 1.5,
      dexterity: 6,
      levelRequirement: 3,
      verificationStatus: 'verified',
      sourceUrl:
        'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior',
      acquisitions: [
        expect.objectContaining({
          type: 'shop',
          floor: 1,
          cost: 1440,
          currency: 'Col',
        }),
      ],
    });
  });

  it('reads the minimum Fists values without swallowing page content after the infobox', () => {
    const content = [
      '{{Weapon',
      '  | weapon_type=[[Melee|Melee]]',
      "  | skill_level= Skill 1 '''[Min]'''",
      "Skill 30 '''[Max]'''",
      "  | damage= 2.5 '''[Min]'''",
      "40 '''[Max]'''",
      '  | location= Starter Inventory',
      '}}',
      '== Weapon Information ==',
      'The starting Melee weapon every player begins with.',
    ].join('\n');
    const result = parseEquipmentSnapshot(snapshot('Fists', content));

    expect(result.equipment[0]).toMatchObject({
      id: 'fists',
      attack: 2.5,
      skillRequirement: 1,
      acquisitions: [
        expect.objectContaining({ detail: 'Starter Inventory' }),
      ],
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Fists',
    });
    expect(result.equipment[0]?.acquisitions[0]?.detail).not.toContain(
      'Weapon Information',
    );
  });

  it('classifies gamepass access instead of ordinary free acquisition', () => {
    const content = [
      '{{Equipment',
      '|Equipment Type=One Handed',
      '|Max Skill=290',
      '|Attack Damage=1500',
      '|How to Obtain=Blue Swordsman Gamepass',
      '}}',
    ].join('\n');
    const result = parseEquipmentSnapshot(snapshot('Blue Rose Sword', content));

    expect(result.equipment[0]?.acquisitions[0]).toMatchObject({
      type: 'gamepass',
      availability: 'gamepass',
      accessType: 'gamepass',
    });
  });

  it('keeps event availability and a sourced price out of permanent-free access', () => {
    const content = [
      '{{Equipment',
      '|Equipment Type=Armor',
      '|Level=10',
      '|Defense Stat=5',
      '|Dexterity Stat=12',
      '|How to Obtain=Summer Event Shop, 2,500 Col',
      '}}',
    ].join('\n');
    const result = parseEquipmentSnapshot(snapshot('Summer Guard', content));

    expect(result.equipment[0]?.acquisitions[0]).toMatchObject({
      type: 'event',
      availability: 'inactive-event',
      accessType: 'event',
      cost: 2500,
      currency: 'Col',
    });
  });

  it('accounts for an unfamiliar item layout without inventing a record', () => {
    const result = parseEquipmentSnapshot(
      snapshot('Mystery Helm', 'This page has no supported equipment infobox.'),
    );

    expect(result.equipment).toEqual([]);
    expect(result.unresolved).toEqual([
      {
        pageTitle: 'Mystery Helm',
        reason: 'Unsupported or missing equipment type in item infobox',
      },
    ]);
  });

  it('records a redirect title as an alias without assuming a duplicate item', () => {
    const content = [
      '{{Equipment',
      '|Equipment Type=Armor',
      '|Level=1',
      '|Defense Stat=0.5',
      '|Dexterity Stat=3',
      '|How to Obtain=Starter Inventory',
      '}}',
    ].join('\n');
    const result = parseEquipmentSnapshot(
      snapshot('Beginner Blue', content, { redirectTarget: 'Beginner Armor' }),
    );

    expect(result.aliases).toEqual([
      {
        alias: 'Beginner Blue',
        itemId: 'beginner-armor',
        sourceLine: 'Redirects to Beginner Armor',
      },
    ]);
  });
});
