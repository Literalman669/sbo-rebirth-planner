import type { Timestamp } from 'spacetimedb';
import type { DatasetSnapshot, KnownGapRecord } from '../../domain/dataset/model';
import {
  catalogEquipmentRecordSchema,
  datasetSnapshotSchema,
} from '../../domain/dataset/schema';
import { isOptimizerSafeEquipment } from '../../domain/dataset/eligibility';

type ReleaseRow = {
  version: string;
  formulaSetVersion: string;
  sourceSummary: string;
  publishedAt: Pick<Timestamp, 'toISOString'>;
  lastReviewedAt: string;
};

type EquipmentRow = {
  id: string;
  releaseVersion: string;
  itemId: string;
  name: string;
  slot: string;
  weaponPaths: string;
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  skillRequirement?: number;
  floor: number;
  acquisitionType: string;
  acquisitionDetail: string;
  availability: string;
  sourceRefId: string;
  lastReviewedAt: string;
};

type FormulaRow = {
  id: string;
  releaseVersion: string;
  formulaId: string;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  sourceRefId: string;
  lastReviewedAt: string;
};

type SourceRow = {
  id: string;
  releaseVersion: string;
  entityKind: string;
  entityId: string;
  sourceUrl: string;
  sourceRevision: string;
  capturedAt: string;
  lastReviewedAt: string;
};

const gapPattern = /^gap:(two-handed|one-handed|rapier|dagger|dual-wield|melee):(1-49|50-99|100-149|150-199|200-249|250-299|300\+)$/;

function assertUnique(rows: readonly { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate ${label}: ${row.id}`);
    seen.add(row.id);
  }
}

export function mapPublishedRelease(
  release: ReleaseRow,
  allEquipment: readonly EquipmentRow[],
  allFormulas: readonly FormulaRow[],
  allSources: readonly SourceRow[],
): DatasetSnapshot {
  const equipmentRows = allEquipment.filter(
    (row) => row.releaseVersion === release.version,
  );
  const formulaRows = allFormulas.filter(
    (row) => row.releaseVersion === release.version,
  );
  const sourceRows = allSources.filter(
    (row) => row.releaseVersion === release.version,
  );
  assertUnique(
    equipmentRows.map((row) => ({ id: row.itemId })),
    'equipment item',
  );
  assertUnique(
    formulaRows.map((row) => ({ id: row.formulaId })),
    'formula',
  );
  assertUnique(sourceRows, 'source reference');
  const sources = new Map(sourceRows.map((source) => [source.id, source]));

  function sourceFor(id: string, entityKind: string, entityId: string) {
    const source = sources.get(id);
    if (!source) throw new Error(`Orphaned source reference: ${id}`);
    if (source.entityKind !== entityKind || source.entityId !== entityId) {
      throw new Error(`Source reference ${id} does not match ${entityKind} ${entityId}`);
    }
    return source;
  }

  const equipment = equipmentRows.map((row) => {
    const source = sourceFor(row.sourceRefId, 'equipment', row.itemId);
    return {
      id: row.itemId,
      name: row.name,
      slot: row.slot,
      weaponPaths: row.weaponPaths
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean),
      attack: row.attack,
      defense: row.defense,
      dexterity: row.dexterity,
      levelRequirement: row.levelRequirement,
      skillRequirement: row.skillRequirement,
      floor: row.floor,
      acquisitionType: row.acquisitionType,
      acquisitionDetail: row.acquisitionDetail,
      availability: row.availability,
      sourceUrl: source.sourceUrl,
      sourceRevision: source.sourceRevision,
      lastReviewedAt: row.lastReviewedAt,
      verificationStatus: 'verified',
    };
  });
  const formulas = formulaRows.map((row) => {
    const source = sourceFor(row.sourceRefId, 'formula', row.formulaId);
    return {
      id: row.formulaId,
      expression: row.expression,
      units: row.units,
      applicability: row.applicability,
      boundaryBehavior: row.boundaryBehavior,
      sourceUrl: source.sourceUrl,
      sourceRevision: source.sourceRevision,
      lastReviewedAt: row.lastReviewedAt,
      verificationStatus: 'verified',
    };
  });
  const knownGaps: KnownGapRecord[] = sourceRows.flatMap((source) => {
    if (source.entityKind !== 'gap') return [];
    const match = gapPattern.exec(source.entityId);
    if (!match) throw new Error(`Invalid known gap identifier: ${source.entityId}`);
    return [
      {
        path: match[1] as KnownGapRecord['path'],
        band: match[2] as KnownGapRecord['band'],
        reason: 'No verified obtainable upgrade is present in the reviewed canonical source revision.',
        sourceUrl: source.sourceUrl,
        sourceRevision: source.sourceRevision,
        lastReviewedAt: source.lastReviewedAt,
        verificationStatus: 'verified' as const,
      },
    ];
  });

  const parsed = datasetSnapshotSchema.safeParse({
    version: release.version,
    publishedAt: release.publishedAt.toISOString(),
    lastReviewedAt: release.lastReviewedAt,
    sourceSummary: release.sourceSummary,
    formulaSetVersion: release.formulaSetVersion,
    pointsPerLevel: 3,
    dualWieldSkillGate: 200,
    knownGaps,
    formulas,
    equipment,
  });
  if (!parsed.success) {
    throw new Error(`Published dataset is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

type CatalogEquipmentRow = {
  id: string;
  releaseVersion: string;
  itemId: string;
  name: string;
  variantGroupId?: string;
  slot: string;
  weaponPaths: string;
  attack?: number;
  defense?: number;
  dexterity?: number;
  levelRequirement?: number;
  skillRequirement?: number;
  verificationStatus: string;
  sourceRefId: string;
  lastReviewedAt: string;
};

type CatalogChildRow = {
  id: string;
  releaseVersion: string;
  itemId: string;
  sourceRefId: string;
};

type MechanicRow = {
  id: string;
  releaseVersion: string;
  mechanicId: string;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  computability: string;
  parametersJson: string;
  verificationStatus: string;
  sourceRefId: string;
  lastReviewedAt: string;
};

const legacyFormulaIds = new Set([
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
]);

export function mapPublishedReleaseV2(input: {
  release: ReleaseRow;
  catalogEquipment: readonly CatalogEquipmentRow[];
  aliases: readonly (CatalogChildRow & { alias: string })[];
  acquisitions: readonly (CatalogChildRow & {
    acquisitionType: string;
    detail: string;
    floor?: number;
    cost?: number;
    currency?: string;
    availability: string;
    accessType: string;
  })[];
  resistances: readonly (CatalogChildRow & {
    status: string;
    percent: number;
  })[];
  effects: readonly (CatalogChildRow & { description: string })[];
  mechanics: readonly MechanicRow[];
  policy: {
    releaseVersion: string;
    policyVersion: string;
    policyJson: string;
    lastReviewedAt: string;
  };
  sources: readonly SourceRow[];
}): DatasetSnapshot {
  const { version } = input.release;
  const releaseRows = <T extends { releaseVersion: string }>(
    rows: readonly T[],
    label: string,
  ) => {
    const wrong = rows.find((row) => row.releaseVersion !== version);
    if (wrong) throw new Error(`${label} belongs to another release`);
    return [...rows];
  };
  const catalogRows = releaseRows(input.catalogEquipment, 'Catalog equipment');
  const aliasRows = releaseRows(input.aliases, 'Equipment alias');
  const acquisitionRows = releaseRows(input.acquisitions, 'Equipment acquisition');
  const resistanceRows = releaseRows(input.resistances, 'Equipment resistance');
  const effectRows = releaseRows(input.effects, 'Equipment effect');
  const mechanicRows = releaseRows(input.mechanics, 'Mechanic');
  if (input.policy.releaseVersion !== version) {
    throw new Error('Strategy policy belongs to another release');
  }
  assertUnique(catalogRows.map((row) => ({ id: row.itemId })), 'catalog item');
  assertUnique(aliasRows, 'equipment alias');
  assertUnique(acquisitionRows, 'equipment acquisition');
  assertUnique(resistanceRows, 'equipment resistance');
  assertUnique(effectRows, 'equipment effect');
  assertUnique(mechanicRows.map((row) => ({ id: row.mechanicId })), 'mechanic');
  JSON.parse(input.policy.policyJson);

  const sources = new Map(
    input.sources
      .filter((source) => source.releaseVersion === version)
      .map((source) => [source.id, source]),
  );
  const sourceFor = (
    id: string,
    expectedKind: string,
    expectedEntity: string,
  ) => {
    const source = sources.get(id);
    if (!source) throw new Error(`Orphaned source reference: ${id}`);
    if (
      source.entityKind !== expectedKind ||
      source.entityId !== expectedEntity
    ) {
      throw new Error(
        `Source reference ${id} does not match ${expectedKind} ${expectedEntity}`,
      );
    }
    return source;
  };
  const catalogIds = new Set(catalogRows.map((row) => row.itemId));
  for (const row of acquisitionRows) {
    if (!catalogIds.has(row.itemId)) {
      throw new Error(`Orphaned acquisition ${row.id}`);
    }
  }
  for (const [label, rows] of [
    ['alias', aliasRows],
    ['resistance', resistanceRows],
    ['effect', effectRows],
  ] as const) {
    const orphan = rows.find((row) => !catalogIds.has(row.itemId));
    if (orphan) throw new Error(`Orphaned ${label} ${orphan.id}`);
  }

  const catalog = catalogRows.map((row) => {
    const source = sourceFor(
      row.sourceRefId,
      'catalog-equipment',
      row.itemId,
    );
    const aliases = aliasRows
      .filter((alias) => alias.itemId === row.itemId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((alias) => alias.alias);
    const acquisitions = acquisitionRows
      .filter((acquisition) => acquisition.itemId === row.itemId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((acquisition) => {
        const childSource = sources.get(acquisition.sourceRefId);
        if (!childSource) {
          throw new Error(`Orphaned source reference: ${acquisition.sourceRefId}`);
        }
        return {
          id: acquisition.id,
          type: acquisition.acquisitionType,
          detail: acquisition.detail,
          floor: acquisition.floor,
          cost: acquisition.cost,
          currency: acquisition.currency,
          availability: acquisition.availability,
          accessType: acquisition.accessType,
          sourceUrl: childSource.sourceUrl,
          sourceRevision: childSource.sourceRevision,
        };
      });
    const resistances = resistanceRows
      .filter((resistance) => resistance.itemId === row.itemId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((resistance) => {
        const childSource = sources.get(resistance.sourceRefId);
        if (!childSource) {
          throw new Error(`Orphaned source reference: ${resistance.sourceRefId}`);
        }
        return {
          status: resistance.status,
          percent: resistance.percent,
          sourceUrl: childSource.sourceUrl,
          sourceRevision: childSource.sourceRevision,
        };
      });
    return catalogEquipmentRecordSchema.parse({
      id: row.itemId,
      name: row.name,
      aliases,
      variantGroupId: row.variantGroupId,
      slot: row.slot,
      weaponPaths: row.weaponPaths.split(',').filter(Boolean),
      attack: row.attack ?? null,
      defense: row.defense ?? null,
      dexterity: row.dexterity ?? null,
      levelRequirement: row.levelRequirement ?? null,
      skillRequirement: row.skillRequirement,
      acquisitions,
      resistances,
      specialEffects: effectRows
        .filter((effect) => effect.itemId === row.itemId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((effect) => effect.description),
      verificationStatus: row.verificationStatus,
      sourceUrl: source.sourceUrl,
      sourceRevision: source.sourceRevision,
      lastReviewedAt: row.lastReviewedAt,
    });
  });
  const mechanics = mechanicRows.map((row) => {
    const source = sourceFor(row.sourceRefId, 'mechanic', row.mechanicId);
    return {
      id: row.mechanicId,
      expression: row.expression,
      units: row.units,
      applicability: row.applicability,
      boundaryBehavior: row.boundaryBehavior,
      computability: row.computability,
      parameters: JSON.parse(row.parametersJson),
      verificationStatus: row.verificationStatus,
      sourceUrl: source.sourceUrl,
      sourceRevision: source.sourceRevision,
      lastReviewedAt: row.lastReviewedAt,
    };
  });
  const formulas = mechanics
    .filter((mechanic) => legacyFormulaIds.has(mechanic.id))
    .map((mechanic) => ({
      id: mechanic.id,
      expression: mechanic.expression,
      units: mechanic.units,
      applicability: mechanic.applicability,
      boundaryBehavior: mechanic.boundaryBehavior,
      sourceUrl: mechanic.sourceUrl,
      sourceRevision: mechanic.sourceRevision,
      lastReviewedAt: mechanic.lastReviewedAt,
      verificationStatus: 'verified',
    }));
  const equipment = catalog.flatMap((item) => {
    if (!isOptimizerSafeEquipment(item)) return [];
    const primary = item.acquisitions.find(
      (acquisition) => acquisition.floor !== undefined,
    );
    if (!primary?.floor) return [];
    return [{
      id: item.id,
      name: item.name,
      slot: item.slot,
      weaponPaths: item.weaponPaths,
      attack: item.attack,
      defense: item.defense,
      dexterity: item.dexterity,
      levelRequirement: item.levelRequirement,
      skillRequirement: item.skillRequirement,
      floor: primary.floor,
      acquisitionType: primary.type,
      acquisitionDetail: primary.detail,
      availability: primary.availability,
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
      lastReviewedAt: item.lastReviewedAt,
      verificationStatus: 'verified',
    }];
  });

  const parsed = datasetSnapshotSchema.safeParse({
    version,
    publishedAt: input.release.publishedAt.toISOString(),
    lastReviewedAt: input.release.lastReviewedAt,
    sourceSummary: input.release.sourceSummary,
    formulaSetVersion: input.release.formulaSetVersion,
    strategyPolicyVersion: input.policy.policyVersion,
    pointsPerLevel: 3,
    dualWieldSkillGate: 200,
    knownGaps: [],
    formulas,
    mechanics,
    catalog,
    equipment,
  });
  if (!parsed.success) {
    throw new Error(`Published catalog dataset is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}
