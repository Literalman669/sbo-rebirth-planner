import type {
  DraftEquipment,
  DraftFormula,
  DraftSourceReference,
  Equipment,
  Formula,
  ReleaseDraft,
} from '../../module_bindings/types';
import type {
  RecordReviewDecisionParams,
  UpsertDraftEquipmentParams,
  UpsertDraftFormulaParams,
  UpsertDraftSourceReferenceParams,
} from '../../module_bindings/types/reducers';
import {
  proposalsForCandidate,
  type CandidateRecord,
} from './CandidateReview';

const requiredFormulaIds = [
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

const requiredWeaponPaths = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
] as const;

export type AcceptanceReducers = {
  upsertDraftEquipment(args: UpsertDraftEquipmentParams): Promise<void>;
  upsertDraftFormula(args: UpsertDraftFormulaParams): Promise<void>;
  upsertDraftSourceReference(
    args: UpsertDraftSourceReferenceParams,
  ): Promise<void>;
  recordReviewDecision(args: RecordReviewDecisionParams): Promise<void>;
};

export async function applyCandidateAcceptance({
  candidate,
  draft,
  reducers: mutation,
}: {
  candidate: CandidateRecord;
  draft: { version: string; lastReviewedAt: string };
  reducers: AcceptanceReducers;
}): Promise<void> {
  const proposals = proposalsForCandidate(candidate);
  if (proposals.equipment.length + proposals.formulas.length === 0) {
    throw new Error('This candidate produced no safe proposals');
  }

  for (const { value } of proposals.equipment) {
    const sourceRefId = `${draft.version}:source:equipment:${value.id}`;
    await mutation.upsertDraftSourceReference({
      id: sourceRefId,
      releaseVersion: draft.version,
      entityKind: 'equipment',
      entityId: value.id,
      sourceUrl: candidate.sourceUrl,
      sourceRevision: candidate.revisionId,
      capturedAt: candidate.revisionTimestamp,
      lastReviewedAt: draft.lastReviewedAt,
      candidateId: candidate.id,
    });
    await mutation.upsertDraftEquipment({
      id: `${draft.version}:equipment:${value.id}`,
      releaseVersion: draft.version,
      itemId: value.id,
      name: value.name,
      slot: value.slot,
      weaponPaths: value.weaponPaths.join(','),
      attack: value.attack,
      defense: value.defense,
      dexterity: value.dexterity,
      levelRequirement: value.levelRequirement,
      skillRequirement: value.skillRequirement,
      floor: value.floor,
      acquisitionType: value.acquisitionType,
      acquisitionDetail: value.acquisitionDetail,
      availability: value.availability,
      sourceRefId,
      lastReviewedAt: draft.lastReviewedAt,
      candidateId: candidate.id,
    });
  }

  for (const { value } of proposals.formulas) {
    const sourceRefId = `${draft.version}:source:formula:${value.id}`;
    await mutation.upsertDraftSourceReference({
      id: sourceRefId,
      releaseVersion: draft.version,
      entityKind: 'formula',
      entityId: value.id,
      sourceUrl: candidate.sourceUrl,
      sourceRevision: candidate.revisionId,
      capturedAt: candidate.revisionTimestamp,
      lastReviewedAt: draft.lastReviewedAt,
      candidateId: candidate.id,
    });
    await mutation.upsertDraftFormula({
      id: `${draft.version}:formula:${value.id}`,
      releaseVersion: draft.version,
      formulaId: value.id,
      expression: value.expression,
      units: value.units,
      applicability: value.applicability,
      boundaryBehavior: value.boundaryBehavior,
      sourceRefId,
      lastReviewedAt: draft.lastReviewedAt,
      candidateId: candidate.id,
    });
  }

  await mutation.recordReviewDecision({
    id: `${draft.version}:review:${candidate.id}`,
    candidateId: candidate.id,
    decision: 'accept',
    note: `Accepted ${proposals.equipment.length + proposals.formulas.length} parsed proposals after review.`,
  });
}

export function releaseReadinessErrors({
  draft,
  equipment,
  formulas,
  sources,
  candidates,
}: {
  draft: ReleaseDraft | undefined;
  equipment: readonly DraftEquipment[];
  formulas: readonly DraftFormula[];
  sources: readonly DraftSourceReference[];
  candidates: readonly CandidateRecord[];
}): string[] {
  if (!draft) return ['Select or create a release draft'];
  if (draft.status === 'published') return ['This release is already published'];
  const errors: string[] = [];
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(draft.version)) {
    errors.push('Release version is invalid');
  }
  if (draft.formulaSetVersion !== 'sbor-stats-v1') {
    errors.push('Formula set version is unsupported');
  }
  const formulaIds = new Set(formulas.map((formula) => formula.formulaId));
  for (const formulaId of requiredFormulaIds) {
    if (!formulaIds.has(formulaId)) {
      errors.push(`Missing required formula: ${formulaId}`);
    }
  }
  const coveredPaths = new Set(
    equipment.flatMap((row) => row.weaponPaths.split(',').filter(Boolean)),
  );
  for (const path of requiredWeaponPaths) {
    if (!coveredPaths.has(path)) errors.push(`Missing weapon path: ${path}`);
  }
  const sourceIds = new Set(sources.map((source) => source.id));
  for (const row of equipment) {
    if (!sourceIds.has(row.sourceRefId)) {
      errors.push(`Equipment ${row.itemId} has no source reference`);
    }
  }
  for (const row of formulas) {
    if (!sourceIds.has(row.sourceRefId)) {
      errors.push(`Formula ${row.formulaId} has no source reference`);
    }
  }
  const acceptedCandidates = new Set(
    candidates
      .filter((candidate) => candidate.status === 'accepted')
      .map((candidate) => candidate.id),
  );
  for (const source of sources) {
    if (!acceptedCandidates.has(source.candidateId)) {
      errors.push(`Source ${source.entityId} has no accepted candidate`);
    }
  }
  return errors;
}

export function productionValues(
  candidate: CandidateRecord,
  currentVersion: string | undefined,
  equipment: readonly Equipment[],
  formulas: readonly Formula[],
): string[] {
  if (!currentVersion) return [];
  const proposals = proposalsForCandidate(candidate);
  const itemIds = new Set(proposals.equipment.map(({ value }) => value.id));
  const formulaIds = new Set<string>(
    proposals.formulas.map(({ value }) => value.id),
  );
  return [
    ...equipment
      .filter(
        (row) =>
          row.releaseVersion === currentVersion && itemIds.has(row.itemId),
      )
      .map((row) => `${row.name}: ATK ${row.attack}, DEF ${row.defense}`),
    ...formulas
      .filter(
        (row) =>
          row.releaseVersion === currentVersion && formulaIds.has(row.formulaId),
      )
      .map((row) => `${row.formulaId}: ${row.expression}`),
  ];
}
