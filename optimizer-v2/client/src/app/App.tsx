import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';
import { Link, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SignInControl } from '../features/auth/SignInControl';

type AppProps = {
  release: DatasetRelease;
  source: 'live' | 'fallback';
  authControl?: ReactNode;
};

export function App({ release, source, authControl }: AppProps) {
  return (
    <div className="app-shell">
      <header>
        <div className="app-header-row">
          <h1>
            <Link to="/">SBO:Rebirth Build Optimizer</Link>
          </h1>
          {authControl}
        </div>
        <p className="dataset-status">Dataset {release.version} · {source}</p>
      </header>
      <Outlet />
    </div>
  );
}

export function ConnectedApp() {
  const { release, source } = usePublicRelease();

  return (
    <App
      release={release}
      source={source}
      authControl={<SignInControl />}
    />
  );
}
