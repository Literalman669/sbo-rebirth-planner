import type { CharacterProfile } from '../../domain/build/model';
import type { SavedBuildKind } from '../../domain/build/record';
import type { InventoryState } from '../../domain/inventory/state';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import type { GuestBuildStore } from '../storage/guestBuildStore';
import {
  createInventoryStore,
  type InventoryStore,
} from '../storage/inventoryStore';
import {
  profileFromCloudRevision,
  profileFingerprint,
  normalizeCloudBuildKind,
  toSaveBuildRevisionArgs,
  type CloudBuildRowLike,
  type CloudEquipmentRowLike,
  type CloudOwnedItemRowLike,
  type CloudRevisionRowLike,
} from './buildMappers';
import type { PendingRevisionQueue } from './pendingRevisionQueue';
import {
  createPendingPlannerStateQueue,
  type PendingPlannerStateMutation,
  type PendingPlannerStateQueue,
} from './pendingPlannerStateQueue';

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
  upsertPlanProgress(args: {
    buildId: string;
    progressJson: string;
  }): Promise<void>;
  upsertUserPreferences(args: { preferencesJson: string }): Promise<void>;
  upsertUserInventory(args: { inventoryJson: string }): Promise<void>;
  renameBuild(args: { buildId: string; name: string }): Promise<void>;
  setBuildArchived(args: {
    buildId: string;
    archived: boolean;
  }): Promise<void>;
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
  kind: SavedBuildKind;
}

export interface CloudBuildRecord {
  headRevisionId: string;
  archivedAt?: string;
  profile: CharacterProfile;
  kind: SavedBuildKind;
  history: CloudBuildHistoryItem[];
}

export interface CloudBuildSelector {
  select(
    snapshot: CloudSnapshot,
    options?: { archived?: boolean },
  ): CloudBuildRecord[];
}

export function createCloudBuildSelector(): CloudBuildSelector {
  let previous = new Map<string, CloudBuildRecord>();

  return {
    select(snapshot, { archived = false } = {}) {
      const next = new Map<string, CloudBuildRecord>();
      const records: CloudBuildRecord[] = [];
      for (const build of snapshot.builds) {
        const history: CloudBuildHistoryItem[] = [];
        for (const revision of snapshot.revisions) {
          if (revision.buildId !== build.id) continue;
          try {
            const kind = normalizeCloudBuildKind(revision.kind);
            if (!kind) continue;
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
              kind,
            });
          } catch {
            // A malformed subscription row never replaces a validated local view.
          }
        }
        const head = history.find(
          (item) => item.revisionId === build.headRevisionId,
        );
        const buildKind = normalizeCloudBuildKind(build.kind);
        const record = head && buildKind === head.kind
          ? {
              headRevisionId: build.headRevisionId,
              ...(normalizeOptionalCloudTimestamp(build.archivedAt)
                ? {
                    archivedAt: normalizeOptionalCloudTimestamp(
                      build.archivedAt,
                    ),
                  }
                : {}),
              profile: head.profile,
              kind: head.kind,
              history,
            }
          : previous.get(build.id);
        if (record) {
          next.set(build.id, record);
          if (Boolean(record.archivedAt) === archived) records.push(record);
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

function normalizeOptionalCloudTimestamp(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = normalizeCloudTimestamp(value);
  return normalized === 'Unknown time' ? undefined : normalized;
}

export interface BuildRepository {
  save(
    profile: CharacterProfile,
    options?: { kind?: SavedBuildKind },
  ): Promise<{
    revisionId?: string;
    location: 'local' | 'cloud-pending' | 'cloud';
  }>;
  importGuestBuilds(ids: readonly string[]): Promise<void>;
  retryPending(): Promise<void>;
  retryPendingPlannerState(): Promise<void>;
  savePlanProgress(
    progress: PlanProgress,
  ): Promise<'cloud' | 'cloud-pending'>;
  savePreferences(
    preferences: PlannerPreferences,
  ): Promise<'cloud' | 'cloud-pending'>;
  saveInventory(
    inventory: InventoryState,
  ): Promise<'cloud' | 'cloud-pending'>;
  rename(buildId: string, name: string): Promise<void>;
  archive(buildId: string, archived: boolean): Promise<void>;
  restore(buildId: string, revisionId: string): Promise<string>;
  delete(buildId: string): Promise<void>;
}

type BuildRepositoryOptions = {
  guestStore: GuestBuildStore;
  pendingQueue: PendingRevisionQueue;
  pendingPlannerStateQueue?: PendingPlannerStateQueue;
  inventoryStore?: InventoryStore;
  accountSubject?: string;
  reducers?: CloudReducers;
  getCloudSnapshot?: () => CloudSnapshot;
  randomUUID?: () => string;
  now?: () => string;
};

export function createBuildRepository({
  guestStore,
  pendingQueue,
  pendingPlannerStateQueue = createPendingPlannerStateQueue(),
  inventoryStore = createInventoryStore(),
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

  async function save(
    profile: CharacterProfile,
    { kind = 'build' }: { kind?: SavedBuildKind } = {},
  ) {
    await guestStore.saveBuild(profile, { kind });
    if (!reducers) return { location: 'local' as const };
    const subject = accountSubject!;

    const pendingForBuild = (await pendingQueue.list(subject)).filter(
      (revision) => revision.buildId === profile.id,
    );
    const identicalPending = pendingForBuild.find(
      (revision) =>
        profileFingerprint(revision.profile, revision.kind) ===
        profileFingerprint(profile, kind),
    );
    if (identicalPending) {
      return {
        revisionId: identicalPending.revisionId,
        location: 'cloud-pending' as const,
      };
    }

    const snapshot = getCloudSnapshot();
    const currentCloudBuild = snapshot.builds.find(
      (build) => build.id === profile.id,
    );
    const currentCloudHead = currentCloudBuild?.headRevisionId;
    const currentCloudRecord = currentCloudBuild
      ? createCloudBuildSelector()
          .select(snapshot, {
            archived: currentCloudBuild.archivedAt !== undefined,
          })
          .find((record) => record.profile.id === profile.id)
      : undefined;
    if (
      currentCloudRecord &&
      profileFingerprint(currentCloudRecord.profile, currentCloudRecord.kind) ===
        profileFingerprint(profile, kind)
    ) {
      return {
        revisionId: currentCloudRecord.headRevisionId,
        location: 'cloud' as const,
      };
    }
    const parentRevisionId =
      pendingForBuild.at(-1)?.revisionId ?? currentCloudHead;
    const revisionId = randomUUID();
    await pendingQueue.enqueue({
      subject,
      revisionId,
      buildId: profile.id,
      kind,
      profile,
      ...(parentRevisionId ? { parentRevisionId } : {}),
      enqueuedAt: now(),
      attempts: 0,
    });

    try {
      await reducers.saveBuildRevision(
        toSaveBuildRevisionArgs(profile, kind, revisionId, parentRevisionId),
      );
      await pendingQueue.acknowledge(subject, revisionId);
      return { revisionId, location: 'cloud' as const };
    } catch {
      await pendingQueue.incrementAttempts(subject, revisionId);
      return { revisionId, location: 'cloud-pending' as const };
    }
  }

  async function sendPlannerMutation(
    mutation: PendingPlannerStateMutation,
  ): Promise<'cloud' | 'cloud-pending'> {
    if (!reducers) throw new Error('Sign in is required for cloud sync');
    const subject = accountSubject!;
    await pendingPlannerStateQueue.enqueue(mutation);
    try {
      if (mutation.kind === 'progress') {
        await reducers.upsertPlanProgress({
          buildId: mutation.progress.buildId,
          progressJson: JSON.stringify(mutation.progress),
        });
      } else if (mutation.kind === 'preferences') {
        await reducers.upsertUserPreferences({
          preferencesJson: JSON.stringify(mutation.preferences),
        });
      } else {
        await reducers.upsertUserInventory({
          inventoryJson: JSON.stringify(mutation.inventory),
        });
      }
      await pendingPlannerStateQueue.acknowledge(subject, mutation.mutationId);
      return 'cloud';
    } catch {
      await pendingPlannerStateQueue.incrementAttempts(
        subject,
        mutation.mutationId,
      );
      return 'cloud-pending';
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
          ? [result.value]
          : [],
      );
      if (selected.length !== selectedIds.size) {
        throw new Error('One or more selected guest builds are unavailable');
      }
      for (const record of selected) {
        const result = await save(record.profile, { kind: record.kind });
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
              revision.kind,
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

    async retryPendingPlannerState() {
      if (!reducers) return;
      const subject = accountSubject!;
      for (const mutation of await pendingPlannerStateQueue.list(subject)) {
        try {
          if (mutation.kind === 'progress') {
            await reducers.upsertPlanProgress({
              buildId: mutation.progress.buildId,
              progressJson: JSON.stringify(mutation.progress),
            });
          } else if (mutation.kind === 'preferences') {
            await reducers.upsertUserPreferences({
              preferencesJson: JSON.stringify(mutation.preferences),
            });
          } else {
            await reducers.upsertUserInventory({
              inventoryJson: JSON.stringify(mutation.inventory),
            });
          }
          await pendingPlannerStateQueue.acknowledge(
            subject,
            mutation.mutationId,
          );
        } catch {
          await pendingPlannerStateQueue.incrementAttempts(
            subject,
            mutation.mutationId,
          );
          break;
        }
      }
    },

    async savePlanProgress(progress) {
      await guestStore.savePlanProgress(progress);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'progress',
        subject: accountSubject,
        mutationId: `progress:${progress.buildId}`,
        progress,
        enqueuedAt: now(),
        attempts: 0,
      });
    },

    async savePreferences(preferences) {
      await guestStore.savePreferences(preferences);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'preferences',
        subject: accountSubject,
        mutationId: 'preferences:primary',
        preferences,
        enqueuedAt: now(),
        attempts: 0,
      });
    },

    async saveInventory(inventory) {
      await inventoryStore.save(inventory);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'inventory',
        subject: accountSubject,
        mutationId: 'inventory:primary',
        inventory,
        enqueuedAt: now(),
        attempts: 0,
      });
    },

    async rename(buildId, name) {
      if (!reducers) throw new Error('Sign in is required to rename cloud builds');
      await reducers.renameBuild({ buildId, name });
    },

    async archive(buildId, archived) {
      if (!reducers) throw new Error('Sign in is required to archive cloud builds');
      await reducers.setBuildArchived({ buildId, archived });
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
      if (accountSubject) {
        await pendingPlannerStateQueue.acknowledge(
          accountSubject,
          `progress:${buildId}`,
        );
      }
      await guestStore.deleteBuild(buildId);
    },
  };
}
