import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import type { GuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import type { PendingRevisionQueue } from '../../infrastructure/cloud/pendingRevisionQueue';
import type { PendingPlannerStateQueue } from '../../infrastructure/cloud/pendingPlannerStateQueue';
import { profileFingerprint } from '../../infrastructure/cloud/buildMappers';
import { useCloudBuilds } from '../../infrastructure/cloud/useCloudBuilds';
import { useBuildDraft } from './BuildDraftContext';
import { CloudBuildsContext } from './CloudBuildsContext';
import { useOptionalPlannerState } from './PlannerStateContext';
import { useOptionalInventory } from './InventoryContext';
import { mergeInventoryStates } from '../../domain/inventory/state';

type CloudBuildsProviderProps = PropsWithChildren<{
  guestStore?: GuestBuildStore;
  pendingQueue?: PendingRevisionQueue;
  pendingPlannerStateQueue?: PendingPlannerStateQueue;
}>;

export function CloudBuildsProvider({
  children,
  guestStore,
  pendingQueue,
  pendingPlannerStateQueue,
}: CloudBuildsProviderProps) {
  const cloud = useCloudBuilds({
    guestStore,
    pendingQueue,
    pendingPlannerStateQueue,
  });
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const {
    draft,
    hasActiveDraft,
    isHydrated,
    setCloudPersistenceStatus,
  } = useBuildDraft();
  const planner = useOptionalPlannerState();
  const inventory = useOptionalInventory();
  const lastDraftFingerprint = useRef(new Map<string, string>());
  const lastProgressFingerprint = useRef(new Map<string, string>());
  const lastPreferencesFingerprint = useRef<string | null>(null);
  const lastObservedCloudProgress = useRef(new Map<string, string>());
  const lastObservedCloudPreferences = useRef<string | null>(null);
  const lastInventoryFingerprint = useRef<string | null>(null);
  const lastObservedCloudInventory = useRef<string | null>(null);
  const inventoryAttached = useRef(false);
  const remoteInventoryApplyPending = useRef(false);
  const isCloudEnrolled = cloud.cloudBuilds.some(
    (build) => build.profile.id === draft.id,
  );

  useEffect(() => {
    lastDraftFingerprint.current.clear();
    lastProgressFingerprint.current.clear();
    lastPreferencesFingerprint.current = null;
    lastObservedCloudProgress.current.clear();
    lastObservedCloudPreferences.current = null;
    lastInventoryFingerprint.current = null;
    lastObservedCloudInventory.current = null;
    inventoryAttached.current = false;
    remoteInventoryApplyPending.current = false;
  }, [cloud.repository]);

  useEffect(() => {
    if (
      !inventory?.isHydrated ||
      !cloud.isAuthenticated ||
      !cloud.isReady
    ) {
      return;
    }
    const remote = cloud.cloudInventory;
    if (!remote) {
      inventoryAttached.current = true;
      return;
    }
    const remoteFingerprint = JSON.stringify(remote);
    if (lastObservedCloudInventory.current === remoteFingerprint) return;
    const next = inventoryAttached.current
      ? remote
      : mergeInventoryStates(inventory.inventory, remote);
    inventoryAttached.current = true;
    lastObservedCloudInventory.current = remoteFingerprint;
    lastInventoryFingerprint.current = remoteFingerprint;
    if (JSON.stringify(inventory.inventory) !== JSON.stringify(next)) {
      remoteInventoryApplyPending.current = true;
      inventory.replaceInventory(next);
    }
  }, [
    cloud.cloudInventory,
    cloud.isAuthenticated,
    cloud.isReady,
    inventory,
  ]);

  useEffect(() => {
    if (!planner?.isHydrated || !cloud.isReady) return;
    if (cloud.cloudPreferences) {
      const cloudFingerprint = JSON.stringify(cloud.cloudPreferences);
      if (lastObservedCloudPreferences.current !== cloudFingerprint) {
        lastObservedCloudPreferences.current = cloudFingerprint;
        if (JSON.stringify(planner.preferences) !== cloudFingerprint) {
          lastPreferencesFingerprint.current = cloudFingerprint;
          planner.updatePreferences(cloud.cloudPreferences);
        }
      }
    }

    const cloudProgress = cloud.cloudPlanProgress.find(
      (candidate) => candidate.buildId === draft.id,
    );
    if (cloudProgress) {
      const cloudFingerprint = JSON.stringify(cloudProgress);
      if (
        lastObservedCloudProgress.current.get(draft.id) !== cloudFingerprint
      ) {
        lastObservedCloudProgress.current.set(draft.id, cloudFingerprint);
        if (JSON.stringify(planner.progress) !== cloudFingerprint) {
          lastProgressFingerprint.current.set(draft.id, cloudFingerprint);
          planner.updateProgress(cloudProgress);
        }
      }
    }
  }, [
    cloud.cloudPlanProgress,
    cloud.cloudPreferences,
    cloud.isReady,
    draft.id,
    planner,
  ]);

  useEffect(() => {
    if (
      !cloud.isAuthenticated ||
      !cloud.isReady ||
      cloud.needsGuestImport ||
      (!isCloudEnrolled && !planner?.isHydrated && !inventory?.isHydrated)
    ) {
      if (!cloud.isAuthenticated || !isCloudEnrolled) {
        setCloudPersistenceStatus(null);
      }
      if (!cloud.isAuthenticated) inventory?.setCloudPersistenceStatus(null);
      return;
    }
    const draftFingerprint = profileFingerprint(draft);
    const progressFingerprint = planner
      ? JSON.stringify(planner.progress)
      : null;
    const preferencesFingerprint = planner
      ? JSON.stringify(planner.preferences)
      : null;
    const inventoryFingerprint = inventory
      ? JSON.stringify(inventory.inventory)
      : null;
    const shouldSaveDraft =
      isCloudEnrolled &&
      isHydrated &&
      hasActiveDraft &&
      lastDraftFingerprint.current.get(draft.id) !== draftFingerprint;
    const shouldSaveProgress =
      Boolean(planner?.isHydrated) &&
      isCloudEnrolled &&
      planner?.progress.buildId === draft.id &&
      lastProgressFingerprint.current.get(draft.id) !== progressFingerprint;
    const shouldSavePreferences =
      Boolean(planner?.isHydrated) &&
      lastPreferencesFingerprint.current !== preferencesFingerprint;
    const shouldSaveInventory =
      Boolean(inventory?.isHydrated) &&
      !remoteInventoryApplyPending.current &&
      lastInventoryFingerprint.current !== inventoryFingerprint;
    if (
      !shouldSaveDraft &&
      !shouldSaveProgress &&
      !shouldSavePreferences &&
      !shouldSaveInventory
    ) {
      setCloudPersistenceStatus(
        cloud.pendingCount + cloud.pendingPlannerStateCount > 0
          ? 'sync-queued'
          : 'synced',
      );
      inventory?.setCloudPersistenceStatus(
        cloud.pendingCount + cloud.pendingPlannerStateCount > 0
          ? 'sync-queued'
          : 'synced',
      );
      remoteInventoryApplyPending.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await Promise.all([
            shouldSaveDraft
              ? cloud.repository.save(draft)
              : Promise.resolve(null),
            shouldSaveProgress && planner
              ? cloud.repository.savePlanProgress(planner.progress)
              : Promise.resolve(null),
            shouldSavePreferences && planner
              ? cloud.repository.savePreferences(planner.preferences)
              : Promise.resolve(null),
            shouldSaveInventory && inventory
              ? cloud.repository.saveInventory(inventory.inventory)
              : Promise.resolve(null),
          ]);
          if (shouldSaveDraft) {
            lastDraftFingerprint.current.set(draft.id, draftFingerprint);
          }
          if (shouldSaveProgress && progressFingerprint) {
            lastProgressFingerprint.current.set(
              draft.id,
              progressFingerprint,
            );
          }
          if (shouldSavePreferences) {
            lastPreferencesFingerprint.current = preferencesFingerprint;
          }
          if (shouldSaveInventory) {
            lastInventoryFingerprint.current = inventoryFingerprint;
          }
          const queued = results.some(
            (result) =>
              result === 'cloud-pending' ||
              (typeof result === 'object' &&
                result !== null &&
                result.location === 'cloud-pending'),
          );
          setCloudPersistenceStatus(queued ? 'sync-queued' : 'synced');
          inventory?.setCloudPersistenceStatus(
            queued ? 'sync-queued' : 'synced',
          );
        } catch {
          setCloudPersistenceStatus('error');
          inventory?.setCloudPersistenceStatus('error');
        } finally {
          await cloud.refreshPending();
        }
      })();
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [
    cloud.isAuthenticated,
    cloud.isReady,
    cloud.needsGuestImport,
    cloud.pendingCount,
    cloud.pendingPlannerStateCount,
    isCloudEnrolled,
    cloud.repository,
    cloud.refreshPending,
    draft,
    hasActiveDraft,
    isHydrated,
    planner,
    inventory,
    setCloudPersistenceStatus,
  ]);

  return (
    <CloudBuildsContext.Provider value={cloud}>
      {cloud.isAuthenticated && cloud.legacyPendingCount > 0 ? (
        <aside className="dataset-warning" role="status">
          <p>
            An older pending cloud revision is stored without an account. Assign
            it only if it belongs to the account you just signed into.
          </p>
          <button
            type="button"
            onClick={() => {
              setLegacyError(null);
              void cloud.claimLegacyPending().catch((error: unknown) =>
                setLegacyError(
                  error instanceof Error ? error.message : 'Assignment failed',
                ),
              );
            }}
          >
            Assign to this account
          </button>
          {legacyError ? <p role="alert">{legacyError}</p> : null}
        </aside>
      ) : null}
      {children}
    </CloudBuildsContext.Provider>
  );
}
