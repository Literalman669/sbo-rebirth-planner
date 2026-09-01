import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import type { BuildRevisionSnapshot } from '../../domain/build/record';

type BuildHistoryViewProps = {
  record: Pick<CloudBuildRecord, 'headRevisionId' | 'profile' | 'kind' | 'history'>;
  onRestore(revisionId: string): Promise<void>;
};

export function BuildHistoryView({
  record,
  onRestore,
}: BuildHistoryViewProps) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="build-history" aria-labelledby="build-history-heading">
      <h2 id="build-history-heading">
        {record.profile.name ?? 'Cloud build'} history
      </h2>
      <ul>
        {record.history.map((item) => (
          <li key={item.revisionId}>
            <div>
              <strong>
                Level {item.profile.level} · {item.datasetVersion}
              </strong>
              <span>{item.createdAt}</span>
              {item.revisionId === record.headRevisionId ? (
                <span>Current</span>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={`Restore revision ${item.revisionId}`}
              disabled={item.revisionId === record.headRevisionId}
              onClick={() => {
                if (
                  !window.confirm(
                    `Restore the level ${item.profile.level} revision?`,
                  )
                ) {
                  return;
                }
                void onRestore(item.revisionId)
                  .then(() => setMessage('Revision restored as a new head.'))
                  .catch((error: unknown) =>
                    setMessage(
                      error instanceof Error ? error.message : 'Restore failed',
                    ),
                  );
              }}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

export function BuildHistoryScreen() {
  const { buildId } = useParams();
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const {
    isHydrated,
    loadSavedBuildHistory,
    replaceDraft,
    restoreSavedBuildRevision,
    savedBuilds,
  } = useBuildDraft();
  const [waitingForHead, setWaitingForHead] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<
    BuildRevisionSnapshot[] | null
  >(null);
  const local = savedBuilds.find(
    (candidate) => candidate.ok && candidate.value.profile.id === buildId,
  );
  const cloudRecord = cloud?.cloudBuilds.find(
    (candidate) => candidate.profile.id === buildId,
  );
  useEffect(() => {
    let active = true;
    if (!local?.ok) {
      setLocalHistory(null);
      return () => {
        active = false;
      };
    }
    void loadSavedBuildHistory(local.value.profile.id).then((history) => {
      if (active) setLocalHistory(history);
    });
    return () => {
      active = false;
    };
  }, [loadSavedBuildHistory, local?.ok, local?.ok ? local.value.profile.id : null]);
  const localRecord = local?.ok && localHistory
    ? {
        headRevisionId: local.value.headRevisionId,
        profile: local.value.profile,
        kind: local.value.kind,
        history: localHistory.map((revision) => ({
          revisionId: revision.id,
          createdAt: revision.createdAt,
          datasetVersion: revision.profile.datasetVersion,
          profile: revision.profile,
          kind: revision.kind,
        })),
      }
    : null;
  const record = localRecord ?? cloudRecord;

  useEffect(() => {
    if (!cloudRecord || cloudRecord.headRevisionId !== waitingForHead) return;
    replaceDraft(cloudRecord.profile);
    navigate('/results');
  }, [cloudRecord, navigate, replaceDraft, waitingForHead]);

  if (!isHydrated || (local?.ok && !localHistory)) {
    return (
      <main className="planner-screen build-history-screen">
        <h2>Loading build history…</h2>
      </main>
    );
  }
  if (!local?.ok && !cloud?.isAuthenticated) {
    return (
      <main className="planner-screen build-history-screen">
        <h2>Cloud history requires sign-in.</h2>
        <Link to="/builds">Return to Builds</Link>
      </main>
    );
  }
  if (!record) {
    return (
      <main className="planner-screen build-history-screen">
        <h2>Build history is unavailable.</h2>
        <Link to="/">Return Home</Link>
      </main>
    );
  }

  return (
    <main className="planner-screen build-history-screen">
      <BuildHistoryView
        record={record}
        onRestore={async (revisionId) => {
          if (localRecord) {
            await restoreSavedBuildRevision(record.profile.id, revisionId);
            navigate(record.kind === 'build' ? '/character' : '/builds/presets');
            return;
          }
          if (!cloud) throw new Error('Cloud history is unavailable');
          const newRevisionId = await cloud.repository.restore(
            record.profile.id,
            revisionId,
          );
          setWaitingForHead(newRevisionId);
        }}
      />
      {waitingForHead ? <p role="status">Waiting for restored head…</p> : null}
      <Link to="/builds">Return to Builds</Link>
    </main>
  );
}
