import type { Timestamp } from 'spacetimedb';
import type { DatasetSnapshot, KnownGapRecord } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';

type ReleaseRow = {
  version: string;
  formulaSetVersion: string;
  sourceSummary: string;
  publishedAt: Timestamp;
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
