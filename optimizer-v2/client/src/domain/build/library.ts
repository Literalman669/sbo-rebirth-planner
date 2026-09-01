import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';
import type { CharacterProfile } from './model';
import type {
  BuildRevisionSnapshot,
  SavedBuildKind,
} from './record';

export type BuildLibrarySource = 'local' | 'cloud' | 'local+cloud';

export interface BuildLibraryEntry {
  id: string;
  profile: CharacterProfile;
  kind: SavedBuildKind;
  source: BuildLibrarySource;
  headRevisionId: string;
  updatedAt: string;
  archivedAt?: string;
  history: BuildRevisionSnapshot[];
}

function cloudHistory(record: CloudBuildRecord): BuildRevisionSnapshot[] {
  return record.history.map((revision) => ({
    id: revision.revisionId,
    buildId: revision.profile.id,
    kind: revision.kind,
    profile: structuredClone(revision.profile),
    createdAt: revision.createdAt,
  }));
}

function sortHistory(history: Iterable<BuildRevisionSnapshot>) {
  return [...history].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

export function mergeBuildLibrary(
  localBuilds: readonly GuestBuildListResult[],
  cloudBuilds: readonly CloudBuildRecord[],
): BuildLibraryEntry[] {
  const entries = new Map<string, BuildLibraryEntry>();

  for (const record of cloudBuilds) {
    const history = cloudHistory(record);
    entries.set(record.profile.id, {
      id: record.profile.id,
      profile: structuredClone(record.profile),
      kind: record.kind,
      source: 'cloud',
      headRevisionId: record.headRevisionId,
      updatedAt: history.at(-1)?.createdAt ?? '',
      ...(record.archivedAt ? { archivedAt: record.archivedAt } : {}),
      history,
    });
  }

  for (const result of localBuilds) {
    if (!result.ok) continue;
    const local = result.value;
    const mirrored = entries.get(local.profile.id);
    const revisions = new Map(
      (mirrored?.history ?? []).map((revision) => [revision.id, revision]),
    );
    revisions.set(local.headRevisionId, {
      id: local.headRevisionId,
      buildId: local.profile.id,
      kind: local.kind,
      profile: structuredClone(local.profile),
      createdAt: local.updatedAt,
    });
    entries.set(local.profile.id, {
      id: local.profile.id,
      profile: structuredClone(local.profile),
      kind: local.kind,
      source: mirrored ? 'local+cloud' : 'local',
      headRevisionId: local.headRevisionId,
      updatedAt: local.updatedAt,
      ...(local.archivedAt ? { archivedAt: local.archivedAt } : {}),
      history: sortHistory(revisions.values()),
    });
  }

  return [...entries.values()].sort(
    (left, right) =>
      (left.profile.name ?? `Level ${left.profile.level} build`).localeCompare(
        right.profile.name ?? `Level ${right.profile.level} build`,
      ) || left.id.localeCompare(right.id),
  );
}

export function findBuildLibraryEntry(
  entries: readonly BuildLibraryEntry[],
  id: string,
): BuildLibraryEntry | null {
  return entries.find((entry) => entry.id === id) ?? null;
}
