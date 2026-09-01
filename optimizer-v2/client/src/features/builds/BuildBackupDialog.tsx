import { useState } from 'react';
import {
  createBuildBackup,
  serializeBuildBackup,
  type PortableBuildRecord,
} from '../../domain/build/portable';

export function BuildBackupDialog({
  records,
  cloudAvailable,
  onClose,
}: {
  records: readonly PortableBuildRecord[];
  cloudAvailable: boolean;
  onClose(): void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    try {
      const text = serializeBuildBackup(
        createBuildBackup({
          scope: 'library',
          exportedAt: new Date().toISOString(),
          records,
        }),
      );
      const url = URL.createObjectURL(
        new Blob([text], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'sbo-rebirth-build-library-v1.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Build library backup downloaded.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Build export failed');
    }
  };

  return (
    <div className="build-portable-backdrop">
      <section
        className="build-portable-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Build backups"
      >
        <header>
          <div>
            <p className="eyebrow">Portable recovery</p>
            <h3>Build backups</h3>
          </div>
          <button type="button" autoFocus onClick={onClose}>Close</button>
        </header>
        <p>{records.length} build{records.length === 1 ? '' : 's'} ready.</p>
        {!cloudAvailable ? (
          <p className="dataset-warning">
            Cloud builds are unavailable; this backup contains local records only.
          </p>
        ) : null}
        <button type="button" disabled={records.length === 0} onClick={download}>
          Download library backup
        </button>
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </section>
    </div>
  );
}
