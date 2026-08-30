import { Link, useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { firstIncompleteStep } from '../planner/completeness';
import { createVerifiedExampleBuild } from './exampleBuild';

export function HomeScreen() {
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const { snapshot } = useDataset();
  const {
    draft,
    hasActiveDraft,
    isHydrated,
    loadSavedBuild,
    persistenceStatus,
    replaceDraft,
    resetDraft,
    savedBuilds,
  } = useBuildDraft();

  if (!isHydrated) {
    return <main className="home-screen"><p>Loading draft</p></main>;
  }

  const nextStep = firstIncompleteStep(draft, snapshot) ?? '/results';
  const nextStepLabel = {
    '/character': 'Character',
    '/stats': 'Stats',
    '/equipment': 'Equipment',
    '/results': 'Results',
  }[nextStep];
  const recentLocalBuilds = savedBuilds
    .filter((result) => result.ok)
    .slice(0, 3);
  const example = createVerifiedExampleBuild(snapshot);

  return (
    <main className="home-screen">
      <div className="home-content">
        <header className="home-hero">
          <p className="eyebrow">Aincrad field guide</p>
          <h2>Plan the next move, not the whole game at once.</h2>
          <p>Resume your current route or start from a verified foundation.</p>
        </header>

        {hasActiveDraft ? (
          <section className="resume-card" aria-labelledby="resume-heading">
            <div>
              <p className="eyebrow">Current draft</p>
              <h3 id="resume-heading">{draft.name?.trim() || 'Untitled build'}</h3>
              <p>
                Level {draft.level} · Floor {draft.maxFloor} · Next: {nextStepLabel}
              </p>
              <span>{persistenceStatus === 'saving' ? 'Modified · saving' : 'Ready to continue'}</span>
            </div>
            <button type="button" onClick={() => navigate(nextStep)}>
              Resume Build
            </button>
          </section>
        ) : null}

        <div className="home-actions">
          <button
            type="button"
            onClick={() => void resetDraft().then(() => navigate('/character'))}
          >
            Create Build
          </button>
          {example.available ? (
            <button
              type="button"
              onClick={() => {
                replaceDraft(example.profile);
                navigate('/stats');
              }}
            >
              Try verified example
            </button>
          ) : (
            <p role="status">{example.reason}</p>
          )}
        </div>

        {recentLocalBuilds.length > 0 ? (
          <section className="recent-builds" aria-labelledby="recent-builds-heading">
            <div className="section-heading-row">
              <h3 id="recent-builds-heading">Recent builds</h3>
              <Link to="/builds">View all builds</Link>
            </div>
            <ul>
              {recentLocalBuilds.map((result) => {
                if (!result.ok) return null;
                const build = result.value.profile;
                return (
                  <li key={build.id}>
                    <button
                      type="button"
                      onClick={() => {
                        loadSavedBuild(build);
                        navigate('/character');
                      }}
                    >
                      <strong>{build.name || `Level ${build.level} build`}</strong>
                      <span>Level {build.level} · Floor {build.maxFloor}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <Link className="text-link" to="/builds">Open build library</Link>
        )}

        <details className="cloud-explainer">
          <summary>Optional cloud sync</summary>
          <p>Guest planning and local saves work without signing in.</p>
          <p>Sign in is optional for cloud sync, build history, and sharing.</p>
          <p>
            SpacetimeAuth currently uses email magic links. Additional social
            providers can be added later.
          </p>
          {cloud && cloud.pendingCount + cloud.pendingPlannerStateCount > 0 ? (
            <p role="status">Cloud changes are waiting to sync.</p>
          ) : null}
        </details>
      </div>
    </main>
  );
}
