import { useState } from 'react';
import type { CharacterProfile } from '../../domain/build/model';

type GuestImportDialogProps = {
  builds: readonly CharacterProfile[];
  onImport(ids: readonly string[]): Promise<void>;
};

export function GuestImportDialog({
  builds,
  onImport,
}: GuestImportDialogProps) {
  const [selected, setSelected] = useState(
    () => new Set(builds.map((build) => build.id)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setIsSubmitting(true);
    setError(null);
    void onImport(builds.flatMap((build) => (selected.has(build.id) ? [build.id] : [])))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Import failed');
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <section
      className="guest-import panel-frame"
      aria-labelledby="guest-import-heading"
    >
      <h2 id="guest-import-heading">Bring local builds into your archive?</h2>
      <p>Select only the builds you want synced. Local copies will remain.</p>
      <ul>
        {builds.map((build) => {
          const name = build.name ?? `Level ${build.level} build`;
          return (
            <li key={build.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(build.id)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.checked) next.add(build.id);
                      else next.delete(build.id);
                      return next;
                    });
                  }}
                />
                {name}
              </label>
            </li>
          );
        })}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={isSubmitting} onClick={submit}>
        {isSubmitting ? 'Importing…' : 'Import selected'}
      </button>
    </section>
  );
}
