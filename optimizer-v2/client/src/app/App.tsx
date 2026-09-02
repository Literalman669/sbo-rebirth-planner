import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { SignInControl } from '../features/auth/SignInControl';
import type { DatasetSource } from '../infrastructure/spacetime/datasetSelection';
import { GlobalNavigation } from '../features/shell/GlobalNavigation';
import { useBuildDraft } from './providers/BuildDraftContext';
import { useOptionalInventory } from './providers/InventoryContext';
import { useOptionalPlannerState } from './providers/PlannerStateContext';
import { useOptionalDatasetUpdates } from './providers/DatasetUpdatesContext';
import { DatasetUpdateNotice } from '../features/updates/DatasetUpdateNotice';

type AppProps = {
  release: DatasetRelease;
  source: DatasetSource;
  authControl?: ReactNode;
  warning?: string | null;
  storageWarning?: string | null;
};

export function App({
  release,
  source,
  authControl,
  warning,
  storageWarning,
}: AppProps) {
  const location = useLocation();
  const updates = useOptionalDatasetUpdates();

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document
      .querySelector<HTMLElement>('[data-screen-heading]')
      ?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header>
        <div className="app-header-row">
          <h1>
            <Link to="/">SBO:Rebirth Build Optimizer</Link>
          </h1>
          {authControl}
        </div>
        <p className="dataset-status">
          Dataset {release.version} · {source} · verified {release.lastReviewedAt}
        </p>
        {warning && <p className="dataset-warning" role="status">{warning}</p>}
      </header>
      {updates && updates.unreviewedCount > 0 ? (
        <DatasetUpdateNotice count={updates.unreviewedCount} />
      ) : null}
      <GlobalNavigation />
      {storageWarning ? (
        <aside className="dataset-warning local-storage-warning" role="alert">
          <strong>Local storage needs attention.</strong>
          <p>{storageWarning}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </aside>
      ) : null}
      <Outlet />
    </div>
  );
}

export function ConnectedApp() {
  const { release, source, warning } = usePublicRelease();
  const draft = useBuildDraft();
  const inventory = useOptionalInventory();
  const planner = useOptionalPlannerState();
  const storageWarning =
    draft.storageError ??
    inventory?.storageError ??
    planner?.storageError ??
    null;

  return (
    <App
      release={release}
      source={source}
      warning={warning}
      storageWarning={storageWarning}
      authControl={<SignInControl />}
    />
  );
}
