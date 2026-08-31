import type { DatasetSnapshot } from '../../domain/dataset/model';

export type DatasetSource = 'live' | 'cached' | 'bundled';
export type DatasetSelection = {
  snapshot: DatasetSnapshot;
  source: DatasetSource;
};

const sourcePriority: Record<DatasetSource, number> = {
  bundled: 0,
  cached: 1,
  live: 2,
};

export function isCuratedReleaseVersion(version: string): boolean {
  return /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(version);
}

export function selectPreferredDataset(
  current: DatasetSelection,
  candidate: DatasetSelection,
): DatasetSelection {
  if (!isCuratedReleaseVersion(candidate.snapshot.version)) return current;
  const publishedComparison = candidate.snapshot.publishedAt.localeCompare(
    current.snapshot.publishedAt,
  );
  if (publishedComparison > 0) return candidate;
  if (publishedComparison < 0) return current;
  const versionComparison = candidate.snapshot.version.localeCompare(
    current.snapshot.version,
    undefined,
    { numeric: true },
  );
  if (versionComparison > 0) return candidate;
  if (versionComparison < 0) return current;
  return sourcePriority[candidate.source] > sourcePriority[current.source]
    ? candidate
    : current;
}
