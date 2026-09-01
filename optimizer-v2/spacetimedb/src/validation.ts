import {
  MAX_PROGRESS_HISTORY,
  MAX_PROGRESS_OBJECTIVES,
  migrateServerPlanProgress,
  type ServerPlanProgress,
} from './progressMerge';

export type ReleaseState = { version: string; isCurrent: boolean };

const MAX_PLANNER_JSON_LENGTH = 20_000;
const MAX_PROGRESS_JSON_LENGTH = 1_000_000;
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
  if (value.length > MAX_PROGRESS_JSON_LENGTH) {
    return ['Stored plan progress is invalid'];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return ['Stored plan progress is invalid'];
  }
  if (!isRecord(parsed)) return ['Stored plan progress is invalid'];
  if (parsed.schemaVersion === 1) {
    if (
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
      !isProgressBuildId(parsed.buildId, expectedBuildId) ||
      !isUniqueIdArray(parsed.completedActionIds) ||
      !isUniqueIdArray(parsed.dismissedRecommendationIds) ||
      !isOptionalProgressMetadataValid(parsed)
    ) {
      return ['Stored plan progress is invalid'];
    }
    return [];
  }
  if (
    !hasExactKeys(
      parsed,
      ['schemaVersion', 'buildId', 'objectives', 'history'],
      [
        'wallet',
        'currentPlanFingerprint',
        'reconciledThroughLevel',
        'acknowledgedDatasetVersion',
      ],
    ) ||
    parsed.schemaVersion !== 2 ||
    !isProgressBuildId(parsed.buildId, expectedBuildId) ||
    !isProgressObjectives(parsed.objectives) ||
    !isProgressHistory(parsed.history) ||
    !isProgressWallet(parsed.wallet) ||
    !isOptionalProgressId(parsed.currentPlanFingerprint) ||
    !isOptionalProgressMetadataValid(parsed)
  ) {
    return ['Stored plan progress is invalid'];
  }
  return [];
}

const progressCategories = new Set([
  'stat-allocation',
  'equipment-upgrade',
  'level-milestone',
  'floor-milestone',
  'manual-objective',
]);
const progressStatuses = new Set(['pending', 'completed', 'skipped']);
const progressOutcomes = new Set([
  'completed',
  'skipped',
  'reopened',
  'superseded',
]);
const progressSources = new Set(['automatic', 'manual', 'legacy']);

function isProgressId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 255 &&
    !controlCharacters.test(value)
  );
}

function isOptionalProgressId(value: unknown) {
  return value === undefined || isProgressId(value);
}

function isProgressBuildId(value: unknown, expected?: string) {
  return isProgressId(value) && (expected === undefined || value === expected);
}

function isSafeProgressText(value: unknown, maximum: number) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.length <= maximum &&
    !unsafeTextControls.test(value)
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isProgressObjectives(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_PROGRESS_OBJECTIVES) return false;
  const actionKeys = new Set<string>();
  for (const objective of value) {
    if (
      !isRecord(objective) ||
      !hasExactKeys(
        objective,
        ['actionKey', 'category', 'status', 'source', 'planFingerprint'],
        ['updatedAt', 'note'],
      ) ||
      !isProgressId(objective.actionKey) ||
      actionKeys.has(objective.actionKey) ||
      !progressCategories.has(String(objective.category)) ||
      !progressStatuses.has(String(objective.status)) ||
      !progressSources.has(String(objective.source)) ||
      !isProgressId(objective.planFingerprint) ||
      (objective.source !== 'legacy' && !isIsoTimestamp(objective.updatedAt)) ||
      (objective.updatedAt !== undefined && !isIsoTimestamp(objective.updatedAt)) ||
      (objective.note !== undefined && !isSafeProgressText(objective.note, 500))
    ) {
      return false;
    }
    actionKeys.add(objective.actionKey);
  }
  return true;
}

function isProgressHistory(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_PROGRESS_HISTORY) return false;
  const ids = new Set<string>();
  for (const event of value) {
    if (
      !isRecord(event) ||
      !hasExactKeys(
        event,
        [
          'id',
          'actionKey',
          'category',
          'label',
          'outcome',
          'source',
          'planFingerprint',
        ],
        ['datasetVersion', 'occurredAt', 'note'],
      ) ||
      !isProgressId(event.id) ||
      ids.has(event.id) ||
      !isProgressId(event.actionKey) ||
      !progressCategories.has(String(event.category)) ||
      !isSafeProgressText(event.label, 200) ||
      !progressOutcomes.has(String(event.outcome)) ||
      !progressSources.has(String(event.source)) ||
      !isProgressId(event.planFingerprint) ||
      !isOptionalProgressId(event.datasetVersion) ||
      (event.source !== 'legacy' && !isIsoTimestamp(event.occurredAt)) ||
      (event.occurredAt !== undefined && !isIsoTimestamp(event.occurredAt)) ||
      (event.note !== undefined && !isSafeProgressText(event.note, 500))
    ) {
      return false;
    }
    ids.add(event.id);
  }
  return true;
}

function isProgressWallet(value: unknown) {
  return (
    value === undefined ||
    (isRecord(value) &&
      hasExactKeys(value, ['balance', 'updatedAt']) &&
      typeof value.balance === 'number' &&
      Number.isSafeInteger(value.balance) &&
      value.balance >= 0 &&
      isIsoTimestamp(value.updatedAt))
  );
}

function isOptionalProgressMetadataValid(value: Record<string, unknown>) {
  return (
    (value.reconciledThroughLevel === undefined ||
      (typeof value.reconciledThroughLevel === 'number' &&
        Number.isInteger(value.reconciledThroughLevel) &&
        value.reconciledThroughLevel >= 1 &&
        value.reconciledThroughLevel <= 10_000)) &&
    isOptionalProgressId(value.acknowledgedDatasetVersion)
  );
}

export function parseAndValidatePlanProgressJson(
  value: string,
  expectedBuildId?: string,
): ServerPlanProgress {
  const errors = validatePlanProgressJson(value, expectedBuildId);
  if (errors[0]) throw new Error(errors[0]);
  return migrateServerPlanProgress(
    JSON.parse(value) as Parameters<typeof migrateServerPlanProgress>[0],
  );
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
