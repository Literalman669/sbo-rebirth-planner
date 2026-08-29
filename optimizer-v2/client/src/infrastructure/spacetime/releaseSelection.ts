export type DatasetRelease = {
  version: string;
  formulaSetVersion: 'sbor-stats-v1';
  sourceSummary: string;
  publishedAtMicros: bigint;
  lastReviewedAt: string;
};

type LiveDatasetRelease = DatasetRelease & { isCurrent: boolean };

export function parseFormulaSetVersion(
  value: string,
): DatasetRelease['formulaSetVersion'] {
  if (value !== 'sbor-stats-v1') {
    throw new Error(`unsupported formula set: ${value}`);
  }

  return value;
}

export function selectCurrentRelease(
  live: readonly LiveDatasetRelease[],
  fallback: DatasetRelease,
): { release: DatasetRelease; source: 'live' | 'fallback' } {
  const current = live.filter((release) => release.isCurrent);

  if (current.length > 1) {
    throw new Error('ambiguous current dataset release');
  }

  if (current.length === 1) {
    return { release: current[0], source: 'live' };
  }

  return { release: fallback, source: 'fallback' };
}
