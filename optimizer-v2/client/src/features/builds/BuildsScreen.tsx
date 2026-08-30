import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { CloudBuildList } from './CloudBuildList';
import { GuestImportDialog } from './GuestImportDialog';
import { LocalBuildList } from './LocalBuildList';

export function BuildsScreen() {
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const {
    deleteSavedBuild,
    isHydrated,
    loadSavedBuild,
    savedBuilds,
  } = useBuildDraft();
  const localProfiles = savedBuilds.flatMap((result) =>
    result.ok ? [result.value.profile] : [],
  );

  if (!isHydrated) return <main className="builds-screen"><p>Loading builds</p></main>;

  return (
    <main className="builds-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Build library</p>
        <h2>Your Builds</h2>
        <p>Load a route, review its history, or clean up builds you no longer need.</p>
      </header>

      <section className="saved-builds build-library-panel" aria-labelledby="local-builds-heading">
        <h3 id="local-builds-heading">Saved on this device</h3>
        <LocalBuildList
          builds={savedBuilds}
          onLoad={(build) => {
            loadSavedBuild(build);
            navigate('/character');
          }}
          onDelete={(id) => void deleteSavedBuild(id)}
        />
      </section>

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
            if (!window.confirm('Delete this cloud build and its history?')) return;
            void cloud.repository.delete(buildId);
          }}
        />
      ) : null}

      {cloud?.isAuthenticated && cloud.archivedCloudBuilds.length > 0 ? (
        <CloudBuildList
          builds={cloud.archivedCloudBuilds}
          onLoad={(profile) => {
            loadSavedBuild(profile);
            navigate('/results');
          }}
          onHistory={(buildId) => navigate(`/builds/${buildId}/history`)}
          onDelete={(buildId) => void cloud.repository.delete(buildId)}
        />
      ) : null}

      {cloud && cloud.pendingCount + cloud.pendingPlannerStateCount > 0 ? (
        <p role="status">
          {cloud.pendingCount + cloud.pendingPlannerStateCount} cloud change
          {cloud.pendingCount + cloud.pendingPlannerStateCount === 1 ? '' : 's'} waiting to sync.
        </p>
      ) : null}
    </main>
  );
}
