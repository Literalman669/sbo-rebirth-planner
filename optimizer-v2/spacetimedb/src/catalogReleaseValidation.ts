type SourceRow = {
  id: string;
  entityKind: string;
  entityId: string;
  sourceUrl: string;
  sourceRevision: string;
  candidateId: string;
};

type CandidateRow = {
  id: string;
  pageTitle: string;
  sourceUrl: string;
  revisionId: string;
  status: string;
};

type CatalogEquipmentRow = {
  itemId: string;
  slot: string;
  weaponPaths: string;
  attack?: number;
  defense?: number;
  dexterity?: number;
  levelRequirement?: number;
  skillRequirement?: number;
  verificationStatus: string;
  sourceRefId: string;
  candidateId: string;
};

type CatalogChild = {
  id: string;
  itemId: string;
  sourceRefId: string;
  candidateId: string;
};

export interface CatalogReleaseValidationInput {
  version: string;
  formulaSetVersion: string;
  manifest: {
    discovered: number;
    fetched: number;
    parsed: number;
    normalized: number;
    verified: number;
    partial: number;
    conflicting: number;
    unknown: number;
    legacy: number;
    unresolvedJson: string;
    manifestHash: string;
  };
  policy: { policyVersion: string; policyJson: string };
  equipment: CatalogEquipmentRow[];
  aliases: Array<CatalogChild & { alias: string }>;
  acquisitions: Array<
    CatalogChild & {
      acquisitionType: string;
      detail: string;
      floor?: number;
      cost?: number;
      currency?: string;
      availability: string;
      accessType: string;
    }
  >;
  resistances: Array<
    CatalogChild & { status: string; percent: number }
  >;
  effects: Array<CatalogChild & { description: string }>;
  mechanics: Array<{
    mechanicId: string;
    computability: string;
    parametersJson: string;
    verificationStatus: string;
    sourceRefId: string;
    candidateId: string;
  }>;
  sources: SourceRow[];
  candidates: CandidateRow[];
}

const sourcePattern =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
const revisionPattern = /^[1-9]\d*$/;
const slots = new Set([
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
]);
const paths = new Set([
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
]);
const verificationStates = new Set([
  'verified',
  'partial',
  'conflicting',
  'unknown',
  'legacy',
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
const availabilityStates = new Set([
  'always',
  'active-event',
  'inactive-event',
  'rotating',
  'limited',
  'gamepass',
  'badge',
  'legacy',
  'unobtainable',
  'unknown',
]);
const accessTypes = new Set([
  'free',
  'event',
  'gamepass',
  'badge',
  'limited',
  'owned-only',
]);

function parseJson(value: string, label: string, errors: string[]) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    errors.push(`${label} is not valid JSON`);
    return undefined;
  }
}

function finiteObject(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => typeof entry === 'number' && Number.isFinite(entry),
    )
  );
}

export function validateCatalogRelease(
  input: CatalogReleaseValidationInput,
): string[] {
  const errors: string[] = [];
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(input.version)) {
    errors.push('Release version is invalid');
  }
  if (input.formulaSetVersion !== 'sbor-stats-v2') {
    errors.push('Catalog release requires sbor-stats-v2');
  }
  if (input.policy.policyVersion !== 'sbor-policy-v2') {
    errors.push('Strategy policy version is unsupported');
  }
  parseJson(input.policy.policyJson, 'Strategy policy JSON', errors);

  const manifestDetail = parseJson(
    input.manifest.unresolvedJson,
    'Coverage unresolved JSON',
    errors,
  ) as { unaccountedPages?: unknown } | undefined;
  const unaccounted = Array.isArray(manifestDetail?.unaccountedPages)
    ? manifestDetail.unaccountedPages
    : [];
  if (unaccounted.length > 0) {
    errors.push(
      `Coverage manifest leaves ${unaccounted.length} inventory page${unaccounted.length === 1 ? '' : 's'} unaccounted for`,
    );
  }
  if (
    input.manifest.discovered !== input.manifest.fetched ||
    input.manifest.discovered !== input.manifest.parsed
  ) {
    errors.push('Coverage manifest does not fetch and parse every discovered page');
  }
  if (input.manifest.normalized !== input.equipment.length) {
    errors.push('Coverage normalized count does not match catalog equipment');
  }

  const candidates = new Map(input.candidates.map((row) => [row.id, row]));
  const sources = new Map(input.sources.map((row) => [row.id, row]));
  for (const source of input.sources) {
    const candidate = candidates.get(source.candidateId);
    if (!sourcePattern.test(source.sourceUrl) || !revisionPattern.test(source.sourceRevision)) {
      errors.push(`Source ${source.id} does not have approved wiki provenance`);
    }
    if (!candidate || candidate.status !== 'accepted') {
      errors.push(`Source ${source.id} has no accepted candidate`);
    } else if (
      source.sourceUrl !== candidate.sourceUrl ||
      source.sourceRevision !== candidate.revisionId
    ) {
      errors.push(`Source ${source.id} does not match candidate ${source.candidateId}`);
    }
  }

  const itemIds = new Set<string>();
  for (const item of input.equipment) {
    if (itemIds.has(item.itemId)) {
      errors.push(`Duplicate catalog item ID: ${item.itemId}`);
    }
    itemIds.add(item.itemId);
    if (!slots.has(item.slot)) errors.push(`Catalog item ${item.itemId} has invalid slot`);
    const itemPaths = item.weaponPaths.split(',').filter(Boolean);
    if (new Set(itemPaths).size !== itemPaths.length || itemPaths.some((path) => !paths.has(path))) {
      errors.push(`Catalog item ${item.itemId} has invalid weapon paths`);
    }
    if (!verificationStates.has(item.verificationStatus)) {
      errors.push(`Catalog item ${item.itemId} has invalid verification status`);
    }
    if (
      item.verificationStatus === 'verified' &&
      [item.attack, item.defense, item.dexterity, item.levelRequirement].some(
        (value) => typeof value !== 'number' || !Number.isFinite(value),
      )
    ) {
      errors.push(`Verified catalog item ${item.itemId} requires complete numeric stats`);
    }
    if (!sources.has(item.sourceRefId)) {
      errors.push(`Catalog item ${item.itemId} has no source reference`);
    }
    if (candidates.get(item.candidateId)?.status !== 'accepted') {
      errors.push(`Catalog item ${item.itemId} has no accepted candidate`);
    }
  }

  const validateChild = (child: CatalogChild, label: string) => {
    if (!itemIds.has(child.itemId)) {
      errors.push(`${label} ${child.id} has no catalog item`);
    }
    if (!sources.has(child.sourceRefId)) {
      errors.push(`${label} ${child.id} has no source reference`);
    }
    if (candidates.get(child.candidateId)?.status !== 'accepted') {
      errors.push(`${label} ${child.id} has no accepted candidate`);
    }
  };

  const aliases = new Set<string>();
  for (const alias of input.aliases) {
    validateChild(alias, 'Alias');
    const key = `${alias.itemId}\u0000${alias.alias.toLocaleLowerCase()}`;
    if (aliases.has(key)) errors.push(`Duplicate alias for ${alias.itemId}: ${alias.alias}`);
    aliases.add(key);
  }
  const acquisitionIds = new Set<string>();
  for (const acquisition of input.acquisitions) {
    validateChild(acquisition, 'Acquisition');
    if (acquisitionIds.has(acquisition.id)) {
      errors.push(`Duplicate acquisition ID: ${acquisition.id}`);
    }
    acquisitionIds.add(acquisition.id);
    if (!acquisitionTypes.has(acquisition.acquisitionType)) {
      errors.push(`Acquisition ${acquisition.id} has invalid type`);
    }
    if (!availabilityStates.has(acquisition.availability)) {
      errors.push(`Acquisition ${acquisition.id} has invalid availability`);
    }
    if (!accessTypes.has(acquisition.accessType)) {
      errors.push(`Acquisition ${acquisition.id} has invalid access type`);
    }
    if (acquisition.cost !== undefined && (!Number.isFinite(acquisition.cost) || acquisition.cost < 0)) {
      errors.push(`Acquisition ${acquisition.id} has invalid cost`);
    }
  }
  for (const resistance of input.resistances) {
    validateChild(resistance, 'Resistance');
    if (!Number.isFinite(resistance.percent) || resistance.percent < 0 || resistance.percent > 100) {
      errors.push(`Resistance ${resistance.id} must be between 0 and 100`);
    }
  }
  for (const effect of input.effects) validateChild(effect, 'Effect');

  const mechanicIds = new Set<string>();
  for (const mechanic of input.mechanics) {
    if (mechanicIds.has(mechanic.mechanicId)) {
      errors.push(`Duplicate mechanic ID: ${mechanic.mechanicId}`);
    }
    mechanicIds.add(mechanic.mechanicId);
    if (!['exact', 'descriptive', 'conflicting', 'unknown'].includes(mechanic.computability)) {
      errors.push(`Mechanic ${mechanic.mechanicId} has invalid computability`);
    }
    const parameters = parseJson(
      mechanic.parametersJson,
      `Mechanic ${mechanic.mechanicId} parameters`,
      errors,
    );
    if (mechanic.computability === 'exact' && !finiteObject(parameters)) {
      errors.push(`Exact mechanic ${mechanic.mechanicId} requires finite parameters`);
    }
    if (!sources.has(mechanic.sourceRefId)) {
      errors.push(`Mechanic ${mechanic.mechanicId} has no source reference`);
    }
    if (candidates.get(mechanic.candidateId)?.status !== 'accepted') {
      errors.push(`Mechanic ${mechanic.mechanicId} has no accepted candidate`);
    }
  }

  return [...new Set(errors)];
}
