import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';
import { Outlet } from 'react-router-dom';

type AppProps = {
  release: DatasetRelease;
  source: 'live' | 'fallback';
};

export function App({ release, source }: AppProps) {
  return (
    <div className="app-shell">
      <header>
        <h1>SBO:Rebirth Build Optimizer</h1>
        <p>Dataset {release.version} · {source}</p>
      </header>
      <Outlet />
    </div>
  );
}

export function ConnectedApp() {
  const { release, source } = usePublicRelease();

  return <App release={release} source={source} />;
}
