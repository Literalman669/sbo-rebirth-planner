import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';

type BuildHistoryViewProps = {
  record: CloudBuildRecord;
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
  const { replaceDraft } = useBuildDraft();
  const [waitingForHead, setWaitingForHead] = useState<string | null>(null);
  const record = cloud?.cloudBuilds.find(
    (candidate) => candidate.profile.id === buildId,
  );

  useEffect(() => {
    if (!record || record.headRevisionId !== waitingForHead) return;
    replaceDraft(record.profile);
    navigate('/results');
  }, [navigate, record, replaceDraft, waitingForHead]);

  if (!cloud?.isAuthenticated) {
    return (
      <main className="planner-screen build-history-screen">
        <h2>Cloud history requires sign-in.</h2>
        <Link to="/">Return Home</Link>
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
          const newRevisionId = await cloud.repository.restore(
            record.profile.id,
            revisionId,
          );
          setWaitingForHead(newRevisionId);
        }}
      />
      {waitingForHead ? <p role="status">Waiting for restored head…</p> : null}
      <Link to="/">Return Home</Link>
    </main>
  );
}
