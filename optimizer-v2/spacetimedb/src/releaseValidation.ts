export const REQUIRED_FORMULA_IDS = [
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

export const OPTIMIZER_WEAPON_PATHS = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
] as const;

const equipmentSlots = new Set([
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
]);
const acquisitionTypes = new Set([
  'starter',
  'shop',
  'mob-drop',
  'boss-drop',
  'crafting',
  'quest',
  'event',
  'badge',
  'gamepass',
]);
const availabilityValues = new Set([
  'always',
  'active-event',
  'inactive-event',
]);
const canonicalWikiSourcePattern =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
const officialGameUrl =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';
const ownerAttestationPattern = /^owner-gameplay-attestation:\d{4}-\d{2}-\d{2}$/;

export interface ReleaseEquipmentValidationRow {
  itemId: string;
  slot: string;
  weaponPaths: string;
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  skillRequirement?: number;
  floor: number;
  acquisitionType: string;
  availability: string;
  sourceRefId: string;
  candidateId: string;
}

export interface ReleaseFormulaValidationRow {
  formulaId: string;
  sourceRefId: string;
  candidateId: string;
}

export interface ReleaseSourceValidationRow {
  id: string;
  entityKind: string;
  entityId: string;
  sourceUrl: string;
  sourceRevision: string;
  candidateId: string;
}

export interface ReleaseCandidateValidationRow {
  id: string;
  pageTitle: string;
  sourceUrl: string;
  revisionId: string;
  status: string;
}

export interface ReleaseValidationInput {
  version: string;
  formulaSetVersion: string;
  equipment: ReleaseEquipmentValidationRow[];
  formulas: ReleaseFormulaValidationRow[];
  sources: ReleaseSourceValidationRow[];
  candidates: ReleaseCandidateValidationRow[];
}

function hasApprovedSource(source: ReleaseSourceValidationRow): boolean {
  return (
    canonicalWikiSourcePattern.test(source.sourceUrl) ||
    (source.entityKind === 'formula' &&
      source.entityId === 'points-per-level' &&
      source.sourceUrl === officialGameUrl &&
      ownerAttestationPattern.test(source.sourceRevision))
  );
}

function isOwnerPointsAttestation(
  source: ReleaseSourceValidationRow,
): boolean {
  return (
    source.entityKind === 'formula' &&
    source.entityId === 'points-per-level' &&
    source.sourceUrl === officialGameUrl &&
    ownerAttestationPattern.test(source.sourceRevision)
  );
}

function canonicalPageTitle(sourceUrl: string): string | undefined {
  const prefix = 'https://swordbloxonlinerebirth.fandom.com/wiki/';
  if (!sourceUrl.startsWith(prefix)) return undefined;
  try {
    return decodeURIComponent(sourceUrl.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function expectedEquipmentCandidatePage(
  equipment: ReleaseEquipmentValidationRow,
): string | undefined {
  if (equipment.slot === 'armor') return 'Armor';
  if (equipment.slot === 'shield') return 'Shields';
  if (equipment.slot === 'upper-head') return 'Upper Headwear';
  if (equipment.slot === 'lower-head') return 'Lower Headwear';
  const paths = new Set(
    equipment.weaponPaths.split(',').map((path) => path.trim()),
  );
  if (paths.has('two-handed')) return 'Two-Handed';
  if (paths.has('one-handed') || paths.has('dual-wield')) return 'One-Handed';
  if (paths.has('rapier')) return 'Rapier';
  if (paths.has('dagger')) return 'Dagger';
  if (paths.has('melee')) return equipment.itemId === 'fists' ? 'Fists' : 'Melee';
  return undefined;
}

export function validateReleaseDraft(
  input: ReleaseValidationInput,
): string[] {
  const errors: string[] = [];
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(input.version)) {
    errors.push('Release version is invalid');
  }
  if (input.formulaSetVersion !== 'sbor-stats-v1') {
    errors.push('Formula set version is unsupported');
  }

  const candidatesById = new Map<string, ReleaseCandidateValidationRow>();
  for (const candidate of input.candidates) {
    if (candidatesById.has(candidate.id)) {
      errors.push(`Duplicate candidate ID: ${candidate.id}`);
    }
    candidatesById.set(candidate.id, candidate);
    if (candidate.status !== 'accepted') {
      errors.push(`Candidate ${candidate.id} is not accepted`);
    }
  }

  const sourceIds = new Set<string>();
  const sourcesById = new Map<string, ReleaseSourceValidationRow>();
  for (const source of input.sources) {
    if (sourceIds.has(source.id)) {
      errors.push(`Duplicate source reference ID: ${source.id}`);
    }
    sourceIds.add(source.id);
    sourcesById.set(source.id, source);
    if (!hasApprovedSource(source)) {
      errors.push(`Source ${source.id} does not have approved provenance`);
    }
    const candidate = candidatesById.get(source.candidateId);
    if (candidate?.status !== 'accepted') {
      errors.push(`Source ${source.id} has no accepted candidate`);
    } else if (isOwnerPointsAttestation(source)) {
      if (candidate.pageTitle !== 'Stats') {
        errors.push(`Source ${source.id} must use the Stats review candidate`);
      }
    } else if (
      canonicalPageTitle(source.sourceUrl) !== candidate.pageTitle ||
      canonicalPageTitle(candidate.sourceUrl) !== candidate.pageTitle ||
      source.sourceRevision !== candidate.revisionId
    ) {
      errors.push(
        `Source ${source.id} does not match candidate ${source.candidateId}`,
      );
    }
  }

  const itemIds = new Set<string>();
  const coveredPaths = new Set<string>();
  for (const equipment of input.equipment) {
    if (itemIds.has(equipment.itemId)) {
      errors.push(`Duplicate equipment item ID: ${equipment.itemId}`);
    }
    itemIds.add(equipment.itemId);
    if (!sourceIds.has(equipment.sourceRefId)) {
      errors.push(`Equipment ${equipment.itemId} has no source reference`);
    }
    if (candidatesById.get(equipment.candidateId)?.status !== 'accepted') {
      errors.push(`Equipment ${equipment.itemId} has no accepted candidate`);
    }
    const source = sourcesById.get(equipment.sourceRefId);
    if (
      source &&
      (source.entityKind !== 'equipment' || source.entityId !== equipment.itemId)
    ) {
      errors.push(
        `Equipment ${equipment.itemId} source does not identify that equipment row`,
      );
    }
    if (source && source.candidateId !== equipment.candidateId) {
      errors.push(`Equipment ${equipment.itemId} candidate does not match its source`);
    }
    const candidate = candidatesById.get(equipment.candidateId);
    const expectedPage = expectedEquipmentCandidatePage(equipment);
    if (candidate && expectedPage && candidate.pageTitle !== expectedPage) {
      errors.push(
        `Equipment ${equipment.itemId} must use the ${expectedPage} candidate page`,
      );
    }
    if (
      !Number.isInteger(equipment.floor) ||
      equipment.floor < 1 ||
      equipment.floor > 19
    ) {
      errors.push(`Equipment ${equipment.itemId} has an invalid floor`);
    }
    if (
      !Number.isFinite(equipment.attack) ||
      !Number.isFinite(equipment.defense) ||
      !Number.isFinite(equipment.dexterity) ||
      equipment.attack < 0 ||
      equipment.defense < 0 ||
      equipment.dexterity < 0
    ) {
      errors.push(`Equipment ${equipment.itemId} has a negative stat`);
    }
    if (
      !Number.isInteger(equipment.levelRequirement) ||
      equipment.levelRequirement < 1 ||
      (equipment.skillRequirement !== undefined &&
        (!Number.isInteger(equipment.skillRequirement) ||
          equipment.skillRequirement < 0))
    ) {
      errors.push(`Equipment ${equipment.itemId} has an invalid requirement`);
    }
    if (!equipmentSlots.has(equipment.slot)) {
      errors.push(`Equipment ${equipment.itemId} has an invalid slot`);
    }
    if (!acquisitionTypes.has(equipment.acquisitionType)) {
      errors.push(`Equipment ${equipment.itemId} has an invalid acquisition type`);
    }
    if (!availabilityValues.has(equipment.availability)) {
      errors.push(`Equipment ${equipment.itemId} has invalid availability`);
    }

    const paths = equipment.weaponPaths
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean);
    if (
      new Set(paths).size !== paths.length ||
      paths.some(
        (path) =>
          !OPTIMIZER_WEAPON_PATHS.includes(
            path as (typeof OPTIMIZER_WEAPON_PATHS)[number],
          ),
      )
    ) {
      errors.push(`Equipment ${equipment.itemId} has invalid weapon paths`);
    }
    if (equipment.slot === 'main-hand' || equipment.slot === 'off-hand') {
      for (const path of paths) coveredPaths.add(path);
    }
  }

  const formulaIds = new Set<string>();
  for (const formula of input.formulas) {
    if (formulaIds.has(formula.formulaId)) {
      errors.push(`Duplicate formula ID: ${formula.formulaId}`);
    }
    formulaIds.add(formula.formulaId);
    if (!sourceIds.has(formula.sourceRefId)) {
      errors.push(`Formula ${formula.formulaId} has no source reference`);
    }
    if (candidatesById.get(formula.candidateId)?.status !== 'accepted') {
      errors.push(`Formula ${formula.formulaId} has no accepted candidate`);
    }
    const source = sourcesById.get(formula.sourceRefId);
    if (
      source &&
      (source.entityKind !== 'formula' || source.entityId !== formula.formulaId)
    ) {
      errors.push(
        `Formula ${formula.formulaId} source does not identify that formula row`,
      );
    }
    if (source && source.candidateId !== formula.candidateId) {
      errors.push(`Formula ${formula.formulaId} candidate does not match its source`);
    }
    const candidate = candidatesById.get(formula.candidateId);
    if (candidate && candidate.pageTitle !== 'Stats') {
      errors.push(`Formula ${formula.formulaId} must use the Stats candidate page`);
    }
  }
  for (const formulaId of REQUIRED_FORMULA_IDS) {
    if (!formulaIds.has(formulaId)) {
      errors.push(`Missing required formula: ${formulaId}`);
    }
  }
  for (const path of OPTIMIZER_WEAPON_PATHS) {
    if (!coveredPaths.has(path)) {
      errors.push(`Missing weapon-path coverage: ${path}`);
    }
  }
  return errors;
}

export function validateCurrentReleaseInvariant(
  releases: readonly { version: string; isCurrent: boolean }[],
): string[] {
  return releases.filter((release) => release.isCurrent).length === 1
    ? []
    : ['Exactly one current dataset release is required'];
}
