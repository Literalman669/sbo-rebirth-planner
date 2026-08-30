import { describe, expect, it } from 'vitest';
import {
  datasetSnapshotSchema,
  equipmentRecordSchema,
  formulaRecordSchema,
} from './schema';

const sourceUrl = 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats';
const gameUrl =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';

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
  sourceRevision: '23125',
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified' as const,
}));

const canonicalEquipment = {
  id: 'iron-dagger',
  name: 'Iron Dagger',
  slot: 'main-hand' as const,
  weaponPaths: ['dagger'],
  attack: 2.5,
  defense: 0,
  dexterity: 0,
  levelRequirement: 1,
  skillRequirement: 1,
  floor: 1,
  acquisitionType: 'starter' as const,
  acquisitionDetail: 'Starter Inventory',
  availability: 'always' as const,
  sourceUrl,
  sourceRevision: '23125',
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified' as const,
};

const canonicalFormula = {
  ...formulas[1]!,
  id: 'attack-from-str' as const,
};

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
        sourceRevision: '23125',
        verificationStatus: 'verified',
        lastReviewedAt: '2026-08-29',
      }),
    ).toThrow('weapon equipment requires a compatible path');
  });

  it.each([
    ['an arbitrary HTTPS host', 'https://example.com/equipment'],
    ['a lookalike Fandom host', 'https://swordbloxonlinerebirth.fandom.co/wiki/Dagger'],
    ['a noncanonical wiki query', `${sourceUrl}?so=search`],
    ['the official game URL', gameUrl],
  ])('rejects verified equipment from %s', (_label, invalidSourceUrl) => {
    expect(
      equipmentRecordSchema.safeParse({
        ...canonicalEquipment,
        sourceUrl: invalidSourceUrl,
      }).success,
    ).toBe(false);
  });

  it.each([undefined, '', '   '])(
    'rejects verified equipment without a nonblank source revision',
    (sourceRevision) => {
      expect(
        equipmentRecordSchema.safeParse({
          ...canonicalEquipment,
          sourceRevision,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ['a provisional revision', 'pending-review'],
    ['an owner attestation', 'owner-gameplay-attestation:2026-08-29'],
    ['a signed revision', '+23125'],
    ['a negative revision', '-23125'],
    ['a decimal revision', '23125.5'],
    ['a zero revision', '0'],
    ['a whitespace-padded revision', ' 23125 '],
  ])('rejects canonical wiki equipment with %s', (_label, sourceRevision) => {
    expect(() =>
      equipmentRecordSchema.parse({ ...canonicalEquipment, sourceRevision }),
    ).toThrow(/MediaWiki revision/);
  });

  it.each([
    ['a raw dot segment', 'https://swordbloxonlinerebirth.fandom.com/wiki/..'],
    ['an encoded dot segment', 'https://swordbloxonlinerebirth.fandom.com/wiki/%2e%2e'],
    ['a root-normalizing path', 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats/..'],
    ['a credentialed URL', 'https://user@swordbloxonlinerebirth.fandom.com/wiki/Stats'],
    ['a default port URL', 'https://swordbloxonlinerebirth.fandom.com:443/wiki/Stats'],
    ['a fragment URL', `${sourceUrl}#revision`],
    ['a noncanonical percent-encoded page token', 'https://swordbloxonlinerebirth.fandom.com/wiki/%53tats'],
  ])('rejects equipment with %s', (_label, invalidSourceUrl) => {
    expect(() =>
      equipmentRecordSchema.parse({
        ...canonicalEquipment,
        sourceUrl: invalidSourceUrl,
      }),
    ).toThrow(/canonical wiki/);
  });
});

describe('formulaRecordSchema', () => {
  it.each([
    ['an arbitrary HTTPS host', 'https://example.com/formulas', '23125'],
    ['a noncanonical wiki path', 'https://swordbloxonlinerebirth.fandom.com/Stats', '23125'],
    ['the game URL for a non-points formula', gameUrl, 'owner-gameplay-attestation:2026-08-29'],
  ])('rejects %s', (_label, invalidSourceUrl, sourceRevision) => {
    expect(
      formulaRecordSchema.safeParse({
        ...canonicalFormula,
        sourceUrl: invalidSourceUrl,
        sourceRevision,
      }).success,
    ).toBe(false);
  });

  it.each([undefined, '', '   '])(
    'rejects formulas without a nonblank source revision',
    (sourceRevision) => {
      expect(
        formulaRecordSchema.safeParse({
          ...canonicalFormula,
          sourceRevision,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ['a provisional wiki revision', 'pending-review'],
    ['a misapplied owner attestation on a wiki source', 'owner-gameplay-attestation:2026-08-29'],
  ])('rejects points-per-level with %s', (_label, sourceRevision) => {
    expect(() =>
      formulaRecordSchema.parse({
        ...canonicalFormula,
        id: 'points-per-level',
        sourceRevision,
      }),
    ).toThrow(/formula must have canonical verified provenance/);
  });

  it.each([
    ['a missing attestation', undefined],
    ['a numeric revision instead of an attestation', '23125'],
    ['a provisional attestation', 'pending-review'],
    ['an impossible attestation date', 'owner-gameplay-attestation:2026-02-30'],
  ])('rejects points-per-level official game provenance with %s', (_label, sourceRevision) => {
    expect(() =>
      formulaRecordSchema.parse({
        ...canonicalFormula,
        id: 'points-per-level',
        sourceUrl: gameUrl,
        sourceRevision,
      }),
    ).toThrow(/formula must have canonical verified provenance|source revision is required/);
  });

  it('accepts the exact game URL and a valid owner attestation for points per level', () => {
    expect(
      formulaRecordSchema.safeParse({
        ...canonicalFormula,
        id: 'points-per-level',
        sourceUrl: gameUrl,
        sourceRevision: 'owner-gameplay-attestation:2026-08-29',
      }).success,
    ).toBe(true);
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

  it('rejects a snapshot that changes the verified points-per-level rate', () => {
    expect(() =>
      datasetSnapshotSchema.parse({
        version: 'bootstrap-1',
        publishedAt: '2026-08-29T00:00:00.000Z',
        lastReviewedAt: '2026-08-29',
        sourceSummary: 'Reviewed wiki snapshot',
        formulaSetVersion: 'sbor-stats-v1',
        pointsPerLevel: 4,
        formulas,
        equipment: [],
      }),
    ).toThrow();
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

  it.each([
    ['an arbitrary HTTPS host', 'https://example.com/gaps'],
    ['a noncanonical wiki path', 'https://swordbloxonlinerebirth.fandom.com/Stats'],
    ['the official game URL', gameUrl],
  ])('rejects known gaps from %s', (_label, invalidSourceUrl) => {
    expect(
      datasetSnapshotSchema.safeParse({
        version: 'bootstrap-1',
        publishedAt: '2026-08-29T00:00:00.000Z',
        lastReviewedAt: '2026-08-29',
        sourceSummary: 'Reviewed wiki snapshot',
        formulaSetVersion: 'sbor-stats-v1',
        pointsPerLevel: 3,
        knownGaps: [
          {
            path: 'dagger',
            band: '1-49',
            reason: 'No source-supported entry was found.',
            sourceUrl: invalidSourceUrl,
            sourceRevision: '23125',
            lastReviewedAt: '2026-08-29',
            verificationStatus: 'verified',
          },
        ],
        formulas,
        equipment: [],
      }).success,
    ).toBe(false);
  });

  it.each([
    ['a provisional revision', 'pending-review'],
    ['an owner attestation', 'owner-gameplay-attestation:2026-08-29'],
  ])('rejects a known gap with %s', (_label, sourceRevision) => {
    expect(() =>
      datasetSnapshotSchema.parse({
        version: 'bootstrap-1',
        publishedAt: '2026-08-29T00:00:00.000Z',
        lastReviewedAt: '2026-08-29',
        sourceSummary: 'Reviewed wiki snapshot',
        formulaSetVersion: 'sbor-stats-v1',
        pointsPerLevel: 3,
        knownGaps: [
          {
            path: 'dagger',
            band: '1-49',
            reason: 'No source-supported entry was found.',
            sourceUrl,
            sourceRevision,
            lastReviewedAt: '2026-08-29',
            verificationStatus: 'verified',
          },
        ],
        formulas,
        equipment: [],
      }),
    ).toThrow(/MediaWiki revision/);
  });
});
