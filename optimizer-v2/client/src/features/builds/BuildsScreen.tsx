import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import type { CharacterProfile } from '../../domain/build/model';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';
import { CloudBuildList } from './CloudBuildList';
import { GuestImportDialog } from './GuestImportDialog';
import { LocalBuildList } from './LocalBuildList';
import { BuildWorkspaceNav } from './BuildWorkspaceNav';
import {
  createBuildBackup,
  portableRecordFromCloud,
  serializeBuildBackup,
  type PortableBuildRecord,
} from '../../domain/build/portable';
import { mergeBuildLibrary } from '../../domain/build/library';
import { BuildBackupDialog } from './BuildBackupDialog';
import { BuildImportDialog } from './BuildImportDialog';

type BuildStatus = 'active' | 'archived' | 'all';
type BuildSort = 'updated' | 'name' | 'level' | 'floor';

function buildName(profile: CharacterProfile) {
  return profile.name ?? `Level ${profile.level} build`;
}

function downloadBuildBackup(
  records: readonly PortableBuildRecord[],
  scope: 'single' | 'library',
  filename: string,
) {
  const json = serializeBuildBackup(
    createBuildBackup({
      scope,
      exportedAt: new Date().toISOString(),
      records,
    }),
  );
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filterAndSortLocalBuilds(
  builds: readonly GuestBuildListResult[],
  search: string,
  status: BuildStatus,
  sort: BuildSort,
) {
  const needle = search.trim().toLocaleLowerCase();
  return builds
    .filter((result) => {
      if (!result.ok) return status === 'all' && needle.length === 0;
      const archived = Boolean(result.value.archivedAt);
      if (status === 'active' && archived) return false;
      if (status === 'archived' && !archived) return false;
      if (!needle) return true;
      const profile = result.value.profile;
      return [buildName(profile), profile.weaponPath, profile.goal, `floor ${profile.maxFloor}`]
        .some((value) => value.toLocaleLowerCase().includes(needle));
    })
    .sort((left, right) => {
      if (!left.ok || !right.ok) return Number(right.ok) - Number(left.ok);
      const a = left.value;
      const b = right.value;
      if (sort === 'name') return buildName(a.profile).localeCompare(buildName(b.profile));
      if (sort === 'level') return b.profile.level - a.profile.level;
      if (sort === 'floor') return b.profile.maxFloor - a.profile.maxFloor;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function BuildsScreen() {
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const {
    deleteSavedBuild,
    deleteQuarantinedRecord,
    duplicateSavedBuild,
    exportQuarantinedRecord,
    isHydrated,
    loadSavedBuild,
    renameSavedBuild,
    savePersonalPreset,
    quarantinedRecords,
    savedBuilds,
    setBuildArchived,
    exportSavedBuildRecords,
    importSavedBuildPlan,
  } = useBuildDraft();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BuildStatus>('active');
  const [sort, setSort] = useState<BuildSort>('updated');
  const [source, setSource] = useState<'all' | 'local' | 'cloud'>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    source: 'local' | 'cloud';
  } | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const backupTriggerRef = useRef<HTMLButtonElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [backupRecords, setBackupRecords] = useState<PortableBuildRecord[]>([]);
  const localProfiles = savedBuilds.flatMap((result) => result.ok ? [result.value.profile] : []);
  const visibleLocalBuilds = useMemo(
    () => filterAndSortLocalBuilds(savedBuilds, search, status, sort),
    [savedBuilds, search, sort, status],
  );
  const visibleCloudBuilds = useMemo(() => {
    const records = status === 'archived'
      ? cloud?.archivedCloudBuilds ?? []
      : status === 'all'
        ? [...(cloud?.cloudBuilds ?? []), ...(cloud?.archivedCloudBuilds ?? [])]
        : cloud?.cloudBuilds ?? [];
    const needle = search.trim().toLocaleLowerCase();
    return records
      .filter((record) => !needle || [buildName(record.profile), record.profile.weaponPath, record.profile.goal]
        .some((value) => value.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => {
        if (sort === 'name') return buildName(a.profile).localeCompare(buildName(b.profile));
        if (sort === 'level') return b.profile.level - a.profile.level;
        if (sort === 'floor') return b.profile.maxFloor - a.profile.maxFloor;
        return (b.history.at(-1)?.createdAt ?? '').localeCompare(a.history.at(-1)?.createdAt ?? '');
      });
  }, [cloud?.archivedCloudBuilds, cloud?.cloudBuilds, search, sort, status]);
  const allCloudBuilds = useMemo(
    () => [...(cloud?.cloudBuilds ?? []), ...(cloud?.archivedCloudBuilds ?? [])],
    [cloud?.archivedCloudBuilds, cloud?.cloudBuilds],
  );
  const libraryEntries = useMemo(
    () => mergeBuildLibrary(savedBuilds, allCloudBuilds),
    [allCloudBuilds, savedBuilds],
  );
  const existingBuilds = useMemo(
    () =>
      new Map(
        libraryEntries.map((entry) => [
          entry.id,
          { headRevisionId: entry.headRevisionId },
        ]),
      ),
    [libraryEntries],
  );

  const loadPortableLibrary = async () => {
    const local = await exportSavedBuildRecords();
    const records = new Map<string, PortableBuildRecord>();
    for (const record of allCloudBuilds) {
      records.set(
        record.profile.id,
        portableRecordFromCloud(
          record,
          cloud?.cloudPlanProgress.find(
            (progress) => progress.buildId === record.profile.id,
          ),
        ),
      );
    }
    for (const record of local) records.set(record.profile.id, record);
    return [...records.values()];
  };

  useEffect(() => {
    if (deleteTarget) cancelDeleteRef.current?.focus();
  }, [deleteTarget]);

  if (!isHydrated) return <main className="builds-screen"><p>Loading builds</p></main>;

  return (
    <main className="builds-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Build library</p>
        <h2>Your Builds</h2>
        <p>Search, compare, organize, and reopen every route from one place.</p>
      </header>
      <BuildWorkspaceNav />

      <section className="build-library-tools" aria-label="Build portable tools">
        <button
          ref={importTriggerRef}
          type="button"
          onClick={() => setImportOpen(true)}
        >
          Import builds
        </button>
        <button
          ref={backupTriggerRef}
          type="button"
          onClick={() => {
            void loadPortableLibrary()
              .then((records) => {
                setBackupRecords(records);
                setBackupOpen(true);
              })
              .catch((error: unknown) =>
                setMessage(
                  error instanceof Error ? error.message : 'Build export failed',
                ),
              );
          }}
        >
          Back up library
        </button>
      </section>

      <section className="build-library-toolbar" aria-label="Build library controls">
        <label className="build-library-search">
          <span>Search builds</span>
          <input type="search" aria-label="Search builds" placeholder="Name, path, goal, or floor" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span>Build status</span>
          <select aria-label="Build status" value={status} onChange={(event) => setStatus(event.target.value as BuildStatus)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Build source</span>
          <select aria-label="Build source" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
            <option value="all">All sources</option>
            <option value="local">This device</option>
            <option value="cloud">Cloud</option>
          </select>
        </label>
        <label>
          <span>Sort builds</span>
          <select aria-label="Sort builds" value={sort} onChange={(event) => setSort(event.target.value as BuildSort)}>
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
            <option value="level">Highest level</option>
            <option value="floor">Highest floor</option>
          </select>
        </label>
      </section>

      {message ? <p className="build-library-message" role="status">{message}</p> : null}

      {source !== 'cloud' ? (
        <section className="saved-builds build-library-panel" aria-labelledby="local-builds-heading">
          <div className="build-library-panel__heading">
            <div><p className="eyebrow">Available offline</p><h3 id="local-builds-heading">Saved on this device</h3></div>
            <span>{visibleLocalBuilds.length} shown</span>
          </div>
          <LocalBuildList
            builds={visibleLocalBuilds}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onStartRename={(profile) => { setRenamingId(profile.id); setRenameValue(buildName(profile)); }}
            onCancelRename={() => setRenamingId(null)}
            onSaveRename={() => {
              if (!renamingId || !renameValue.trim()) return;
              void renameSavedBuild(renamingId, renameValue).then(() => { setRenamingId(null); setMessage('Build renamed.'); });
            }}
            onLoad={(build) => { loadSavedBuild(build); navigate('/character'); }}
            onDuplicate={(id) => { void duplicateSavedBuild(id).then(() => setMessage('Build duplicated.')); }}
            onArchive={(id, archived) => { void setBuildArchived(id, archived).then(() => setMessage(archived ? 'Build archived.' : 'Build restored.')); }}
            onExport={(profile) => {
              void exportSavedBuildRecords([profile.id]).then((records) =>
                downloadBuildBackup(
                  records,
                  'single',
                  `${buildName(profile).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v1.json`,
                ),
              );
            }}
            onCompare={(id) => navigate(`/builds/compare?left=${encodeURIComponent(id)}`)}
            onSaveAsPreset={(profile) => {
              const name = `${buildName(profile)} preset`.slice(0, 60);
              void savePersonalPreset(profile, name).then(() =>
                setMessage('Personal preset saved.'),
              );
            }}
            onDelete={(id, name) => setDeleteTarget({ id, name, source: 'local' })}
          />
        </section>
      ) : null}

      {cloud?.needsGuestImport && localProfiles.length > 0 ? (
        <GuestImportDialog builds={localProfiles} onImport={async (ids) => {
          await cloud.repository.importGuestBuilds(ids);
          await cloud.refreshPending();
        }} />
      ) : null}

      {source !== 'local' && cloud?.isAuthenticated ? (
        <CloudBuildList
          builds={visibleCloudBuilds}
          onLoad={(profile) => { loadSavedBuild(profile); navigate('/results'); }}
          onHistory={(buildId) => navigate(`/builds/${buildId}/history`)}
          onRename={(buildId, name) => {
            void cloud.repository.rename(buildId, name).then(() => setMessage('Cloud build renamed.'));
          }}
          onDuplicate={(profile) => {
            const duplicate = {
              ...structuredClone(profile),
              id: crypto.randomUUID(),
              name: `${buildName(profile)} copy`,
            };
            void cloud.repository.save(duplicate).then(async (result) => {
              await cloud.refreshPending();
              setMessage(result.location === 'cloud' ? 'Cloud build duplicated.' : 'Duplicate queued for cloud sync.');
            });
          }}
          onArchive={(buildId, archived) => {
            void cloud.repository.archive(buildId, archived).then(() => setMessage(archived ? 'Cloud build archived.' : 'Cloud build restored.'));
          }}
          onExport={(record) =>
            downloadBuildBackup(
              [
                portableRecordFromCloud(
                  record,
                  cloud.cloudPlanProgress.find(
                    (progress) => progress.buildId === record.profile.id,
                  ),
                ),
              ],
              'single',
              `${buildName(record.profile).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v1.json`,
            )
          }
          onCompare={(id) => navigate(`/builds/compare?left=${encodeURIComponent(id)}`)}
          onSaveAsPreset={(profile) => {
            const name = `${buildName(profile)} preset`.slice(0, 60);
            void savePersonalPreset(profile, name)
              .then((preset) => cloud.repository.save(preset, { kind: 'personal-preset' }))
              .then(async (result) => {
                await cloud.refreshPending();
                setMessage(
                  result.location === 'cloud'
                    ? 'Cloud personal preset saved.'
                    : 'Personal preset queued for cloud sync.',
                );
              });
          }}
          onShare={(buildId) => {
            void cloud.createShare(buildId).then((shareId) => {
              const shareUrl = new URL(`${import.meta.env.BASE_URL}shared/${shareId}`, window.location.href).href;
              void navigator.clipboard?.writeText(shareUrl);
              setMessage(`Read-only share created: ${shareUrl}`);
            });
          }}
          onDelete={(buildId) => {
            const record = visibleCloudBuilds.find((item) => item.profile.id === buildId);
            setDeleteTarget({ id: buildId, name: record ? buildName(record.profile) : 'cloud build', source: 'cloud' });
          }}
        />
      ) : null}

      {cloud && cloud.pendingCount + cloud.pendingPlannerStateCount > 0 ? (
        <p role="status">{cloud.pendingCount + cloud.pendingPlannerStateCount} cloud change{cloud.pendingCount + cloud.pendingPlannerStateCount === 1 ? '' : 's'} waiting to sync.</p>
      ) : null}

      {quarantinedRecords.length > 0 ? (
        <section className="build-library-panel recovered-data" aria-labelledby="recovered-data-heading">
          <div className="build-library-panel__heading">
            <div>
              <p className="eyebrow">Local recovery</p>
              <h3 id="recovered-data-heading">Recovered Data</h3>
            </div>
            <span>{quarantinedRecords.length} record{quarantinedRecords.length === 1 ? '' : 's'}</span>
          </div>
          <p>These records could not be safely read. Export them for inspection or remove them from this device.</p>
          <ul className="recovered-data-list">
            {quarantinedRecords.map((record) => (
              <li key={record.id}>
                <div>
                  <strong>{record.kind}</strong>
                  <span>{new Date(record.quarantinedAt).toLocaleString()}</span>
                </div>
                <button type="button" aria-label={`Export recovered ${record.kind} record`} onClick={() => {
                  void exportQuarantinedRecord(record.id).then((rawJson) => {
                    if (rawJson === null) return;
                    const blob = new Blob([rawJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${record.kind}-recovered.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  });
                }}>Export</button>
                <button type="button" aria-label={`Delete recovered ${record.kind} record`} onClick={() => {
                  void deleteQuarantinedRecord(record.id).then(() => setMessage('Recovered record removed.'));
                }}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {deleteTarget ? (
        <div className="confirmation-dialog-backdrop" role="presentation">
          <div className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-build-heading" aria-describedby="delete-build-description">
            <h3 id="delete-build-heading">Delete {deleteTarget.name}?</h3>
            <p id="delete-build-description">
              {deleteTarget.source === 'cloud'
                ? 'This permanently removes the cloud build and its revision history. Existing public snapshots remain separate.'
                : 'This permanently removes the saved copy from this device. This cannot be undone.'}
            </p>
            <div className="dialog-actions">
              <button ref={cancelDeleteRef} type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => {
                const target = deleteTarget;
                const operation = target.source === 'cloud' ? cloud?.repository.delete(target.id) : deleteSavedBuild(target.id);
                void operation?.then(() => { setDeleteTarget(null); setMessage('Build deleted.'); });
              }}>Delete permanently</button>
            </div>
          </div>
        </div>
      ) : null}
      {backupOpen ? (
        <BuildBackupDialog
          records={backupRecords}
          cloudAvailable={Boolean(cloud?.isAuthenticated && cloud.isReady)}
          onClose={() => {
            setBackupOpen(false);
            backupTriggerRef.current?.focus();
          }}
        />
      ) : null}
      {importOpen ? (
        <BuildImportDialog
          existing={existingBuilds}
          onClose={() => {
            setImportOpen(false);
            importTriggerRef.current?.focus();
          }}
          onImport={async (plan) => {
            await importSavedBuildPlan(plan);
            if (!cloud?.isAuthenticated) {
              setMessage('Builds imported locally.');
              return 'local';
            }
            const location = await cloud.repository.importBuildRecords(
              plan.records,
            );
            await cloud.refreshPending();
            setMessage(
              location === 'cloud'
                ? 'Builds imported and synced.'
                : 'Builds imported locally and queued for cloud sync.',
            );
            return location;
          }}
        />
      ) : null}
    </main>
  );
}
