import { useState } from 'react';

type PublishReleasePanelProps = {
  version: string | null;
  validationErrors: readonly string[];
  onPublish(version: string): Promise<void> | void;
};

export function PublishReleasePanel({
  version,
  validationErrors,
  onPublish,
}: PublishReleasePanelProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    if (!version) return;
    setError(null);
    setIsPublishing(true);
    try {
      await onPublish(version);
      setPublishedVersion(version);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <section className="curation-card publish-panel">
      <p className="curation-eyebrow">Final gate</p>
      <h2>Publish release</h2>
      {validationErrors.length > 0 ? (
        <ul className="curation-checklist">
          {validationErrors.map((validationError) => (
            <li key={validationError}>{validationError}</li>
          ))}
        </ul>
      ) : (
        <p className="curation-ready">All local release checks pass.</p>
      )}
      <button
        type="button"
        disabled={!version || validationErrors.length > 0 || isPublishing}
        onClick={() => void publish()}
      >
        {isPublishing ? 'Publishing…' : 'Publish verified release'}
      </button>
      {publishedVersion && (
        <p className="curation-success" role="status">
          Release {publishedVersion} is live.
        </p>
      )}
      {error && <p className="curation-error" role="alert">{error}</p>}
    </section>
  );
}
