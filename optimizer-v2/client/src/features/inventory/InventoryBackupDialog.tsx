import { useState } from 'react';
import { useInventory } from '../../app/providers/InventoryContext';
import type { InventoryImportMode } from '../../infrastructure/storage/inventoryStore';

export function InventoryBackupDialog({
  open,
  datasetVersion,
  onClose,
}: {
  open: boolean;
  datasetVersion: string;
  onClose(): void;
}) {
  const inventory = useInventory();
  const [exported, setExported] = useState('');
  const [imported, setImported] = useState('');
  const [mode, setMode] = useState<InventoryImportMode>('merge');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const runImport = async () => {
    if (mode === 'replace' && !confirmReplace) {
      setConfirmReplace(true);
      setMessage('Confirm replacement before importing.');
      return;
    }
    setError(null);
    try {
      await inventory.importBackup(imported, mode);
      setMessage(
        mode === 'merge'
          ? 'Inventory backup merged.'
          : 'Inventory backup replaced.',
      );
      setConfirmReplace(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Inventory backup is invalid',
      );
    }
  };

  return (
    <div className="inventory-backup-backdrop">
      <section
        className="inventory-backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory backups"
      >
        <header>
          <div>
            <p className="eyebrow">Local recovery</p>
            <h3>Inventory backups</h3>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        <section>
          <h4>Export</h4>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void inventory
                .exportBackup(datasetVersion)
                .then((json) => {
                  setExported(json);
                  setMessage('Inventory JSON prepared.');
                })
                .catch(() => setError('Inventory export failed'));
            }}
          >
            Export inventory JSON
          </button>
          <label>
            Exported inventory JSON
            <textarea readOnly value={exported} />
          </label>
          {exported ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(exported)}
            >
              Copy exported JSON
            </button>
          ) : null}
        </section>

        <section>
          <h4>Import</h4>
          <label>
            Paste inventory backup JSON
            <textarea
              value={imported}
              onChange={(event) => {
                setImported(event.currentTarget.value);
                setError(null);
                setConfirmReplace(false);
              }}
            />
          </label>
          <fieldset>
            <legend>Import mode</legend>
            <label><input type="radio" name="inventory-import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge</label>
            <label><input type="radio" name="inventory-import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace</label>
          </fieldset>
          <button type="button" onClick={() => void runImport()}>
            {confirmReplace ? 'Confirm replace inventory' : 'Import inventory'}
          </button>
        </section>

        <section>
          <h4>Reset</h4>
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                setMessage('Confirm reset to clear inventory.');
                return;
              }
              void inventory.resetInventory().then(() => {
                setConfirmReset(false);
                setMessage('Inventory reset.');
              });
            }}
          >
            {confirmReset ? 'Confirm reset inventory' : 'Reset inventory'}
          </button>
        </section>

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </section>
    </div>
  );
}
