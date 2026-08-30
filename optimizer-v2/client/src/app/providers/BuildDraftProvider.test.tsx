import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('BuildDraftProvider', () => {
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

  it('surfaces a quota rejection while retaining the in-memory draft', async () => {
    const quotaError = new DOMException('Storage quota exhausted', 'QuotaExceededError');
    const store: GuestBuildStore = {
      loadDraft: async () => null,
      saveDraft: async () => Promise.reject(quotaError),
      clearDraft: async () => undefined,
      listBuilds: async () => [],
      saveBuild: async () => undefined,
      deleteBuild: async () => undefined,
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
