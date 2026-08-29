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

const defaultGuestStore = createGuestBuildStore();
const defaultPendingQueue = createPendingRevisionQueue();

type UseCloudBuildsOptions = {
  guestStore?: GuestBuildStore;
  pendingQueue?: PendingRevisionQueue;
};

export type CloudBuildsState = {
  repository: BuildRepository;
  cloudBuilds: CloudBuildRecord[];
  isAuthenticated: boolean;
  isReady: boolean;
  needsGuestImport: boolean;
  pendingCount: number;
  refreshPending(): Promise<void>;
};

export function useCloudBuilds({
  guestStore = defaultGuestStore,
  pendingQueue = defaultPendingQueue,
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

  const reducers = useMemo<CloudReducers | undefined>(() => {
    if (
      auth.status !== 'authenticated' ||
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
    };
  }, [auth.status, connection, connectionState.isActive]);

  const repository = useMemo(
    () =>
      createBuildRepository({
        guestStore,
        pendingQueue,
        reducers,
        getCloudSnapshot: () => snapshotRef.current,
      }),
    [guestStore, pendingQueue, reducers],
  );
  const cloudBuilds = useMemo(
    () => selectorRef.current.select(snapshotRef.current),
    [cloud.builds, cloud.equipment, cloud.ownedItems, cloud.revisions],
  );
  const refreshPending = useCallback(async () => {
    setPendingCount((await pendingQueue.list()).length);
  }, [pendingQueue]);

  useEffect(() => {
    void refreshPending();
  }, [pendingQueue, refreshPending]);

  useEffect(() => {
    if (!reducers || !connectionState.isActive) return;
    const retry = () => {
      void repository.retryPending().finally(() => void refreshPending());
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
    cloudBuilds,
    isAuthenticated: auth.status === 'authenticated',
    isReady: cloud.isReady,
    needsGuestImport:
      auth.status === 'authenticated' &&
      cloud.isReady &&
      cloud.profiles.length === 0,
    pendingCount,
    refreshPending,
  };
}
