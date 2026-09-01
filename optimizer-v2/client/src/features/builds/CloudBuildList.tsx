import { useState } from 'react';
import type { CharacterProfile } from '../../domain/build/model';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';

type CloudBuildListProps = {
  builds: readonly CloudBuildRecord[];
  onLoad(profile: CharacterProfile): void;
  onHistory(buildId: string): void;
  onDelete(buildId: string): void;
  onRename(buildId: string, name: string): void;
  onDuplicate(profile: CharacterProfile): void;
  onArchive(buildId: string, archived: boolean): void;
  onExport(record: CloudBuildRecord): void;
  onShare(buildId: string): void;
  onCompare?(buildId: string): void;
  onSaveAsPreset?(profile: CharacterProfile): void;
};

export function CloudBuildList({
  builds,
  onLoad,
  onHistory,
  onDelete,
  onRename,
  onDuplicate,
  onArchive,
  onExport,
  onShare,
  onCompare,
  onSaveAsPreset,
}: CloudBuildListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <section className="cloud-builds build-library-panel" aria-labelledby="cloud-builds-heading">
      <div className="build-library-panel__heading">
        <div>
          <p className="eyebrow">Synced with your account</p>
          <h3 id="cloud-builds-heading">Cloud builds</h3>
        </div>
        <span>{builds.length} shown</span>
      </div>
      {builds.length === 0 ? <p className="empty-state">No cloud builds match these filters.</p> : (
        <ul className="build-card-list">
          {builds.map((record) => {
            const build = record.profile;
            const name = build.name ?? `Level ${build.level} build`;
            const isRenaming = renamingId === build.id;
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
                          onChange={(event) => setRenameValue(event.target.value)}
                        />
                      </label>
                      <button type="button" onClick={() => {
                        if (!renameValue.trim()) return;
                        onRename(build.id, renameValue.trim());
                        setRenamingId(null);
                      }}>Save name</button>
                      <button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <strong>{name}</strong>
                      {record.kind === 'personal-preset' ? <span>Personal preset</span> : null}
                      <span>Level {build.level} · Floor {build.maxFloor} · {build.weaponPath}</span>
                      <small>
                        {record.archivedAt ? 'Archived' : 'Cloud synced'} · {record.history.length} revision{record.history.length === 1 ? '' : 's'} · dataset {build.datasetVersion}
                      </small>
                    </>
                  )}
                </div>
                {!isRenaming ? (
                  <div className="build-card__actions">
                    <button type="button" aria-label={`Load ${name}`} onClick={() => onLoad(build)}>Load</button>
                    <button type="button" aria-label={`Rename ${name}`} onClick={() => { setRenamingId(build.id); setRenameValue(name); }}>Rename</button>
                    <button type="button" aria-label={`Duplicate ${name}`} onClick={() => onDuplicate(build)}>Duplicate</button>
                    <button type="button" aria-label={`History for ${name}`} onClick={() => onHistory(build.id)}>History</button>
                    <button type="button" aria-label={`${record.archivedAt ? 'Unarchive' : 'Archive'} ${name}`} onClick={() => onArchive(build.id, !record.archivedAt)}>{record.archivedAt ? 'Unarchive' : 'Archive'}</button>
                    <button type="button" aria-label={`Export ${name}`} onClick={() => onExport(record)}>Export</button>
                    {record.kind === 'build' ? (
                      <button type="button" aria-label={`Share ${name}`} onClick={() => onShare(build.id)}>Share</button>
                    ) : null}
                    {onCompare ? (
                      <button type="button" aria-label={`Compare ${name}`} onClick={() => onCompare(build.id)}>Compare</button>
                    ) : null}
                    {onSaveAsPreset && record.kind === 'build' ? (
                      <button type="button" aria-label={`Save ${name} as preset`} onClick={() => onSaveAsPreset(build)}>Save as preset</button>
                    ) : null}
                    <button type="button" aria-label={`Delete ${name}`} onClick={() => onDelete(build.id)}>Delete</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
