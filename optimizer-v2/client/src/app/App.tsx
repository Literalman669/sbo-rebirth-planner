import { usePublicRelease } from '../infrastructure/spacetime/PublicDataProvider';
import type { DatasetRelease } from '../infrastructure/spacetime/releaseSelection';

type AppProps = {
  release: DatasetRelease;
  source: 'live' | 'fallback';
};

export function App({ release, source }: AppProps) {
  return (
    <main className="app-shell">
      <h1>SBO:Rebirth Build Optimizer</h1>
      <p>Dataset {release.version} · {source}</p>
    </main>
  );
}

export function ConnectedApp() {
  const { release, source } = usePublicRelease();

  return <App release={release} source={source} />;
}
