import { useState } from 'react';
import {
  parseBuildBackup,
  planBuildImport,
  type BuildImportMode,
  type BuildImportPlan,
} from '../../domain/build/portable';

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

export function BuildImportDialog({
  existing,
  onImport,
  onClose,
}: {
  existing: ReadonlyMap<string, { headRevisionId: string }>;
  onImport(
    plan: BuildImportPlan,
  ): Promise<'local' | 'cloud' | 'cloud-pending'>;
  onClose(): void;
}) {
  const [envelopeText, setEnvelopeText] = useState<string | null>(null);
  const [mode, setMode] = useState<BuildImportMode>('duplicate');
  const [plan, setPlan] = useState<BuildImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const makePlan = (text: string, nextMode: BuildImportMode) =>
    planBuildImport(parseBuildBackup(text), existing, {
      mode: nextMode,
      randomUUID: () => crypto.randomUUID(),
    });

  const chooseMode = (nextMode: BuildImportMode) => {
    setMode(nextMode);
    setConfirmOverwrite(false);
    if (!envelopeText) return;
    try {
      setPlan(makePlan(envelopeText, nextMode));
      setError(null);
    } catch (cause) {
      setPlan(null);
      setError(cause instanceof Error ? cause.message : 'Build import failed');
    }
  };

  const submit = async () => {
    if (!plan) return;
    setError(null);
    try {
      const location = await onImport(plan);
      setMessage(
        location === 'cloud'
          ? 'Builds imported and synced.'
          : location === 'cloud-pending'
            ? 'Builds imported locally and queued for cloud sync.'
            : 'Builds imported locally.',
      );
      setConfirmOverwrite(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Build import failed');
    }
  };

  const conflictCount = plan?.preview.filter((row) => row.conflict).length ?? 0;

  return (
    <div className="build-portable-backdrop">
      <section
        className="build-portable-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Import builds"
      >
        <header>
          <div>
            <p className="eyebrow">Validated local import</p>
            <h3>Import builds</h3>
          </div>
          <button type="button" autoFocus onClick={onClose}>Close</button>
        </header>
        <label>
          <span>Choose build backup</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setError(null);
              setMessage(null);
              setConfirmOverwrite(false);
              void readTextFile(file)
                .then((text) => {
                  const next = makePlan(text, mode);
                  setEnvelopeText(text);
                  setPlan(next);
                })
                .catch((cause: unknown) => {
                  setEnvelopeText(null);
                  setPlan(null);
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'Build import failed',
                  );
                });
            }}
          />
        </label>
        {plan ? (
          <>
            <p>{plan.records.length} valid build{plan.records.length === 1 ? '' : 's'}</p>
            <ul className="build-import-preview">
              {plan.preview.map((row) => (
                <li key={`${row.sourceId}:${row.targetId}`}>
                  <strong>{row.name}</strong>
                  <span>
                    {row.kind} · dataset {row.datasetVersion} ·{' '}
                    {row.revisionCount} revision{row.revisionCount === 1 ? '' : 's'}
                  </span>
                  <small>{row.conflict ? 'Matching build found' : 'New build'}</small>
                </li>
              ))}
            </ul>
            <fieldset>
              <legend>Import mode</legend>
              <label>
                <input
                  type="radio"
                  name="build-import-mode"
                  checked={mode === 'duplicate'}
                  onChange={() => chooseMode('duplicate')}
                />
                Import as duplicates
              </label>
              <label>
                <input
                  type="radio"
                  name="build-import-mode"
                  checked={mode === 'overwrite'}
                  onChange={() => chooseMode('overwrite')}
                />
                Overwrite matching builds
              </label>
            </fieldset>
            <button
              type="button"
              onClick={() => {
                if (mode === 'overwrite' && conflictCount > 0) {
                  setConfirmOverwrite(true);
                  return;
                }
                void submit();
              }}
            >
              {mode === 'duplicate' ? 'Import as duplicates' : 'Review overwrite'}
            </button>
          </>
        ) : null}
        {confirmOverwrite ? (
          <div
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={`Overwrite ${conflictCount} matching build${conflictCount === 1 ? '' : 's'}?`}
          >
            <p>
              Existing heads remain in immutable history before imported heads
              become current.
            </p>
            <button type="button" onClick={() => setConfirmOverwrite(false)}>
              Cancel overwrite
            </button>
            <button type="button" onClick={() => void submit()}>
              Confirm recoverable overwrite
            </button>
          </div>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </section>
    </div>
  );
}
