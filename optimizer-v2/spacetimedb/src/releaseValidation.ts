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
  candidateId: string;
}

export interface ReleaseCandidateValidationRow {
  id: string;
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

function hasCanonicalSourceUrl(url: string): boolean {
  return canonicalWikiSourcePattern.test(url);
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

  const candidateStatuses = new Map<string, string>();
  for (const candidate of input.candidates) {
    if (candidateStatuses.has(candidate.id)) {
      errors.push(`Duplicate candidate ID: ${candidate.id}`);
    }
    candidateStatuses.set(candidate.id, candidate.status);
    if (candidate.status !== 'accepted') {
      errors.push(`Candidate ${candidate.id} is not accepted`);
    }
  }

  const sourceIds = new Set<string>();
  for (const source of input.sources) {
    if (sourceIds.has(source.id)) {
      errors.push(`Duplicate source reference ID: ${source.id}`);
    }
    sourceIds.add(source.id);
    if (!hasCanonicalSourceUrl(source.sourceUrl)) {
      errors.push(`Source ${source.id} is not canonical HTTPS`);
    }
    if (candidateStatuses.get(source.candidateId) !== 'accepted') {
      errors.push(`Source ${source.id} has no accepted candidate`);
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
    if (candidateStatuses.get(equipment.candidateId) !== 'accepted') {
      errors.push(`Equipment ${equipment.itemId} has no accepted candidate`);
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
    if (candidateStatuses.get(formula.candidateId) !== 'accepted') {
      errors.push(`Formula ${formula.formulaId} has no accepted candidate`);
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
