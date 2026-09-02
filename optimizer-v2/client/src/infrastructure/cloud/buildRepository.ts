import type { CharacterProfile } from '../../domain/build/model';
import type { SavedBuildKind } from '../../domain/build/record';
import type { BuildLibrarySource } from '../../domain/build/library';
import type { PortableBuildRecord } from '../../domain/build/portable';
import type { InventoryState } from '../../domain/inventory/state';
import type { DatasetReviewReceipt } from '../../domain/datasetImpact/reviewReceipt';
import { fingerprintBuildInputs } from '../../domain/datasetImpact/fingerprint';
import { createDatasetPinnedProfile } from '../../domain/datasetImpact/apply';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import type {
  ApplyDatasetUpdateRequest,
  GuestBuildStore,
} from '../storage/guestBuildStore';
import {
  createDatasetReviewStore,
  type DatasetReviewStore,
} from '../storage/datasetReviewStore';
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
  deletePlanProgress(args: { buildId: string }): Promise<void>;
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
  upsertDatasetReview(args: {
    buildId: string;
    receiptJson: string;
  }): Promise<void>;
  deleteDatasetReview(args: { buildId: string }): Promise<void>;
  applyDatasetVersionUpdate(args: {
    buildId: string;
    expectedHeadRevisionId: string;
    revisionId: string;
    targetDatasetVersion: string;
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
  importBuildRecords(
    records: readonly PortableBuildRecord[],
  ): Promise<'cloud' | 'cloud-pending'>;
  retryPending(): Promise<void>;
  retryPendingPlannerState(): Promise<void>;
  retryAllPending(): Promise<void>;
  savePlanProgress(
    progress: PlanProgress,
  ): Promise<'cloud' | 'cloud-pending'>;
  resetPlanProgress(buildId: string): Promise<'cloud' | 'cloud-pending'>;
  savePreferences(
    preferences: PlannerPreferences,
  ): Promise<'cloud' | 'cloud-pending'>;
  saveInventory(
    inventory: InventoryState,
  ): Promise<'cloud' | 'cloud-pending'>;
  saveDatasetReview(
    receipt: DatasetReviewReceipt,
  ): Promise<'cloud' | 'cloud-pending'>;
  deleteDatasetReview(
    buildId: string,
  ): Promise<'cloud' | 'cloud-pending'>;
  applyDatasetVersionUpdate(input: {
    buildId: string;
    expectedHeadRevisionId: string;
    targetDatasetVersion: string;
    revisionId?: string;
  }): Promise<{
    revisionId: string;
    location: 'cloud' | 'cloud-pending';
  }>;
  applyDatasetUpdate(
    request: ApplyDatasetUpdateRequest,
    options: { source: BuildLibrarySource | 'active' },
  ): Promise<{
    profile: CharacterProfile;
    revisionId: string;
    location: 'local' | 'cloud' | 'cloud-pending';
  }>;
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
  datasetReviewStore?: DatasetReviewStore;
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
  datasetReviewStore = createDatasetReviewStore(),
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
      await dispatchPlannerMutation(mutation);
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

  async function dispatchPlannerMutation(
    mutation: PendingPlannerStateMutation,
  ): Promise<void> {
    if (!reducers) throw new Error('Sign in is required for cloud sync');
    switch (mutation.kind) {
      case 'progress':
        await reducers.upsertPlanProgress({
          buildId: mutation.progress.buildId,
          progressJson: JSON.stringify(mutation.progress),
        });
        return;
      case 'progress-reset':
        await reducers.deletePlanProgress({ buildId: mutation.buildId });
        return;
      case 'preferences':
        await reducers.upsertUserPreferences({
          preferencesJson: JSON.stringify(mutation.preferences),
        });
        return;
      case 'inventory':
        await reducers.upsertUserInventory({
          inventoryJson: JSON.stringify(mutation.inventory),
        });
        return;
      case 'dataset-review':
        await reducers.upsertDatasetReview({
          buildId: mutation.receipt.buildId,
          receiptJson: JSON.stringify(mutation.receipt),
        });
        return;
      case 'dataset-review-delete':
        await reducers.deleteDatasetReview({ buildId: mutation.buildId });
        return;
      case 'dataset-version-update':
        await reducers.applyDatasetVersionUpdate({
          buildId: mutation.buildId,
          expectedHeadRevisionId: mutation.expectedHeadRevisionId,
          revisionId: mutation.revisionId,
          targetDatasetVersion: mutation.targetDatasetVersion,
        });
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

    async importBuildRecords(records) {
      if (!reducers || !accountSubject) {
        throw new Error('Sign in is required for cloud import');
      }
      const subject = accountSubject;
      const snapshot = getCloudSnapshot();
      const pending = await pendingQueue.list(subject);
      for (const record of records) {
        const pendingForBuild = pending.filter(
          (revision) => revision.buildId === record.profile.id,
        );
        let parentRevisionId =
          pendingForBuild.at(-1)?.revisionId ??
          snapshot.builds.find((build) => build.id === record.profile.id)
            ?.headRevisionId;
        for (const revision of record.revisions) {
          await pendingQueue.enqueue({
            subject,
            revisionId: revision.id,
            buildId: revision.buildId,
            kind: revision.kind,
            profile: revision.profile,
            ...(parentRevisionId ? { parentRevisionId } : {}),
            enqueuedAt: revision.createdAt,
            attempts: 0,
          });
          parentRevisionId = revision.id;
        }
      }
      await this.retryPending();
      const importedIds = new Set(records.map((record) => record.profile.id));
      return (await pendingQueue.list(subject)).some((revision) =>
        importedIds.has(revision.buildId),
      )
        ? 'cloud-pending'
        : 'cloud';
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
      const mutations = await pendingPlannerStateQueue.list(subject);
      mutations.sort((left, right) => {
        const priority = (mutation: PendingPlannerStateMutation) =>
          mutation.kind === 'dataset-version-update'
            ? 0
            : mutation.kind === 'dataset-review' ||
                mutation.kind === 'dataset-review-delete'
              ? 2
              : 1;
        return (
          priority(left) - priority(right) ||
          left.enqueuedAt.localeCompare(right.enqueuedAt) ||
          left.mutationId.localeCompare(right.mutationId)
        );
      });
      for (const mutation of mutations) {
        try {
          await dispatchPlannerMutation(mutation);
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

    async retryAllPending() {
      if (!reducers) return;
      await this.retryPending();
      const remainingRevisions = await pendingQueue.list(accountSubject!);
      if (remainingRevisions.length > 0) return;
      await this.retryPendingPlannerState();
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

    async resetPlanProgress(buildId) {
      await guestStore.deletePlanProgress(buildId);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'progress-reset',
        subject: accountSubject,
        mutationId: `progress:${buildId}`,
        buildId,
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

    async saveDatasetReview(receipt) {
      await datasetReviewStore.save(receipt);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'dataset-review',
        subject: accountSubject,
        mutationId: `dataset-review:${receipt.buildId}`,
        receipt,
        enqueuedAt: now(),
        attempts: 0,
      });
    },

    async deleteDatasetReview(buildId) {
      await datasetReviewStore.delete(buildId);
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      return sendPlannerMutation({
        kind: 'dataset-review-delete',
        subject: accountSubject,
        mutationId: `dataset-review:${buildId}`,
        buildId,
        enqueuedAt: now(),
        attempts: 0,
      });
    },

    async applyDatasetVersionUpdate(input) {
      if (!accountSubject) throw new Error('Sign in is required for cloud sync');
      const revisionId = input.revisionId ?? randomUUID();
      const location = await sendPlannerMutation({
        kind: 'dataset-version-update',
        subject: accountSubject,
        mutationId: `dataset-update:${input.buildId}`,
        buildId: input.buildId,
        expectedHeadRevisionId: input.expectedHeadRevisionId,
        targetDatasetVersion: input.targetDatasetVersion,
        revisionId,
        enqueuedAt: now(),
        attempts: 0,
      });
      return { revisionId, location };
    },

    async applyDatasetUpdate(request, { source }) {
      const updated = createDatasetPinnedProfile(
        request.profile,
        request.targetDatasetVersion,
      );
      if (source === 'local' || source === 'active' || !reducers) {
        const profile = await guestStore.applyDatasetUpdate(request);
        return {
          profile,
          revisionId: request.updateRevisionId,
          location: 'local' as const,
        };
      }

      const snapshot = getCloudSnapshot();
      const cloudBuild = snapshot.builds.find(
        (build) => build.id === request.profile.id,
      );
      let cloudHeadRevisionId: string;
      let createdLocalRecovery = false;
      if (cloudBuild) {
        const cloudRecord = createCloudBuildSelector()
          .select(snapshot, {
            archived: cloudBuild.archivedAt !== undefined,
          })
          .find((record) => record.profile.id === request.profile.id);
        if (
          !cloudRecord ||
          cloudRecord.kind !== request.kind ||
          fingerprintBuildInputs(cloudRecord.profile) !==
            request.expectedInputFingerprint
        ) {
          if (source !== 'local+cloud') {
            throw new Error('Build changed after the dataset preview was created');
          }
          const recovery = await save(request.profile, { kind: request.kind });
          cloudHeadRevisionId = recovery.revisionId!;
        } else {
          if (
            source === 'cloud' &&
            request.expectedHeadRevisionId !== cloudRecord.headRevisionId
          ) {
            throw new Error('Build changed after the dataset preview was created');
          }
          cloudHeadRevisionId = cloudRecord.headRevisionId;
        }
      } else {
        await guestStore.saveBuild(request.profile, {
          kind: request.kind,
          revisionId: request.recoveryRevisionId,
        });
        const recovery = await save(request.profile, { kind: request.kind });
        cloudHeadRevisionId = recovery.revisionId!;
        createdLocalRecovery = true;
      }

      const cloudUpdate = await this.applyDatasetVersionUpdate({
        buildId: request.profile.id,
        expectedHeadRevisionId: cloudHeadRevisionId,
        targetDatasetVersion: request.targetDatasetVersion,
        revisionId: request.updateRevisionId,
      });
      if (cloudUpdate.location === 'cloud-pending') {
        return {
          profile: structuredClone(request.profile),
          revisionId: cloudUpdate.revisionId,
          location: cloudUpdate.location,
        };
      }

      if (source === 'local+cloud' || createdLocalRecovery) {
        await guestStore.applyDatasetUpdate({
          ...request,
          expectedHeadRevisionId: createdLocalRecovery
            ? request.recoveryRevisionId
            : request.expectedHeadRevisionId,
        });
      }
      const receiptLocation = await this.saveDatasetReview(request.receipt);
      return {
        profile: updated,
        revisionId: cloudUpdate.revisionId,
        location: receiptLocation,
      };
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
        await pendingPlannerStateQueue.acknowledge(
          accountSubject,
          `dataset-review:${buildId}`,
        );
        await pendingPlannerStateQueue.acknowledge(
          accountSubject,
          `dataset-update:${buildId}`,
        );
      }
      await guestStore.deleteBuild(buildId);
    },
  };
}
