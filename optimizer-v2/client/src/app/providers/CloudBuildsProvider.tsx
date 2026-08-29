import { useEffect, useState, type PropsWithChildren } from 'react';
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
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const { draft, hasActiveDraft, isHydrated } = useBuildDraft();
  const isCloudEnrolled = cloud.cloudBuilds.some(
    (build) => build.profile.id === draft.id,
  );

  useEffect(() => {
    if (
      !cloud.isAuthenticated ||
      !cloud.isReady ||
      cloud.needsGuestImport ||
      !isCloudEnrolled ||
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
    isCloudEnrolled,
    cloud.repository,
    cloud.refreshPending,
    draft,
    hasActiveDraft,
    isHydrated,
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
