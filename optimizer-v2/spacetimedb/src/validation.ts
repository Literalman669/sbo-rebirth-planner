export type ReleaseState = { version: string; isCurrent: boolean };

const MAX_PLANNER_JSON_LENGTH = 20_000;
const MAX_INVENTORY_JSON_LENGTH = 2_000_000;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const unsafeTextControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const accessPreferenceTokens = new Set([
  'active-event',
  'gamepass',
  'badge',
  'limited',
]);
const buildKinds = new Set(['build', 'personal-preset']);

export function validateBuildKind(value: string): string[] {
  return buildKinds.has(value) ? [] : ['Build kind is invalid'];
}

export function validateShareableBuildKind(value: string): string[] {
  if (value === 'personal-preset') {
    return ['Personal presets must be copied to a build before sharing'];
  }
  return validateBuildKind(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    keys.every((key) => allowed.has(key))
  );
}

function isUniqueIdArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (id) => typeof id === 'string' && id.length >= 1 && id.length <= 255,
    ) &&
    new Set(value).size === value.length
  );
}

function isInventoryId(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 255 &&
    !controlCharacters.test(value)
  );
}

function isInventoryIdArray(value: unknown, maximum: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((id) => typeof id === 'string' && isInventoryId(id)) &&
    new Set(value).size === value.length
  );
}

export function validateOwnedItemIds(
  ownedItemIds: readonly string[],
): string[] {
  if (ownedItemIds.length > 2_000) return ['Too many owned items'];
  if (
    ownedItemIds.some((itemId) => !isInventoryId(itemId))
  ) {
    return ['Owned item ID is invalid'];
  }
  if (new Set(ownedItemIds).size !== ownedItemIds.length) {
    return ['Owned item IDs must be unique'];
  }
  return [];
}

function parsePlannerJson(value: string): unknown {
  if (value.length > MAX_PLANNER_JSON_LENGTH) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

export function validatePreferenceJson(value: string): string[] {
  const parsed = parsePlannerJson(value);
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, [
      'schemaVersion',
      'mode',
      'density',
      'showAllLevels',
      'compactWeaponPathsAfterFirstUse',
    ]) ||
    parsed.schemaVersion !== 1 ||
    !['beginner', 'detailed'].includes(String(parsed.mode)) ||
    !['comfortable', 'compact'].includes(String(parsed.density)) ||
    typeof parsed.showAllLevels !== 'boolean' ||
    typeof parsed.compactWeaponPathsAfterFirstUse !== 'boolean'
  ) {
    return ['Stored planner preferences are invalid'];
  }
  return [];
}

export function validateInventoryJson(value: string): string[] {
  if (value.length > MAX_INVENTORY_JSON_LENGTH) {
    return ['Stored inventory is invalid'];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return ['Stored inventory is invalid'];
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, [
      'schemaVersion',
      'ownedItemIds',
      'favoriteItemIds',
      'comparisonItemIds',
      'notes',
    ]) ||
    parsed.schemaVersion !== 1 ||
    !isInventoryIdArray(parsed.ownedItemIds, 2_000) ||
    !isInventoryIdArray(parsed.favoriteItemIds, 2_000) ||
    !isRecord(parsed.notes) ||
    Object.keys(parsed.notes).length > 500 ||
    Object.entries(parsed.notes).some(
      ([itemId, note]) =>
        !isInventoryId(itemId) ||
        typeof note !== 'string' ||
        note.trim().length < 1 ||
        note.length > 500 ||
        unsafeTextControls.test(note),
    )
  ) {
    return ['Stored inventory is invalid'];
  }
  if (!isInventoryIdArray(parsed.comparisonItemIds, 4)) {
    return ['Inventory comparison list is invalid'];
  }
  return [];
}

export function validatePlanProgressJson(
  value: string,
  expectedBuildId?: string,
): string[] {
  const parsed = parsePlannerJson(value);
  if (
    !isRecord(parsed) ||
    !hasExactKeys(
      parsed,
      [
        'schemaVersion',
        'buildId',
        'completedActionIds',
        'dismissedRecommendationIds',
      ],
      ['reconciledThroughLevel', 'acknowledgedDatasetVersion'],
    ) ||
    parsed.schemaVersion !== 1 ||
    typeof parsed.buildId !== 'string' ||
    parsed.buildId.length < 1 ||
    parsed.buildId.length > 255 ||
    (expectedBuildId !== undefined && parsed.buildId !== expectedBuildId) ||
    !isUniqueIdArray(parsed.completedActionIds) ||
    !isUniqueIdArray(parsed.dismissedRecommendationIds) ||
    (parsed.reconciledThroughLevel !== undefined &&
      (typeof parsed.reconciledThroughLevel !== 'number' ||
        !Number.isInteger(parsed.reconciledThroughLevel) ||
        parsed.reconciledThroughLevel < 1 ||
        parsed.reconciledThroughLevel > 10_000)) ||
    (parsed.acknowledgedDatasetVersion !== undefined &&
      (typeof parsed.acknowledgedDatasetVersion !== 'string' ||
        parsed.acknowledgedDatasetVersion.length < 1 ||
        parsed.acknowledgedDatasetVersion.length > 255))
  ) {
    return ['Stored plan progress is invalid'];
  }
  return [];
}

type IdentityOwner = { equals(identity: unknown): boolean };

export function validatePlanProgressOwnership(
  build: { owner: IdentityOwner } | null | undefined,
  sender: unknown,
): string[] {
  return build?.owner.equals(sender)
    ? []
    : ['Build not found for this identity'];
}

export function validateAccessPreferences(value?: string): string[] {
  if (value === undefined) return [];
  const tokens = value.split(',');
  if (
    tokens.length === 0 ||
    tokens.some((token) => !accessPreferenceTokens.has(token)) ||
    new Set(tokens).size !== tokens.length
  ) {
    return ['Access preferences are invalid'];
  }
  return [];
}

export function assertExactlyOneCurrentRelease(
  releases: readonly ReleaseState[],
): void {
  if (releases.filter((release) => release.isCurrent).length !== 1) {
    throw new Error('exactly one current dataset release required');
  }
}
