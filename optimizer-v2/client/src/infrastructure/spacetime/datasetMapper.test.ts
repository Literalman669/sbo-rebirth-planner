import { Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import { mapPublishedRelease, mapPublishedReleaseV2 } from './datasetMapper';

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
];
const version = '2026.08.29.1';
const publishedAt = Timestamp.fromDate(new Date('2026-08-29T12:00:00.000Z'));

function rows() {
  const sources = [
    {
      id: `${version}:iron-dagger`,
      releaseVersion: version,
      entityKind: 'equipment',
      entityId: 'iron-dagger',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Dagger',
      sourceRevision: '26212',
      capturedAt: '2026-06-21T05:38:53Z',
      lastReviewedAt: '2026-08-29',
    },
    ...formulaIds.map((formulaId) => ({
      id: `${version}:${formulaId}`,
      releaseVersion: version,
      entityKind: 'formula',
      entityId: formulaId,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      sourceRevision: '23125',
      capturedAt: '2025-11-03T13:14:55Z',
      lastReviewedAt: '2026-08-29',
    })),
  ];
  return {
    release: {
      version,
      formulaSetVersion: 'sbor-stats-v1',
      sourceSummary: 'Reviewed current wiki rows',
      publishedAt,
      lastReviewedAt: '2026-08-29',
    },
    equipment: [
      {
        id: `${version}:iron-dagger`,
        releaseVersion: version,
        itemId: 'iron-dagger',
        name: 'Iron Dagger',
        slot: 'main-hand',
        weaponPaths: 'dagger',
        attack: 2.5,
        defense: 0,
        dexterity: 0,
        levelRequirement: 1,
        skillRequirement: 1,
        floor: 1,
        acquisitionType: 'starter',
        acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
        availability: 'always',
        sourceRefId: `${version}:iron-dagger`,
        lastReviewedAt: '2026-08-29',
      },
    ],
    formulas: formulaIds.map((formulaId) => ({
      id: `${version}:${formulaId}`,
      releaseVersion: version,
      formulaId,
      expression:
        formulaId === 'points-per-level'
          ? 'points = levels × 3'
          : `${formulaId} expression`,
      units: 'units',
      applicability: 'All player builds',
      boundaryBehavior: 'Reviewed boundary',
      sourceRefId: `${version}:${formulaId}`,
      lastReviewedAt: '2026-08-29',
    })),
    sources,
  };
}

describe('mapPublishedRelease', () => {
  it('maps one complete release with resolved canonical provenance', () => {
    const input = rows();
    const snapshot = mapPublishedRelease(
      input.release,
      input.equipment,
      input.formulas,
      input.sources,
    );

    expect(snapshot).toMatchObject({
      version,
      publishedAt: '2026-08-29T12:00:00.000000Z',
      pointsPerLevel: 3,
      dualWieldSkillGate: 200,
    });
    expect(snapshot.equipment[0]).toMatchObject({
      id: 'iron-dagger',
      weaponPaths: ['dagger'],
      sourceRevision: '26212',
      verificationStatus: 'verified',
    });
  });

  it('filters children from other releases', () => {
    const input = rows();
    input.equipment.push({
      ...input.equipment[0],
      id: 'other:item',
      releaseVersion: 'other',
      itemId: 'other',
    });

    expect(
      mapPublishedRelease(
        input.release,
        input.equipment,
        input.formulas,
        input.sources,
      ).equipment,
    ).toHaveLength(1);
  });

  it('rejects orphaned source references without returning partial data', () => {
    const input = rows();
    input.equipment[0].sourceRefId = 'missing';

    expect(() =>
      mapPublishedRelease(
        input.release,
        input.equipment,
        input.formulas,
        input.sources,
      ),
    ).toThrow(/orphaned source reference/i);
  });

  it('rejects duplicate entity rows', () => {
    const input = rows();
    input.equipment.push({ ...input.equipment[0], id: `${version}:duplicate` });

    expect(() =>
      mapPublishedRelease(
        input.release,
        input.equipment,
        input.formulas,
        input.sources,
      ),
    ).toThrow(/duplicate equipment item/i);
  });

  it('rejects invalid comma-separated weapon paths', () => {
    const input = rows();
    input.equipment[0].weaponPaths = 'dagger,unknown';

    expect(() =>
      mapPublishedRelease(
        input.release,
        input.equipment,
        input.formulas,
        input.sources,
      ),
    ).toThrow(/published dataset is invalid/i);
  });
});

describe('mapPublishedReleaseV2', () => {
  function versionTwoRows() {
    const equipmentSource = {
      id: 'source:steel-sword',
      releaseVersion: '2026.08.30.1',
      entityKind: 'catalog-equipment',
      entityId: 'steel-sword',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed',
      sourceRevision: '26216',
      capturedAt: '2026-07-01T06:42:25Z',
      lastReviewedAt: '2026-08-30',
    };
    const mechanicSources = fallbackRelease.mechanics.map((mechanic) => ({
      id: `source:${mechanic.id}`,
      releaseVersion: '2026.08.30.1',
      entityKind: 'mechanic',
      entityId: mechanic.id,
      sourceUrl: mechanic.sourceUrl,
      sourceRevision: mechanic.sourceRevision,
      capturedAt: '2026-08-30T00:00:00Z',
      lastReviewedAt: '2026-08-30',
    }));
    return {
      release: {
        version: '2026.08.30.1',
        formulaSetVersion: 'sbor-stats-v2',
        sourceSummary: 'Reviewed catalog',
        publishedAt: { toISOString: () => '2026-08-30T12:00:00.000Z' },
        lastReviewedAt: '2026-08-30',
      },
      catalogEquipment: [{
        id: '2026.08.30.1:steel-sword',
        releaseVersion: '2026.08.30.1',
        itemId: 'steel-sword',
        name: 'Steel Sword',
        slot: 'main-hand',
        weaponPaths: 'one-handed,dual-wield',
        attack: 8.4,
        defense: 0,
        dexterity: 0,
        levelRequirement: 1,
        skillRequirement: 5,
        verificationStatus: 'verified',
        sourceRefId: equipmentSource.id,
        lastReviewedAt: '2026-08-30',
      }],
      aliases: [{
        id: 'alias:steel-blade',
        releaseVersion: '2026.08.30.1',
        itemId: 'steel-sword',
        alias: 'Steel Blade',
        sourceRefId: equipmentSource.id,
      }],
      acquisitions: [{
        id: 'acquisition:floor-1',
        releaseVersion: '2026.08.30.1',
        itemId: 'steel-sword',
        acquisitionType: 'shop',
        detail: 'Floor 1 Shop',
        floor: 1,
        availability: 'always',
        accessType: 'free',
        sourceRefId: equipmentSource.id,
      }],
      resistances: [],
      effects: [],
      mechanics: fallbackRelease.mechanics.map((mechanic) => ({
        id: `mechanic:${mechanic.id}`,
        releaseVersion: '2026.08.30.1',
        mechanicId: mechanic.id,
        expression: mechanic.expression,
        units: mechanic.units,
        applicability: mechanic.applicability,
        boundaryBehavior: mechanic.boundaryBehavior,
        computability: mechanic.computability,
        parametersJson: JSON.stringify(mechanic.parameters),
        verificationStatus: mechanic.verificationStatus,
        sourceRefId: `source:${mechanic.id}`,
        lastReviewedAt: '2026-08-30',
      })),
      policy: {
        releaseVersion: '2026.08.30.1',
        policyVersion: 'sbor-policy-v2',
        policyJson: JSON.stringify({ goals: ['balanced'] }),
        lastReviewedAt: '2026-08-30',
      },
      sources: [equipmentSource, ...mechanicSources],
    };
  }

  it('assembles catalog children and optimizer-safe equipment', () => {
    const snapshot = mapPublishedReleaseV2(versionTwoRows());

    expect(snapshot).toMatchObject({
      version: '2026.08.30.1',
      formulaSetVersion: 'sbor-stats-v2',
      strategyPolicyVersion: 'sbor-policy-v2',
    });
    expect(snapshot.catalog[0]).toMatchObject({
      id: 'steel-sword',
      aliases: ['Steel Blade'],
      acquisitions: [expect.objectContaining({ detail: 'Floor 1 Shop' })],
    });
    expect(snapshot.equipment[0]).toMatchObject({
      id: 'steel-sword',
      attack: 8.4,
      acquisitionDetail: 'Floor 1 Shop',
    });
    expect(snapshot.mechanics).toHaveLength(fallbackRelease.mechanics.length);
  });

  it('rejects an orphan acquisition instead of dropping it', () => {
    const rows = versionTwoRows();
    rows.acquisitions[0]!.itemId = 'missing-item';

    expect(() => mapPublishedReleaseV2(rows)).toThrow(
      'Orphaned acquisition acquisition:floor-1',
    );
  });
});
