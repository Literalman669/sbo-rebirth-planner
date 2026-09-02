export interface ServerDatasetReviewReceipt {
  schemaVersion: 1;
  buildId: string;
  inputFingerprint: string;
  pinnedDatasetVersion: string;
  targetDatasetVersion: string;
  impactKeyFingerprint: string;
  reportFingerprint: string;
  status: 'reviewed' | 'applied';
  reviewedAt: string;
}

export interface ServerRevisionProfile {
  schemaVersion: number;
  level: number;
  maxFloor: number;
  weaponPath: string;
  goal: string;
  weaponSkill?: number;
  str: number;
  def: number;
  agi: number;
  vit: number;
  luk: number;
  datasetVersion: string;
  accessPreferences?: string;
}

export function createDatasetPinnedRevisionProfile(
  source: ServerRevisionProfile,
  targetDatasetVersion: string,
): ServerRevisionProfile {
  return {
    schemaVersion: source.schemaVersion,
    level: source.level,
    maxFloor: source.maxFloor,
    weaponPath: source.weaponPath,
    goal: source.goal,
    weaponSkill: source.weaponSkill,
    str: source.str,
    def: source.def,
    agi: source.agi,
    vit: source.vit,
    luk: source.luk,
    datasetVersion: targetDatasetVersion,
    accessPreferences: source.accessPreferences,
  };
}

const exactKeys = [
  'schemaVersion',
  'buildId',
  'inputFingerprint',
  'pinnedDatasetVersion',
  'targetDatasetVersion',
  'impactKeyFingerprint',
  'reportFingerprint',
  'status',
  'reviewedAt',
] as const;
const unsafeControls = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 255 &&
    !unsafeControls.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function parseReceipt(value: unknown): ServerDatasetReviewReceipt | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== exactKeys.length ||
    !exactKeys.every((key) => key in value) ||
    value.schemaVersion !== 1 ||
    !isIdentifier(value.buildId) ||
    !isIdentifier(value.inputFingerprint) ||
    !isIdentifier(value.pinnedDatasetVersion) ||
    !isIdentifier(value.targetDatasetVersion) ||
    value.pinnedDatasetVersion === value.targetDatasetVersion ||
    !isIdentifier(value.impactKeyFingerprint) ||
    !isIdentifier(value.reportFingerprint) ||
    !['reviewed', 'applied'].includes(String(value.status)) ||
    !isTimestamp(value.reviewedAt)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    buildId: value.buildId,
    inputFingerprint: value.inputFingerprint,
    pinnedDatasetVersion: value.pinnedDatasetVersion,
    targetDatasetVersion: value.targetDatasetVersion,
    impactKeyFingerprint: value.impactKeyFingerprint,
    reportFingerprint: value.reportFingerprint,
    status: value.status as 'reviewed' | 'applied',
    reviewedAt: value.reviewedAt,
  };
}

function cloneReceipt(
  receipt: ServerDatasetReviewReceipt,
): ServerDatasetReviewReceipt {
  return JSON.parse(JSON.stringify(receipt)) as ServerDatasetReviewReceipt;
}

export function parseAndValidateDatasetReviewJson(
  value: string,
  expectedBuildId: string,
): ServerDatasetReviewReceipt {
  if (value.length > 5_000) throw new Error('Stored dataset review is invalid');
  let raw: unknown;
  try {
    raw = JSON.parse(value) as unknown;
  } catch {
    throw new Error('Stored dataset review is invalid');
  }
  const receipt = parseReceipt(raw);
  if (!receipt || receipt.buildId !== expectedBuildId) {
    throw new Error('Stored dataset review is invalid');
  }
  return receipt;
}

export function mergeDatasetReview(
  current: ServerDatasetReviewReceipt | undefined,
  incoming: ServerDatasetReviewReceipt,
): ServerDatasetReviewReceipt {
  if (!current) return cloneReceipt(incoming);
  const timeComparison = incoming.reviewedAt.localeCompare(current.reviewedAt);
  if (timeComparison > 0) return cloneReceipt(incoming);
  if (timeComparison < 0) return cloneReceipt(current);
  return JSON.stringify(incoming).localeCompare(JSON.stringify(current)) > 0
    ? cloneReceipt(incoming)
    : cloneReceipt(current);
}
