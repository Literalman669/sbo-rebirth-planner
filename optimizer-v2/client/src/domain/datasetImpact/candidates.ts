import type {
  BuildLibraryEntry,
  BuildLibrarySource,
} from '../build/library';
import type { CharacterProfile } from '../build/model';
import type { SavedBuildKind } from '../build/record';
import {
  buildImpactKeyFingerprint,
  fingerprintBuildInputs,
} from './fingerprint';
import type { DatasetReleaseDescriptor } from './releaseIndex';
import {
  receiptMatchesImpact,
  type DatasetReviewReceipt,
} from './reviewReceipt';

export interface DatasetImpactCandidate {
  id: string;
  profile: CharacterProfile;
  source: 'active' | BuildLibrarySource;
  backingSource?: BuildLibrarySource;
  kind: 'active-draft' | SavedBuildKind;
  savedKind?: SavedBuildKind;
  headRevisionId?: string;
  archivedAt?: string;
  pinned?: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
  inputFingerprint: string;
  impactKeyFingerprint?: string;
  status: 'unreviewed' | 'reviewed-pinned' | 'blocked';
}

type CandidateSelectionInput = {
  active: { profile: CharacterProfile; hasActiveDraft: boolean };
  entries: readonly BuildLibraryEntry[];
  releases: readonly DatasetReleaseDescriptor[];
  targetVersion: string;
  receipts: readonly DatasetReviewReceipt[];
};

function buildCandidate(
  profile: CharacterProfile,
  target: DatasetReleaseDescriptor,
  pinned: DatasetReleaseDescriptor | undefined,
  receipt: DatasetReviewReceipt | undefined,
  identity: Omit<
    DatasetImpactCandidate,
    | 'profile'
    | 'target'
    | 'pinned'
    | 'inputFingerprint'
    | 'impactKeyFingerprint'
    | 'status'
  >,
): DatasetImpactCandidate {
  const inputFingerprint = fingerprintBuildInputs(profile);
  const impactKeyFingerprint = pinned
    ? buildImpactKeyFingerprint({ inputFingerprint, pinned, target })
    : undefined;
  const status = !pinned
    ? 'blocked'
    : receipt &&
        receiptMatchesImpact(receipt, {
          buildId: profile.id,
          inputFingerprint,
          pinnedVersion: pinned.version,
          targetVersion: target.version,
          impactKeyFingerprint,
        })
      ? 'reviewed-pinned'
      : 'unreviewed';
  return {
    ...identity,
    profile: structuredClone(profile),
    pinned,
    target,
    inputFingerprint,
    impactKeyFingerprint,
    status,
  };
}

export function selectDatasetImpactCandidates({
  active,
  entries,
  releases,
  targetVersion,
  receipts,
}: CandidateSelectionInput): DatasetImpactCandidate[] {
  const releasesByVersion = new Map(
    releases.map((release) => [release.version, release]),
  );
  const target = releasesByVersion.get(targetVersion);
  if (!target) return [];
  const receiptsByBuild = new Map(
    receipts.map((receipt) => [receipt.buildId, receipt]),
  );
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const candidates: DatasetImpactCandidate[] = [];

  if (
    active.hasActiveDraft &&
    active.profile.datasetVersion !== target.version
  ) {
    const backing = entriesById.get(active.profile.id);
    candidates.push(
      buildCandidate(
        active.profile,
        target,
        releasesByVersion.get(active.profile.datasetVersion),
        receiptsByBuild.get(active.profile.id),
        {
          id: active.profile.id,
          source: 'active',
          ...(backing
            ? {
                backingSource: backing.source,
                savedKind: backing.kind,
                headRevisionId: backing.headRevisionId,
                ...(backing.archivedAt
                  ? { archivedAt: backing.archivedAt }
                  : {}),
              }
            : {}),
          kind: 'active-draft',
        },
      ),
    );
  }

  for (const entry of entries) {
    if (
      (active.hasActiveDraft && entry.id === active.profile.id) ||
      entry.profile.datasetVersion === target.version
    ) {
      continue;
    }
    candidates.push(
      buildCandidate(
        entry.profile,
        target,
        releasesByVersion.get(entry.profile.datasetVersion),
        receiptsByBuild.get(entry.id),
        {
          id: entry.id,
          source: entry.source,
          kind: entry.kind,
          savedKind: entry.kind,
          headRevisionId: entry.headRevisionId,
          ...(entry.archivedAt ? { archivedAt: entry.archivedAt } : {}),
        },
      ),
    );
  }

  return candidates.sort((left, right) => {
    if (left.source === 'active') return right.source === 'active' ? 0 : -1;
    if (right.source === 'active') return 1;
    const leftName = left.profile.name ?? `Level ${left.profile.level} build`;
    const rightName = right.profile.name ?? `Level ${right.profile.level} build`;
    return leftName.localeCompare(rightName) || left.id.localeCompare(right.id);
  });
}
