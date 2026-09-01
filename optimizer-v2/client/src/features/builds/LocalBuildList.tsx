import type { CharacterProfile } from '../../domain/build/model';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';

type LocalBuildListProps = {
  builds: readonly GuestBuildListResult[];
  onLoad(profile: CharacterProfile): void;
  onDelete(id: string, name: string): void;
  onDuplicate?(id: string): void;
  onArchive?(id: string, archived: boolean): void;
  onExport?(profile: CharacterProfile): void;
  onCompare?(id: string): void;
  onSaveAsPreset?(profile: CharacterProfile): void;
  renamingId?: string | null;
  renameValue?: string;
  onStartRename?(profile: CharacterProfile): void;
  onRenameValueChange?(value: string): void;
  onSaveRename?(): void;
  onCancelRename?(): void;
};

export function LocalBuildList({
  builds,
  onLoad,
  onDelete,
  onDuplicate,
  onArchive,
  onExport,
  onCompare,
  onSaveAsPreset,
  renamingId,
  renameValue = '',
  onStartRename,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
}: LocalBuildListProps) {
  if (builds.length === 0) {
    return <p className="empty-state">No builds match these filters.</p>;
  }

  return (
    <ul className="build-card-list">
      {builds.map((result) => {
        if (!result.ok) {
          return (
            <li className="build-card build-card--unavailable" key={result.id}>
              <span>Unavailable build {result.id}</span>
              <button
                type="button"
                aria-label={`Delete unavailable build ${result.id}`}
                onClick={() => onDelete(result.id, `unavailable build ${result.id}`)}
              >
                Delete
              </button>
            </li>
          );
        }
        const record = result.value;
        const build = record.profile;
        const name = build.name ?? `Level ${build.level} build`;
        const isRenaming = renamingId === build.id;
        const equipmentReady = Boolean(build.equipped['main-hand'] && build.equipped.armor);
        return (
          <li className="build-card" key={build.id}>
            <div className="build-card__summary">
              {isRenaming ? (
                <div className="build-rename-form">
                  <label>
                    <span>Rename {name}</span>
                    <input
                      aria-label={`Rename ${name}`}
                      autoFocus
                      maxLength={60}
                      value={renameValue}
                      onChange={(event) => onRenameValueChange?.(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={onSaveRename}>Save name</button>
                  <button type="button" onClick={onCancelRename}>Cancel</button>
                </div>
              ) : (
                <>
                  <strong>{name}</strong>
                  {record.kind === 'personal-preset' ? <span>Personal preset</span> : null}
                  <span>Level {build.level} · Floor {build.maxFloor} · {build.weaponPath}</span>
                  <small>
                    {record.archivedAt ? 'Archived' : 'Active'} · updated{' '}
                    {new Date(record.updatedAt).toLocaleDateString()} · dataset {build.datasetVersion}
                  </small>
                  <small>
                    {equipmentReady ? 'Ready to optimize · Next: review Results' : 'Setup incomplete · Next: finish equipment'}
                  </small>
                </>
              )}
            </div>
            {!isRenaming ? (
              <div className="build-card__actions">
                <button type="button" aria-label={`Load ${name}`} onClick={() => onLoad(build)}>Load</button>
                {onStartRename ? (
                  <button type="button" aria-label={`Rename ${name}`} onClick={() => onStartRename(build)}>Rename</button>
                ) : null}
                {onDuplicate ? (
                  <button type="button" aria-label={`Duplicate ${name}`} onClick={() => onDuplicate(build.id)}>Duplicate</button>
                ) : null}
                {onArchive ? (
                  <button
                    type="button"
                    aria-label={`${record.archivedAt ? 'Unarchive' : 'Archive'} ${name}`}
                    onClick={() => onArchive(build.id, !record.archivedAt)}
                  >
                    {record.archivedAt ? 'Unarchive' : 'Archive'}
                  </button>
                ) : null}
                {onExport ? (
                  <button type="button" aria-label={`Export ${name}`} onClick={() => onExport(build)}>Export</button>
                ) : null}
                {onCompare ? (
                  <button type="button" aria-label={`Compare ${name}`} onClick={() => onCompare(build.id)}>Compare</button>
                ) : null}
                {onSaveAsPreset && record.kind === 'build' ? (
                  <button type="button" aria-label={`Save ${name} as preset`} onClick={() => onSaveAsPreset(build)}>Save as preset</button>
                ) : null}
                <button type="button" aria-label={`Delete ${name}`} onClick={() => onDelete(build.id, name)}>Delete</button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
