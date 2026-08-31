import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { SignInControl } from '../features/auth/SignInControl';
import type { DatasetSource } from '../infrastructure/spacetime/datasetSelection';
import { GlobalNavigation } from '../features/shell/GlobalNavigation';

type AppProps = {
  release: DatasetRelease;
  source: DatasetSource;
  authControl?: ReactNode;
  warning?: string | null;
};

export function App({ release, source, authControl, warning }: AppProps) {
  const location = useLocation();

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
      <GlobalNavigation />
      <Outlet />
    </div>
  );
}

export function ConnectedApp() {
  const { release, source, warning } = usePublicRelease();

  return (
    <App
      release={release}
      source={source}
      warning={warning}
      authControl={<SignInControl />}
    />
  );
}
