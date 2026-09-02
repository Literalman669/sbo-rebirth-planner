import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function ProgressLimitRecovery({
  message,
  onReset,
}: {
  message: string;
  onReset(): void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);
  return (
    <main className="progress-screen progress-limit-recovery">
      <h2 data-screen-heading tabIndex={-1}>Progress limit reached</h2>
      <p>{message}. Existing progress was kept unchanged.</p>
      <p>Export a private backup before resetting if you want a recovery copy.</p>
      <div className="progress-history__actions">
        <Link to="/builds">Export build backup</Link>
        <button type="button" className="danger-button" onClick={() => setConfirming(true)}>
          Reset progress
        </button>
      </div>
      {confirming ? (
        <div className="confirmation-dialog-backdrop" role="presentation">
          <div
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="limit-reset-progress-heading"
            aria-describedby="limit-reset-progress-description"
          >
            <h3 id="limit-reset-progress-heading">Reset progress?</h3>
            <p id="limit-reset-progress-description">
              This permanently clears the wallet, notes, manual choices, and journey history for this build.
            </p>
            <div className="dialog-actions">
              <button ref={cancelRef} type="button" onClick={() => setConfirming(false)}>
                Cancel reset
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  setConfirming(false);
                  void onReset();
                }}
              >
                Reset permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
