import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';

export function HomeScreen() {
  const navigate = useNavigate();
  const {
    deleteSavedBuild,
    hasActiveDraft,
    isHydrated,
    loadSavedBuild,
    resetDraft,
    savedBuilds,
  } = useBuildDraft();

  if (!isHydrated) {
    return <main className="home-screen"><p>Loading draft</p></main>;
  }

  return (
    <main className="home-screen">
      <div className="home-content">
        <div className="home-actions">
        <button
          type="button"
          onClick={() => {
            void resetDraft().then(() => navigate('/character'));
          }}
        >
          Create Build
        </button>
        {hasActiveDraft ? (
          <button type="button" onClick={() => navigate('/character')}>
            Resume Build
          </button>
        ) : null}
        </div>
        {savedBuilds.length > 0 ? (
          <section className="saved-builds" aria-labelledby="saved-builds-heading">
            <h2 id="saved-builds-heading">Saved Builds</h2>
            <ul>
              {savedBuilds.map((result) => {
                if (!result.ok) {
                  return (
                    <li key={result.id}>
                      <span>Unavailable build {result.id}</span>
                      <button
                        type="button"
                        aria-label={`Delete unavailable build ${result.id}`}
                        onClick={() => void deleteSavedBuild(result.id)}
                      >
                        Delete
                      </button>
                    </li>
                  );
                }
                const build = result.value.profile;
                const name = build.name ?? `Level ${build.level} build`;
                return (
                  <li key={build.id}>
                    <div>
                      <strong>{name}</strong>
                      <span>Level {build.level} · Floor {build.maxFloor}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Load ${name}`}
                      onClick={() => {
                        loadSavedBuild(build);
                        navigate('/character');
                      }}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      onClick={() => void deleteSavedBuild(build.id)}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
