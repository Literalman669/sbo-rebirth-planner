import type { CharacterProfile } from '../../domain/build/model';
import type { GuestBuildStore } from '../storage/guestBuildStore';
import {
  profileFromCloudRevision,
  toSaveBuildRevisionArgs,
  type CloudBuildRowLike,
  type CloudEquipmentRowLike,
  type CloudOwnedItemRowLike,
  type CloudRevisionRowLike,
} from './buildMappers';
import type { PendingRevisionQueue } from './pendingRevisionQueue';

type SaveBuildRevisionArgs = ReturnType<typeof toSaveBuildRevisionArgs>;

export interface CloudReducers {
  saveBuildRevision(args: SaveBuildRevisionArgs): Promise<void>;
  completeGuestImport(): Promise<void>;
  restoreBuildRevision(args: {
    buildId: string;
    sourceRevisionId: string;
    newRevisionId: string;
  }): Promise<void>;
  deleteBuild(args: { buildId: string }): Promise<void>;
}

export interface CloudSnapshot {
  builds: readonly CloudBuildRowLike[];
  revisions: readonly CloudRevisionRowLike[];
  equipment: readonly CloudEquipmentRowLike[];
  ownedItems: readonly CloudOwnedItemRowLike[];
}

export interface CloudBuildHistoryItem {
  revisionId: string;
  createdAt: string;
  datasetVersion: string;
  profile: CharacterProfile;
}

export interface CloudBuildRecord {
  headRevisionId: string;
  profile: CharacterProfile;
  history: CloudBuildHistoryItem[];
}

export interface CloudBuildSelector {
  select(snapshot: CloudSnapshot): CloudBuildRecord[];
}

export function createCloudBuildSelector(): CloudBuildSelector {
  let previous = new Map<string, CloudBuildRecord>();

  return {
    select(snapshot) {
      const next = new Map<string, CloudBuildRecord>();
      const records: CloudBuildRecord[] = [];
      for (const build of snapshot.builds) {
        const history: CloudBuildHistoryItem[] = [];
        for (const revision of snapshot.revisions) {
          if (revision.buildId !== build.id) continue;
          try {
            history.push({
              revisionId: revision.id,
              createdAt: normalizeCloudTimestamp(revision.createdAt),
              datasetVersion: revision.datasetVersion,
              profile: profileFromCloudRevision(
                build,
                revision,
                snapshot.equipment,
                snapshot.ownedItems,
              ),
            });
          } catch {
            // A malformed subscription row never replaces a validated local view.
          }
        }
        const head = history.find(
          (item) => item.revisionId === build.headRevisionId,
        );
        const record = head
          ? {
              headRevisionId: build.headRevisionId,
              profile: head.profile,
              history,
            }
          : previous.get(build.id);
        if (record) {
          next.set(build.id, record);
          records.push(record);
        }
      }
      previous = next;
      return records;
    },
  };
}

function normalizeCloudTimestamp(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'microsSinceUnixEpoch' in value &&
    typeof value.microsSinceUnixEpoch === 'bigint'
  ) {
    return new Date(Number(value.microsSinceUnixEpoch / 1_000n)).toISOString();
  }
  return 'Unknown time';
}

export interface BuildRepository {
  save(profile: CharacterProfile): Promise<{
    revisionId?: string;
    location: 'local' | 'cloud-pending' | 'cloud';
  }>;
  importGuestBuilds(ids: readonly string[]): Promise<void>;
  retryPending(): Promise<void>;
  restore(buildId: string, revisionId: string): Promise<string>;
  delete(buildId: string): Promise<void>;
}

type BuildRepositoryOptions = {
  guestStore: GuestBuildStore;
  pendingQueue: PendingRevisionQueue;
  accountSubject?: string;
  reducers?: CloudReducers;
  getCloudSnapshot?: () => CloudSnapshot;
  randomUUID?: () => string;
  now?: () => string;
};

export function createBuildRepository({
  guestStore,
  pendingQueue,
  accountSubject,
  reducers,
  getCloudSnapshot = () => ({
    builds: [],
    revisions: [],
    equipment: [],
    ownedItems: [],
  }),
  randomUUID = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
}: BuildRepositoryOptions): BuildRepository {
  if (reducers && !accountSubject) {
    throw new Error('An authenticated account subject is required for cloud sync');
  }

  async function save(profile: CharacterProfile) {
    await guestStore.saveBuild(profile);
    if (!reducers) return { location: 'local' as const };
    const subject = accountSubject!;

    const pendingForBuild = (await pendingQueue.list(subject)).filter(
      (revision) => revision.buildId === profile.id,
    );
    const currentCloudHead = getCloudSnapshot().builds.find(
      (build) => build.id === profile.id,
    )?.headRevisionId;
    const parentRevisionId =
      pendingForBuild.at(-1)?.revisionId ?? currentCloudHead;
    const revisionId = randomUUID();
    await pendingQueue.enqueue({
      subject,
      revisionId,
      buildId: profile.id,
      profile,
      ...(parentRevisionId ? { parentRevisionId } : {}),
      enqueuedAt: now(),
      attempts: 0,
    });

    try {
      await reducers.saveBuildRevision(
        toSaveBuildRevisionArgs(profile, revisionId, parentRevisionId),
      );
      await pendingQueue.acknowledge(subject, revisionId);
      return { revisionId, location: 'cloud' as const };
    } catch {
      await pendingQueue.incrementAttempts(subject, revisionId);
      return { revisionId, location: 'cloud-pending' as const };
    }
  }

  return {
    save,

    async importGuestBuilds(ids) {
      if (!reducers) throw new Error('Sign in is required to import builds');
      const selectedIds = new Set(ids);
      const localBuilds = await guestStore.listBuilds();
      const selected = localBuilds.flatMap((result) =>
        result.ok && selectedIds.has(result.value.profile.id)
          ? [result.value.profile]
          : [],
      );
      if (selected.length !== selectedIds.size) {
        throw new Error('One or more selected guest builds are unavailable');
      }
      for (const profile of selected) {
        const result = await save(profile);
        if (result.location !== 'cloud') {
          throw new Error('Guest import is pending synchronization');
        }
      }
      await reducers.completeGuestImport();
    },

    async retryPending() {
      if (!reducers) return;
      const subject = accountSubject!;
      for (const revision of await pendingQueue.list(subject)) {
        try {
          await reducers.saveBuildRevision(
            toSaveBuildRevisionArgs(
              revision.profile,
              revision.revisionId,
              revision.parentRevisionId,
            ),
          );
          await pendingQueue.acknowledge(subject, revision.revisionId);
        } catch {
          await pendingQueue.incrementAttempts(subject, revision.revisionId);
          break;
        }
      }
    },

    async restore(buildId, revisionId) {
      if (!reducers) throw new Error('Sign in is required to restore history');
      const newRevisionId = randomUUID();
      await reducers.restoreBuildRevision({
        buildId,
        sourceRevisionId: revisionId,
        newRevisionId,
      });
      return newRevisionId;
    },

    async delete(buildId) {
      if (reducers) await reducers.deleteBuild({ buildId });
      await guestStore.deleteBuild(buildId);
    },
  };
}
