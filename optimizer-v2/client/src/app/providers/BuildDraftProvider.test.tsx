import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
  createGuestBuildStore,
  type GuestBuildStore,
} from '../../infrastructure/storage/guestBuildStore';
import { DatasetProvider } from './DatasetProvider';
import {
  useBuildDraft,
} from './BuildDraftContext';
import { BuildDraftProvider } from './BuildDraftProvider';

function profile(): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'saved-draft',
    level: 12,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 20, def: 4, agi: 4, vit: 8, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

function Consumer() {
  const {
    draft,
    isHydrated,
    updateDraft,
    saveNamedBuild,
    resetDraft,
    storageError,
    hasActiveDraft,
    persistenceStatus,
    canUndo,
    undoLastChange,
    setCloudPersistenceStatus,
    saveBuild,
    quarantinedRecords,
    exportQuarantinedRecord,
    deleteQuarantinedRecord,
    savedBuilds,
    refreshSavedBuilds,
  } = useBuildDraft();

  if (!isHydrated) return <p>Loading draft</p>;

  return (
    <div>
      <p>Level {draft.level}</p>
      <p>{storageError ?? 'Storage ready'}</p>
      <p>{hasActiveDraft ? 'Active draft' : 'No active draft'}</p>
      <p>
        {persistenceStatus === 'saved-local'
          ? 'Saved locally'
          : persistenceStatus === 'saving'
            ? 'Saving'
            : persistenceStatus}
      </p>
      <p>{canUndo ? 'Undo available' : 'Nothing to undo'}</p>
      <p>{quarantinedRecords.length} recovered records</p>
      <p>{savedBuilds.length} saved builds</p>
      <button type="button" onClick={() => updateDraft({ level: 13 })}>
        Raise level
      </button>
      <button
        type="button"
        onClick={() => updateDraft({ level: draft.level + 1 })}
      >
        Advance one level
      </button>
      <button
        type="button"
        onClick={() => updateDraft({ level: 99 }, { recordUndo: false })}
      >
        Apply synchronized level
      </button>
      <button type="button" onClick={() => void saveNamedBuild('Saved Build')}>
        Save named
      </button>
      <button type="button" onClick={() => void resetDraft()}>
        Reset draft
      </button>
      <button type="button" onClick={undoLastChange} disabled={!canUndo}>
        Undo last change
      </button>
      <button type="button" onClick={() => void refreshSavedBuilds()}>
        Refresh saved builds
      </button>
      <button
        type="button"
        onClick={() => setCloudPersistenceStatus('sync-queued')}
      >
        Mark cloud queued
      </button>
      <button type="button" onClick={() => void saveBuild({ name: 'Overwrite Name', mode: 'overwrite', destination: 'local' })}>
        Overwrite active build
      </button>
      <button type="button" onClick={() => void saveBuild({ name: 'Duplicate Name', mode: 'duplicate', destination: 'local' })}>
        Duplicate active build
      </button>
      {quarantinedRecords.map((record) => (
        <div key={record.id}>
          <button type="button" onClick={() => void exportQuarantinedRecord(record.id)}>Export {record.id}</button>
          <button type="button" onClick={() => void deleteQuarantinedRecord(record.id)}>Delete {record.id}</button>
        </div>
      ))}
    </div>
  );
}

function BuildRecordOperationsConsumer() {
  const {
    draft,
    isHydrated,
    loadSavedBuildHistory,
    restoreSavedBuildRevision,
    savePersonalPreset,
  } = useBuildDraft();
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  if (!isHydrated) return <p>Loading record operations</p>;
  return (
    <div>
      <p>Operations draft {draft.id} level {draft.level}</p>
      <p>History {historyCount ?? 'not loaded'}</p>
      <button
        type="button"
        onClick={() => void savePersonalPreset(draft, 'Personal Start')}
      >
        Save personal preset
      </button>
      <button
        type="button"
        onClick={() => {
          void loadSavedBuildHistory('history-build').then((history) =>
            setHistoryCount(history.length),
          );
        }}
      >
        Load saved history
      </button>
      <button
        type="button"
        onClick={() =>
          void restoreSavedBuildRevision('history-build', 'history-revision-1')
        }
      >
        Restore first revision
      </button>
    </div>
  );
}

function renderProvider(store: GuestBuildStore) {
  return render(
    <DatasetProvider>
      <BuildDraftProvider store={store}>
        <Consumer />
      </BuildDraftProvider>
    </DatasetProvider>,
  );
}

function renderOperationsProvider(store: GuestBuildStore) {
  return render(
    <DatasetProvider>
      <BuildDraftProvider store={store}>
        <BuildRecordOperationsConsumer />
      </BuildDraftProvider>
    </DatasetProvider>,
  );
}

describe('BuildDraftProvider', () => {
  it('creates a personal preset with a new identity and exposes its history', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-preset-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile());
    renderOperationsProvider(store);
    await screen.findByText('Operations draft saved-draft level 12');

    fireEvent.click(screen.getByRole('button', { name: 'Save personal preset' }));

    await waitFor(async () => {
      const [saved] = (await store.listBuilds()).filter((row) => row.ok);
      expect(saved).toMatchObject({
        ok: true,
        value: {
          kind: 'personal-preset',
          profile: { name: 'Personal Start' },
        },
      });
      expect(saved?.value.profile.id).not.toBe(profile().id);
      await expect(
        store.listBuildHistory(saved!.value.profile.id),
      ).resolves.toHaveLength(1);
    });
  });

  it('loads local history and restores a normal build into the active draft', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-history-${crypto.randomUUID()}`,
    });
    const first = { ...profile(), id: 'history-build', level: 12 };
    const second = {
      ...first,
      level: 13,
      stats: { ...first.stats, str: first.stats.str + 3 },
    };
    await store.saveBuild(first, { revisionId: 'history-revision-1' });
    await store.saveBuild(second, { revisionId: 'history-revision-2' });
    renderOperationsProvider(store);
    await screen.findByText(/Operations draft .+ level 1/);

    fireEvent.click(screen.getByRole('button', { name: 'Load saved history' }));
    expect(await screen.findByText('History 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restore first revision' }));

    expect(
      await screen.findByText('Operations draft history-build level 12'),
    ).toBeVisible();
    await expect(store.listBuildHistory('history-build')).resolves.toHaveLength(3);
  });

  it('hydrates a previously saved active draft', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-hydrate-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile());

    renderProvider(store);

    expect(await screen.findByText('Level 12')).toBeVisible();
    expect(screen.getByText('Storage ready')).toBeVisible();
    expect(screen.getByText('Active draft')).toBeVisible();
  });

  it('refreshes the saved-build library without replacing the active draft', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-refresh-builds-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile());
    renderProvider(store);
    await screen.findByText('Level 12');
    await store.saveBuild({ ...profile(), id: 'external-build' }, {
      revisionId: 'external-revision',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved builds' }));

    expect(await screen.findByText('1 saved builds')).toBeVisible();
    expect(screen.getByText('Level 12')).toBeVisible();
  });

  it('persists edits and creates a named build through the adapter', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-write-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');
    expect(screen.getByText('No active draft')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Raise level' }));
    expect(screen.getByText('Level 13')).toBeVisible();
    expect(screen.getByText('Active draft')).toBeVisible();

    await waitFor(
      async () => {
        expect((await store.loadDraft())?.level).toBe(13);
      },
      { timeout: 1_500 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save named' }));
    await waitFor(async () => {
      const builds = await store.listBuilds();
      expect(builds.find((result) => result.ok)?.value.profile.name).toBe(
        'Saved Build',
      );
    });
  });

  it('reports saving then saved-local around the debounced write', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-status-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');

    fireEvent.click(screen.getByRole('button', { name: 'Raise level' }));

    expect(screen.getByText('Saving')).toBeVisible();
    expect(await screen.findByText('Saved locally')).toBeVisible();
  });

  it('undoes the last structurally different draft change', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-undo-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');

    fireEvent.click(screen.getByRole('button', { name: 'Raise level' }));
    expect(screen.getByText('Level 13')).toBeVisible();
    expect(screen.getByText('Undo available')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));

    expect(screen.getByText('Level 1')).toBeVisible();
    expect(screen.getByText('Nothing to undo')).toBeVisible();
    await waitFor(async () => {
      expect((await store.loadDraft())?.level).toBe(1);
    });
  });

  it('keeps only ten prior draft states', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-bounded-undo-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');

    for (let count = 0; count < 11; count += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Advance one level' }));
    }
    expect(screen.getByText('Level 12')).toBeVisible();
    for (let count = 0; count < 10; count += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));
    }

    expect(screen.getByText('Level 2')).toBeVisible();
    expect(screen.getByText('Nothing to undo')).toBeVisible();
  });

  it('does not add an undo entry for synchronized updates', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-no-undo-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Apply synchronized level' }),
    );

    expect(screen.getByText('Level 99')).toBeVisible();
    expect(screen.getByText('Nothing to undo')).toBeVisible();
  });

  it('overlays cloud queue status and clears it for a new local edit', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-cloud-status-${crypto.randomUUID()}`,
    });
    renderProvider(store);
    await screen.findByText('Level 1');

    fireEvent.click(screen.getByRole('button', { name: 'Mark cloud queued' }));
    expect(screen.getByText('sync-queued')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Raise level' }));

    expect(screen.getByText('Saving')).toBeVisible();
  });

  it('overwrites with the active ID and duplicates with a fresh ID', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-save-modes-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile());
    renderProvider(store);
    await screen.findByText('Level 12');

    fireEvent.click(screen.getByRole('button', { name: 'Overwrite active build' }));
    await waitFor(async () => {
      expect(
        (await store.listBuilds()).find(
          (result) => result.ok && result.value.profile.id === profile().id,
        ),
      ).toMatchObject({ ok: true, value: { profile: { name: 'Overwrite Name' } } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate active build' }));
    await waitFor(async () => {
      const builds = (await store.listBuilds()).filter((result) => result.ok);
      expect(builds).toHaveLength(2);
      expect(builds.some((result) => result.value.profile.name === 'Duplicate Name')).toBe(true);
      expect(new Set(builds.map((result) => result.value.profile.id)).size).toBe(2);
    });
  });

  it('does not recreate a cleared draft during unmount', async () => {
    const store = createGuestBuildStore({
      databaseName: `provider-reset-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile());
    const view = renderProvider(store);
    await screen.findByText('Active draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reset draft' }));
    await screen.findByText('No active draft');
    view.unmount();

    await expect(store.loadDraft()).resolves.toBeNull();
  });

  it('surfaces quarantined records for recovery and removal', async () => {
    const base = createGuestBuildStore({
      databaseName: `provider-recovery-${crypto.randomUUID()}`,
    });
    const exportRecord = vi.fn(async () => '{"broken":true}');
    const deleteRecord = vi.fn(async () => undefined);
    const store: GuestBuildStore = {
      ...base,
      listQuarantinedRecords: async () => [{
        id: 'broken-record',
        kind: 'plan-progress',
        rawJson: '{"broken":true}',
        quarantinedAt: '2026-08-30T12:00:00.000Z',
      }],
      exportQuarantinedRecord: exportRecord,
      deleteQuarantinedRecord: deleteRecord,
    };
    renderProvider(store);

    expect(await screen.findByText('1 recovered records')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Export broken-record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete broken-record' }));
    await waitFor(() => {
      expect(exportRecord).toHaveBeenCalledWith('broken-record');
      expect(deleteRecord).toHaveBeenCalledWith('broken-record');
    });
  });

  it('surfaces a quota rejection while retaining the in-memory draft', async () => {
    const quotaError = new DOMException('Storage quota exhausted', 'QuotaExceededError');
    const store: GuestBuildStore = {
      loadDraft: async () => null,
      saveDraft: async () => Promise.reject(quotaError),
      clearDraft: async () => undefined,
      listBuilds: async () => [],
      saveBuild: async () => undefined,
      listBuildHistory: async () => [],
      restoreBuildRevision: async () => profile(),
      exportBuildRecords: async () => [],
      importBuildPlan: async () => undefined,
      deleteBuild: async () => undefined,
      applyDatasetUpdate: async (request) => request.profile,
      renameBuild: async () => undefined,
      duplicateBuild: async () => profile(),
      setBuildArchived: async () => undefined,
      loadPreferences: async () => ({
        schemaVersion: 1,
        mode: 'beginner',
        density: 'comfortable',
        showAllLevels: false,
        compactWeaponPathsAfterFirstUse: false,
      }),
      savePreferences: async () => undefined,
      loadPlanProgress: async () => null,
      savePlanProgress: async () => undefined,
      deletePlanProgress: async () => undefined,
      listQuarantinedRecords: async () => [],
      exportQuarantinedRecord: async () => null,
      deleteQuarantinedRecord: async () => undefined,
    };
    renderProvider(store);
    await screen.findByText('Level 1');

    fireEvent.click(screen.getByRole('button', { name: 'Raise level' }));

    expect(screen.getByText('Level 13')).toBeVisible();
    expect(screen.getByText('Active draft')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText('Draft storage failed')).toBeVisible();
    });
  });
});
