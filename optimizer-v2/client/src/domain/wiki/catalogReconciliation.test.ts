import { describe, expect, it } from 'vitest';
import type { CatalogEquipmentRecord } from '../dataset/model';
import type { ParsedCatalogPage } from './equipmentParser';
import type { WikiPageSnapshot } from './model';
import { reconcileCatalogPages } from './catalogReconciliation';

function page(pageTitle: string, revisionId: string): WikiPageSnapshot {
  return {
    pageId: Number(revisionId),
    pageTitle,
    sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
    revisionId,
    revisionTimestamp: '2026-08-30T00:00:00Z',
    contentHash: `sha256:${revisionId}`,
    content: 'fixture',
  };
}

function catalog(
  source: WikiPageSnapshot,
  overrides: Partial<CatalogEquipmentRecord> = {},
): CatalogEquipmentRecord {
  return {
    id: 'fields-warrior',
    name: 'Fields Warrior',
    aliases: [],
    slot: 'armor',
    weaponPaths: [],
    attack: 0,
    defense: 1.5,
    dexterity: 6,
    levelRequirement: 3,
    acquisitions: [
      {
        id: 'fields-warrior:acquisition:0',
        type: 'shop',
        detail: 'Floor 1 Shop, Floor 2 Shop',
        floor: 1,
        availability: 'always',
        accessType: 'free',
        sourceUrl: source.sourceUrl,
        sourceRevision: source.revisionId,
      },
    ],
    resistances: [],
    specialEffects: [],
    verificationStatus: 'verified',
    sourceUrl: source.sourceUrl,
    sourceRevision: source.revisionId,
    lastReviewedAt: '2026-08-30',
    ...overrides,
  };
}

function parsed(
  source: WikiPageSnapshot,
  equipment: CatalogEquipmentRecord[],
): ParsedCatalogPage {
  return { page: source, equipment, aliases: [], warnings: [], unresolved: [] };
}

describe('reconcileCatalogPages', () => {
  it('deduplicates list and item evidence while preferring the exact item page and verified value', () => {
    const listPage = page('Armor', '26210');
    const itemPage = page('Fields Warrior', '19884');
    const itemEvidence = catalog(itemPage, {
      levelRequirement: null,
      acquisitions: [
        {
          id: 'fields-warrior:acquisition:0',
          type: 'shop',
          detail: 'Floor 1 Shop',
          floor: 1,
          cost: 1440,
          currency: 'Col',
          availability: 'always',
          accessType: 'free',
          sourceUrl: itemPage.sourceUrl,
          sourceRevision: itemPage.revisionId,
        },
      ],
      verificationStatus: 'partial',
    });

    const result = reconcileCatalogPages([
      parsed(listPage, [catalog(listPage)]),
      parsed(itemPage, [itemEvidence]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'fields-warrior',
      levelRequirement: 3,
      verificationStatus: 'verified',
      sourceUrl:
        'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior',
      sourceRevision: '19884',
      acquisitions: [
        expect.objectContaining({
          detail: 'Floor 1 Shop, Floor 2 Shop',
          floor: 1,
          cost: 1440,
          currency: 'Col',
          sourceUrl:
            'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior',
        }),
      ],
    });
  });

  it('removes the legacy Floor 1 fallback when a drop source names no floor', () => {
    const bossPage = page('Boss Armor', '20000');
    const boss = catalog(bossPage, {
      id: 'boss-armor',
      name: 'Boss Armor',
      acquisitions: [
        {
          id: 'boss-armor:acquisition:0',
          type: 'boss-drop',
          detail: 'Unknown Boss',
          floor: 1,
          availability: 'always',
          accessType: 'free',
          sourceUrl: bossPage.sourceUrl,
          sourceRevision: bossPage.revisionId,
        },
      ],
    });

    const [result] = reconcileCatalogPages([parsed(bossPage, [boss])]);

    expect(result?.acquisitions[0]?.floor).toBeUndefined();
  });

  it('does not mark an impossible Level 0 source row optimizer-verified', () => {
    const source = page('Level Zero Item', '20001');
    const zero = catalog(source, {
      id: 'level-zero-item',
      name: 'Level Zero Item',
      levelRequirement: 0,
    });

    const [result] = reconcileCatalogPages([parsed(source, [zero])]);

    expect(result?.verificationStatus).toBe('partial');
  });

  it('uses item-page minimum combat values while filling its missing level from the list', () => {
    const listPage = page('Melee', '22893');
    const itemPage = page('Fists', '21749');
    const list = catalog(listPage, {
      id: 'fists',
      name: 'Fists',
      slot: 'main-hand',
      weaponPaths: ['melee'],
      attack: 40,
      defense: 0,
      dexterity: 0,
      levelRequirement: 1,
      skillRequirement: 30,
    });
    const exact = catalog(itemPage, {
      ...list,
      attack: 2.5,
      levelRequirement: null,
      skillRequirement: 1,
      sourceUrl: itemPage.sourceUrl,
      sourceRevision: itemPage.revisionId,
      verificationStatus: 'partial',
    });

    const [result] = reconcileCatalogPages([
      parsed(listPage, [list]),
      parsed(itemPage, [exact]),
    ]);

    expect(result).toMatchObject({
      attack: 2.5,
      levelRequirement: 1,
      skillRequirement: 1,
      verificationStatus: 'verified',
    });
  });
});
