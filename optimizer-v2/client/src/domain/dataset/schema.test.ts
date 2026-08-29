import { describe, expect, it } from 'vitest';
import {
  datasetSnapshotSchema,
  equipmentRecordSchema,
} from './schema';

const sourceUrl = 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats';

const formulaIds = [
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
] as const;

const formulas = formulaIds.map((id) => ({
  id,
  expression: `${id} expression`,
  units: 'index',
  applicability: 'all players',
  boundaryBehavior: 'caps at 500 invested points where applicable',
  sourceUrl,
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified' as const,
}));

describe('equipmentRecordSchema', () => {
  it('requires provenance for verified equipment', () => {
    expect(() =>
      equipmentRecordSchema.parse({
        id: 'iron-dagger',
        name: 'Iron Dagger',
        slot: 'main-hand',
        weaponPaths: ['dagger'],
        attack: 2.5,
        defense: 0,
        dexterity: 0,
        levelRequirement: 1,
        skillRequirement: 1,
        floor: 1,
        acquisitionType: 'starter',
        acquisitionDetail: 'Starter Inventory',
        availability: 'always',
        verificationStatus: 'verified',
        lastReviewedAt: '2026-08-29',
      }),
    ).toThrow();
  });

  it('rejects weapons without a compatible path', () => {
    expect(() =>
      equipmentRecordSchema.parse({
        id: 'orphan-weapon',
        name: 'Orphan Weapon',
        slot: 'main-hand',
        weaponPaths: [],
        attack: 1,
        defense: 0,
        dexterity: 0,
        levelRequirement: 1,
        floor: 1,
        acquisitionType: 'starter',
        acquisitionDetail: 'Starter Inventory',
        availability: 'always',
        sourceUrl,
        verificationStatus: 'verified',
        lastReviewedAt: '2026-08-29',
      }),
    ).toThrow('weapon equipment requires a compatible path');
  });
});

describe('datasetSnapshotSchema', () => {
  it('accepts each required verified formula exactly once', () => {
    const dataset = datasetSnapshotSchema.parse({
      version: 'bootstrap-1',
      publishedAt: '2026-08-29T00:00:00.000Z',
      lastReviewedAt: '2026-08-29',
      sourceSummary: 'Reviewed wiki snapshot',
      formulaSetVersion: 'sbor-stats-v1',
      pointsPerLevel: 3,
      formulas,
      equipment: [],
    });

    expect(dataset.formulas).toHaveLength(9);
  });

  it('rejects duplicate formula identifiers', () => {
    expect(() =>
      datasetSnapshotSchema.parse({
        version: 'bootstrap-1',
        publishedAt: '2026-08-29T00:00:00.000Z',
        lastReviewedAt: '2026-08-29',
        sourceSummary: 'Reviewed wiki snapshot',
        formulaSetVersion: 'sbor-stats-v1',
        pointsPerLevel: 3,
        formulas: [...formulas.slice(0, 8), formulas[0]],
        equipment: [],
      }),
    ).toThrow('all formula IDs must appear exactly once');
  });
});
