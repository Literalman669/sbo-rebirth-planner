import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';
import { Link, Outlet } from 'react-router-dom';

type AppProps = {
  release: DatasetRelease;
  source: 'live' | 'fallback';
};

export function App({ release, source }: AppProps) {
  return (
    <div className="app-shell">
      <header>
        <h1>
          <Link to="/">SBO:Rebirth Build Optimizer</Link>
        </h1>
        <p className="dataset-status">Dataset {release.version} · {source}</p>
      </header>
      <Outlet />
    </div>
  );
}

export function ConnectedApp() {
  const { release, source } = usePublicRelease();

  return <App release={release} source={source} />;
}
