import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { useAuthSession } from '../../app/providers/AuthContext';
import { useCloudData } from '../../app/providers/CloudDataContext';
import { DbConnection } from '../../module_bindings';
import {
  createGuestBuildStore,
  type GuestBuildStore,
} from '../storage/guestBuildStore';
import {
  createBuildRepository,
  createCloudBuildSelector,
  type BuildRepository,
  type CloudBuildRecord,
  type CloudReducers,
  type CloudSnapshot,
} from './buildRepository';
import {
  createPendingRevisionQueue,
  type PendingRevisionQueue,
} from './pendingRevisionQueue';
import { generateShareId } from '../../features/share/shareId';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import {
  createPendingPlannerStateQueue,
  type PendingPlannerStateQueue,
} from './pendingPlannerStateQueue';

const defaultGuestStore = createGuestBuildStore();
const defaultPendingQueue = createPendingRevisionQueue();
const defaultPendingPlannerStateQueue = createPendingPlannerStateQueue();

type UseCloudBuildsOptions = {
  guestStore?: GuestBuildStore;
  pendingQueue?: PendingRevisionQueue;
  pendingPlannerStateQueue?: PendingPlannerStateQueue;
};

export type CloudBuildsState = {
  repository: BuildRepository;
  cloudBuilds: CloudBuildRecord[];
  archivedCloudBuilds: CloudBuildRecord[];
  cloudPlanProgress: readonly PlanProgress[];
  cloudPreferences: PlannerPreferences | null;
  isAuthenticated: boolean;
  isReady: boolean;
  needsGuestImport: boolean;
  pendingCount: number;
  pendingPlannerStateCount: number;
  legacyPendingCount: number;
  refreshPending(): Promise<void>;
  claimLegacyPending(): Promise<void>;
  createShare(buildId: string): Promise<string>;
  revokeShare(shareId: string): Promise<void>;
};

export function useCloudBuilds({
  guestStore = defaultGuestStore,
  pendingQueue = defaultPendingQueue,
  pendingPlannerStateQueue = defaultPendingPlannerStateQueue,
}: UseCloudBuildsOptions = {}): CloudBuildsState {
  const auth = useAuthSession();
  const cloud = useCloudData();
  const connectionState = useSpacetimeDB();
  const connection = connectionState.getConnection() as DbConnection | null;
  const snapshotRef = useRef<CloudSnapshot>({
    builds: cloud.builds,
    revisions: cloud.revisions,
    equipment: cloud.equipment,
    ownedItems: cloud.ownedItems,
  });
  snapshotRef.current = {
    builds: cloud.builds,
    revisions: cloud.revisions,
    equipment: cloud.equipment,
    ownedItems: cloud.ownedItems,
  };
  const selectorRef = useRef(createCloudBuildSelector());
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingPlannerStateCount, setPendingPlannerStateCount] = useState(0);
  const [legacyPendingCount, setLegacyPendingCount] = useState(0);

  const reducers = useMemo<CloudReducers | undefined>(() => {
    if (
      auth.status !== 'authenticated' ||
      !auth.subject ||
      !connectionState.isActive ||
      !connection
    ) {
      return undefined;
    }
    return {
      saveBuildRevision: (args) =>
        connection.reducers.saveBuildRevision(args),
      completeGuestImport: () =>
        connection.reducers.completeGuestImport({}),
      restoreBuildRevision: (args) =>
        connection.reducers.restoreBuildRevision(args),
      deleteBuild: (args) => connection.reducers.deleteBuild(args),
      upsertPlanProgress: (args) =>
        connection.reducers.upsertPlanProgress(args),
      upsertUserPreferences: (args) =>
        connection.reducers.upsertUserPreferences(args),
      renameBuild: (args) => connection.reducers.renameBuild(args),
      setBuildArchived: (args) =>
        connection.reducers.setBuildArchived(args),
    };
  }, [auth.status, auth.subject, connection, connectionState.isActive]);

  const repository = useMemo(
    () =>
      createBuildRepository({
        guestStore,
        pendingQueue,
        pendingPlannerStateQueue,
        accountSubject: reducers ? auth.subject : undefined,
        reducers,
        getCloudSnapshot: () => snapshotRef.current,
      }),
    [
      auth.subject,
      guestStore,
      pendingPlannerStateQueue,
      pendingQueue,
      reducers,
    ],
  );
  const selectedCloudBuilds = useMemo(
    () => ({
      active: selectorRef.current.select(snapshotRef.current),
      archived: selectorRef.current.select(snapshotRef.current, {
        archived: true,
      }),
    }),
    [cloud.builds, cloud.equipment, cloud.ownedItems, cloud.revisions],
  );
  const refreshPending = useCallback(async () => {
    const [scoped, plannerState, legacy] = await Promise.all([
      auth.subject ? pendingQueue.list(auth.subject) : Promise.resolve([]),
      auth.subject
        ? pendingPlannerStateQueue.list(auth.subject)
        : Promise.resolve([]),
      pendingQueue.listLegacyUnscoped(),
    ]);
    setPendingCount(scoped.length);
    setPendingPlannerStateCount(plannerState.length);
    setLegacyPendingCount(legacy.length);
  }, [auth.subject, pendingPlannerStateQueue, pendingQueue]);
  const claimLegacyPending = useCallback(async () => {
    if (auth.status !== 'authenticated' || !auth.subject) {
      throw new Error('Sign in is required to assign pending revisions');
    }
    await pendingQueue.claimLegacyUnscoped(auth.subject);
    await repository.retryPending();
    await refreshPending();
  }, [auth.status, auth.subject, pendingQueue, refreshPending, repository]);
  const createShare = useCallback(
    async (buildId: string) => {
      if (
        auth.status !== 'authenticated' ||
        !connectionState.isActive ||
        !connection
      ) {
        throw new Error('Sign in is required to share a build');
      }
      const shareId = generateShareId();
      await connection.reducers.createBuildShare({ buildId, shareId });
      return shareId;
    }, [auth.status, connection, connectionState.isActive],
  );
  const revokeShare = useCallback(
    async (shareId: string) => {
      if (
        auth.status !== 'authenticated' ||
        !connectionState.isActive ||
        !connection
      ) {
        throw new Error('Sign in is required to revoke a share');
      }
      await connection.reducers.revokeBuildShare({ shareId });
    }, [auth.status, connection, connectionState.isActive],
  );

  useEffect(() => {
    void refreshPending();
  }, [pendingQueue, refreshPending]);

  useEffect(() => {
    if (!reducers || !connectionState.isActive) return;
    const retry = () => {
      void Promise.all([
        repository.retryPending(),
        repository.retryPendingPlannerState(),
      ]).finally(() => void refreshPending());
    };
    retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [
    connectionState.isActive,
    reducers,
    refreshPending,
    repository,
  ]);

  return {
    repository,
    cloudBuilds: selectedCloudBuilds.active,
    archivedCloudBuilds: selectedCloudBuilds.archived,
    cloudPlanProgress: cloud.planProgress,
    cloudPreferences: cloud.preferences,
    isAuthenticated: auth.status === 'authenticated',
    isReady: cloud.isReady,
    needsGuestImport:
      auth.status === 'authenticated' &&
      cloud.isReady &&
      cloud.profiles.length === 0,
    pendingCount,
    pendingPlannerStateCount,
    legacyPendingCount,
    refreshPending,
    claimLegacyPending,
    createShare,
    revokeShare,
  };
}
