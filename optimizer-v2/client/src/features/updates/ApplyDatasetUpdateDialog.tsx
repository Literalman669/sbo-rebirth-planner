import { useEffect, useRef } from 'react';

export function ApplyDatasetUpdateDialog({
  buildName,
  pinnedVersion,
  targetVersion,
  busy,
  onConfirm,
  onCancel,
}: {
  buildName: string;
  pinnedVersion: string;
  targetVersion: string;
  busy: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="dataset-dialog-backdrop">
      <div
        ref={dialogRef}
        className="dataset-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dataset-update-dialog-heading"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onCancel();
          }
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled)',
            );
            if (!controls || controls.length === 0) return;
            const first = controls[0]!;
            const last = controls[controls.length - 1]!;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <p className="eyebrow">Recoverable revision</p>
        <h2 id="dataset-update-dialog-heading">Update {buildName}</h2>
        <p><strong>{pinnedVersion}</strong> → <strong>{targetVersion}</strong></p>
        <p>
          Only the dataset pin changes. Stats, equipment, inventory, level, and
          floor stay the same.
        </p>
        <p>A recovery snapshot is kept in build history before the update.</p>
        <div className="dataset-update-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Updating…' : 'Confirm dataset update'}
          </button>
        </div>
      </div>
    </div>
  );
}
