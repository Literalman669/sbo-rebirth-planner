import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { CloudBuildList } from '../builds/CloudBuildList';
import { GuestImportDialog } from '../builds/GuestImportDialog';

export function HomeScreen() {
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const {
    deleteSavedBuild,
    hasActiveDraft,
    isHydrated,
    loadSavedBuild,
    resetDraft,
    savedBuilds,
  } = useBuildDraft();
  const localProfiles = savedBuilds.flatMap((result) =>
    result.ok ? [result.value.profile] : [],
  );

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
        <section aria-label="Optional cloud sign-in">
          <p>
            Guest planning remains fully available on this device; create and
            save builds without signing in.
          </p>
          <p>Sign in is optional for cloud sync, build history, and sharing.</p>
          <p>
            Sign-in opens SpacetimeAuth. Email magic links are the configured
            durable way to sign in or create an account. Social sign-in
            requires future provider configuration.
          </p>
        </section>
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
        {cloud?.needsGuestImport && localProfiles.length > 0 ? (
          <GuestImportDialog
            builds={localProfiles}
            onImport={async (ids) => {
              await cloud.repository.importGuestBuilds(ids);
              await cloud.refreshPending();
            }}
          />
        ) : null}
        {cloud?.isAuthenticated && cloud.cloudBuilds.length > 0 ? (
          <CloudBuildList
            builds={cloud.cloudBuilds}
            onLoad={(profile) => {
              loadSavedBuild(profile);
              navigate('/results');
            }}
            onHistory={(buildId) => navigate(`/builds/${buildId}/history`)}
            onDelete={(buildId) => {
              if (!window.confirm('Delete this cloud build and its history?')) {
                return;
              }
              void cloud.repository.delete(buildId);
            }}
          />
        ) : null}
        {cloud && cloud.pendingCount > 0 ? (
          <p role="status">
            {cloud.pendingCount} cloud revision
            {cloud.pendingCount === 1 ? '' : 's'} waiting to sync.
          </p>
        ) : null}
      </div>
    </main>
  );
}
