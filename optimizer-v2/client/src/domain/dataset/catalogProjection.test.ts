import { describe, expect, it } from 'vitest';
import type { CatalogEquipmentRecord } from './model';
import { projectCatalogForOptimizer } from './catalogProjection';

const sourceUrl =
  'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior';

function item(
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
        detail: 'Floor 1 Shop',
        floor: 1,
        cost: 1440,
        currency: 'Col',
        availability: 'always',
        accessType: 'free',
        sourceUrl,
        sourceRevision: '19884',
      },
    ],
    resistances: [],
    specialEffects: [],
    verificationStatus: 'verified',
    sourceUrl,
    sourceRevision: '19884',
    lastReviewedAt: '2026-08-30',
    ...overrides,
  };
}

describe('projectCatalogForOptimizer', () => {
  it('projects complete verified records with an explicit progression floor', () => {
    expect(projectCatalogForOptimizer([item()])).toEqual([
      expect.objectContaining({
        id: 'fields-warrior',
        floor: 1,
        sourceUrl,
        verificationStatus: 'verified',
      }),
    ]);
  });

  it('excludes an acquisition whose floor is unknown instead of treating it as Floor 1', () => {
    const unknownFloor = item({
      id: 'boss-armor',
      acquisitions: [
        {
          ...item().acquisitions[0]!,
          id: 'boss-armor:acquisition:0',
          type: 'boss-drop',
          detail: 'Unknown Boss',
          floor: undefined,
        },
      ],
    });

    expect(projectCatalogForOptimizer([unknownFloor])).toEqual([]);
  });
});
