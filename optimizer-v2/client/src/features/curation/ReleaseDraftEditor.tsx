import { useState, type FormEvent } from 'react';

export interface DraftRecord {
  version: string;
  formulaSetVersion: string;
  sourceSummary: string;
  lastReviewedAt: string;
  status: string;
}

type ReleaseDraftEditorProps = {
  drafts: readonly DraftRecord[];
  selectedVersion: string | null;
  counts: { equipment: number; formulas: number; sources: number };
  onSelect(version: string): void;
  onCreate(input: {
    version: string;
    formulaSetVersion: string;
    sourceSummary: string;
    lastReviewedAt: string;
  }): Promise<void> | void;
};

export function ReleaseDraftEditor({
  drafts,
  selectedVersion,
  counts,
  onSelect,
  onCreate,
}: ReleaseDraftEditorProps) {
  const [version, setVersion] = useState('');
  const [summary, setSummary] = useState('');
  const [reviewedAt, setReviewedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onCreate({
        version,
        formulaSetVersion: 'sbor-stats-v1',
        sourceSummary: summary,
        lastReviewedAt: reviewedAt,
      });
      setVersion('');
      setSummary('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="curation-card release-drafts">
      <p className="curation-eyebrow">Release assembly</p>
      <h2>Draft dataset</h2>
      {drafts.length > 0 && (
        <label>
          Active draft
          <select
            value={selectedVersion ?? ''}
            onChange={(event) => onSelect(event.currentTarget.value)}
          >
            {drafts.map((draft) => (
              <option key={draft.version} value={draft.version}>
                {draft.version} · {draft.status}
              </option>
            ))}
          </select>
        </label>
      )}
      <dl className="draft-counts">
        <div><dt>Equipment</dt><dd>{counts.equipment}</dd></div>
        <div><dt>Formulas</dt><dd>{counts.formulas}</dd></div>
        <div><dt>Sources</dt><dd>{counts.sources}</dd></div>
      </dl>
      <details>
        <summary>Create another draft</summary>
        <form className="curation-form" onSubmit={(event) => void submit(event)}>
          <label>
            Version
            <input
              required
              placeholder="2026.08.29.1"
              pattern="\d{4}\.\d{2}\.\d{2}\.\d+"
              value={version}
              onChange={(event) => setVersion(event.currentTarget.value)}
            />
          </label>
          <label>
            Source summary
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(event) => setSummary(event.currentTarget.value)}
            />
          </label>
          <label>
            Last reviewed
            <input
              required
              type="date"
              value={reviewedAt}
              onChange={(event) => setReviewedAt(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Create release draft</button>
        </form>
      </details>
      {error && <p className="curation-error" role="alert">{error}</p>}
    </section>
  );
}
