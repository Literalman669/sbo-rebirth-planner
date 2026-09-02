import type { DatasetSnapshot } from '../dataset/model';
import type { DatasetSource } from '../../infrastructure/spacetime/datasetSelection';
import { fingerprintDatasetSnapshot } from './fingerprint';

export interface DatasetReleaseDescriptor {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  formulaSetVersion: DatasetSnapshot['formulaSetVersion'];
  strategyPolicyVersion: DatasetSnapshot['strategyPolicyVersion'];
  contentFingerprint: string;
  availability: DatasetSource;
}

export interface DatasetReleaseSnapshot {
  snapshot: DatasetSnapshot;
  availability: DatasetSource;
}

const availabilityPriority: Record<DatasetSource, number> = {
  bundled: 0,
  cached: 1,
  live: 2,
};

export function mergeDatasetReleaseDescriptors(
  descriptors: readonly DatasetReleaseDescriptor[],
): DatasetReleaseDescriptor[] {
  const byVersion = new Map<string, DatasetReleaseDescriptor>();
  for (const descriptor of descriptors) {
    const existing = byVersion.get(descriptor.version);
    if (!existing) {
      byVersion.set(descriptor.version, descriptor);
      continue;
    }
    const priority = availabilityPriority[descriptor.availability];
    const existingPriority = availabilityPriority[existing.availability];
    if (priority > existingPriority) {
      byVersion.set(descriptor.version, descriptor);
      continue;
    }
    if (
      priority === existingPriority &&
      descriptor.contentFingerprint !== existing.contentFingerprint
    ) {
      throw new Error('Conflicting validated dataset snapshots share a version');
    }
  }
  return [...byVersion.values()].sort(
    (left, right) =>
      left.publishedAt.localeCompare(right.publishedAt) ||
      left.version.localeCompare(right.version, undefined, { numeric: true }),
  );
}

export function buildDatasetReleaseIndex(
  releases: readonly DatasetReleaseSnapshot[],
): DatasetReleaseDescriptor[] {
  return mergeDatasetReleaseDescriptors(
    releases.map(({ snapshot, availability }) => ({
      version: snapshot.version,
      publishedAt: snapshot.publishedAt,
      lastReviewedAt: snapshot.lastReviewedAt,
      formulaSetVersion: snapshot.formulaSetVersion,
      strategyPolicyVersion: snapshot.strategyPolicyVersion,
      contentFingerprint: fingerprintDatasetSnapshot(snapshot),
      availability,
    })),
  );
}
