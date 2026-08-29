import { useEffect, type PropsWithChildren } from 'react';
import type { GuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import type { PendingRevisionQueue } from '../../infrastructure/cloud/pendingRevisionQueue';
import { useCloudBuilds } from '../../infrastructure/cloud/useCloudBuilds';
import { useBuildDraft } from './BuildDraftContext';
import { CloudBuildsContext } from './CloudBuildsContext';

type CloudBuildsProviderProps = PropsWithChildren<{
  guestStore?: GuestBuildStore;
  pendingQueue?: PendingRevisionQueue;
}>;

export function CloudBuildsProvider({
  children,
  guestStore,
  pendingQueue,
}: CloudBuildsProviderProps) {
  const cloud = useCloudBuilds({ guestStore, pendingQueue });
  const { draft, hasActiveDraft, isHydrated } = useBuildDraft();

  useEffect(() => {
    if (
      !cloud.isAuthenticated ||
      !cloud.isReady ||
      cloud.needsGuestImport ||
      !isHydrated ||
      !hasActiveDraft
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void cloud.repository
        .save(draft)
        .finally(() => void cloud.refreshPending());
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [
    cloud.isAuthenticated,
    cloud.isReady,
    cloud.needsGuestImport,
    cloud.repository,
    cloud.refreshPending,
    draft,
    hasActiveDraft,
    isHydrated,
  ]);

  return (
    <CloudBuildsContext.Provider value={cloud}>
      {children}
    </CloudBuildsContext.Provider>
  );
}
