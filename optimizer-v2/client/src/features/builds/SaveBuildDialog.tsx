import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SaveBuildRequest } from '../../app/providers/BuildDraftContext';

export type { SaveBuildRequest } from '../../app/providers/BuildDraftContext';

export function SaveBuildDialog({
  open,
  defaultName,
  cloudAvailable,
  onSave,
  onClose,
}: {
  open: boolean;
  defaultName: string;
  cloudAvailable: boolean;
  onSave(request: SaveBuildRequest): void;
  onClose(): void;
}) {
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<SaveBuildRequest['mode']>('overwrite');
  const [destination, setDestination] =
    useState<SaveBuildRequest['destination']>('local');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setName(defaultName);
      setMode('overwrite');
      setDestination('local');
      setError(null);
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      queueMicrotask(() => nameRef.current?.focus());
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      queueMicrotask(() => returnFocusRef.current?.focus());
    }
  }, [defaultName, open]);

  const close = () => {
    onClose();
    queueMicrotask(() => returnFocusRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Build name is required');
      nameRef.current?.focus();
      return;
    }
    onSave({ name: trimmed, mode, destination });
  };

  return (
    <dialog
      ref={dialogRef}
      className="save-build-dialog"
      aria-label="Save Build"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form method="dialog" onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">Build archive</p>
            <h2>Save Build</h2>
          </div>
        </header>
        <label>
          Build Name
          <input
            ref={nameRef}
            value={name}
            maxLength={60}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <fieldset>
          <legend>Save mode</legend>
          <label>
            <input
              type="radio"
              name="save-mode"
              checked={mode === 'overwrite'}
              onChange={() => setMode('overwrite')}
            />
            Overwrite this build
          </label>
          <label>
            <input
              type="radio"
              name="save-mode"
              checked={mode === 'duplicate'}
              onChange={() => setMode('duplicate')}
            />
            Save as duplicate
          </label>
        </fieldset>
        <fieldset>
          <legend>Destination</legend>
          <label>
            <input
              type="radio"
              name="save-destination"
              checked={destination === 'local'}
              onChange={() => setDestination('local')}
            />
            Local only
          </label>
          <label>
            <input
              type="radio"
              name="save-destination"
              checked={destination === 'cloud'}
              disabled={!cloudAvailable}
              onChange={() => setDestination('cloud')}
            />
            Cloud sync
          </label>
        </fieldset>
        <div className="dialog-actions">
          <button type="button" onClick={close}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </dialog>
  );
}
