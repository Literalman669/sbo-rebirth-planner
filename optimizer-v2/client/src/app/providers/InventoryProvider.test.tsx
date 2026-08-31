import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { InventoryState } from '../../domain/inventory/state';
import {
  createGuestBuildStore,
  type GuestBuildStore,
} from '../../infrastructure/storage/guestBuildStore';
import {
  createInventoryStore,
  type InventoryStore,
} from '../../infrastructure/storage/inventoryStore';
import { BuildDraftProvider } from './BuildDraftProvider';
import { useBuildDraft } from './BuildDraftContext';
import { DatasetProvider } from './DatasetProvider';
import { useInventory } from './InventoryContext';
import { InventoryProvider } from './InventoryProvider';

function profile(
  patch: Partial<CharacterProfile> = {},
): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'inventory-build',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'beginner-armor',
    },
    ownedItemIds: ['iron-greatsword'],
    datasetVersion: '2026.08.30.1',
    ...patch,
  };
}

function inventory(
  patch: Partial<InventoryState> = {},
): InventoryState {
  return {
    schemaVersion: 1,
    ownedItemIds: [],
    favoriteItemIds: [],
    comparisonItemIds: [],
    notes: {},
    ...patch,
  };
}

function Consumer() {
  const { draft, loadSavedBuild } = useBuildDraft();
  const {
    inventory: current,
    isHydrated,
    persistenceStatus,
    storageError,
    setOwned,
    toggleFavorite,
    toggleComparison,
    setNote,
    resetInventory,
    setCloudPersistenceStatus,
  } = useInventory();

  if (!isHydrated) return <p>Loading inventory</p>;

  return (
    <div>
      <p>Owned {current.ownedItemIds.join(',') || 'none'}</p>
      <p>Favorites {current.favoriteItemIds.join(',') || 'none'}</p>
      <p>Comparison {current.comparisonItemIds.join(',') || 'none'}</p>
      <p>Note {current.notes['iron-greatsword'] ?? 'none'}</p>
      <p>Draft owned {draft.ownedItemIds.join(',') || 'none'}</p>
      <p>Status {persistenceStatus}</p>
      <p>{storageError ?? 'Inventory storage ready'}</p>
      <button type="button" onClick={() => setOwned('beginner-armor', true)}>
        Own armor
      </button>
      <button
        type="button"
        onClick={() => toggleFavorite('iron-greatsword')}
      >
        Favorite sword
      </button>
      {['a', 'b', 'c', 'd', 'e'].map((itemId) => (
        <button
          key={itemId}
          type="button"
          onClick={() => toggleComparison(itemId)}
        >
          Compare {itemId}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setNote('iron-greatsword', '  Keep for testing  ')}
      >
        Add note
      </button>
      <button
        type="button"
        onClick={() =>
          loadSavedBuild(
            profile({ id: 'other-build', ownedItemIds: ['unrelated-item'] }),
          )
        }
      >
        Load another build
      </button>
      <button type="button" onClick={() => void resetInventory()}>
        Reset inventory
      </button>
      <button
        type="button"
        onClick={() => setCloudPersistenceStatus('sync-queued')}
      >
        Queue cloud
      </button>
    </div>
  );
}

function renderProvider(
  buildStore: GuestBuildStore,
  inventoryStore: InventoryStore,
) {
  return render(
    <DatasetProvider>
      <BuildDraftProvider store={buildStore}>
        <InventoryProvider store={inventoryStore}>
          <Consumer />
        </InventoryProvider>
      </BuildDraftProvider>
    </DatasetProvider>,
  );
}

async function stores(label: string) {
  const buildStore = createGuestBuildStore({
    databaseName: `inventory-provider-build-${label}-${crypto.randomUUID()}`,
  });
  const inventoryStore = createInventoryStore({
    databaseName: `inventory-provider-state-${label}-${crypto.randomUUID()}`,
  });
  return { buildStore, inventoryStore };
}

describe('InventoryProvider', () => {
  it('migrates active-draft ownership into canonical inventory once', async () => {
    const { buildStore, inventoryStore } = await stores('hydrate');
    await buildStore.saveDraft(profile());
    await inventoryStore.save(
      inventory({ ownedItemIds: ['beginner-armor'] }),
    );

    renderProvider(buildStore, inventoryStore);

    expect(
      await screen.findByText('Owned beginner-armor,iron-greatsword'),
    ).toBeVisible();
    expect(
      await screen.findByText('Draft owned beginner-armor,iron-greatsword'),
    ).toBeVisible();
    await waitFor(async () => {
      expect((await inventoryStore.load()).ownedItemIds).toEqual([
        'beginner-armor',
        'iron-greatsword',
      ]);
    });
  });

  it('updates draft ownership but keeps favorites, comparison, and notes UI-only', async () => {
    const { buildStore, inventoryStore } = await stores('mutations');
    await buildStore.saveDraft(profile({ ownedItemIds: [] }));
    renderProvider(buildStore, inventoryStore);
    await screen.findByText('Owned none');

    fireEvent.click(screen.getByRole('button', { name: 'Own armor' }));
    expect(await screen.findByText('Owned beginner-armor')).toBeVisible();
    expect(await screen.findByText('Draft owned beginner-armor')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Favorite sword' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Favorites iron-greatsword')).toBeVisible();
    expect(screen.getByText('Comparison a')).toBeVisible();
    expect(screen.getByText('Note Keep for testing')).toBeVisible();
    expect(screen.getByText('Draft owned beginner-armor')).toBeVisible();
  });

  it('refuses a fifth comparison item without mutating state', async () => {
    const { buildStore, inventoryStore } = await stores('comparison');
    renderProvider(buildStore, inventoryStore);
    await screen.findByText('Comparison none');

    for (const itemId of ['a', 'b', 'c', 'd']) {
      fireEvent.click(screen.getByRole('button', { name: `Compare ${itemId}` }));
    }
    expect(screen.getByText('Comparison a,b,c,d')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Compare e' }));
    expect(screen.getByText('Comparison a,b,c,d')).toBeVisible();
  });

  it('keeps canonical ownership when another saved build is loaded', async () => {
    const { buildStore, inventoryStore } = await stores('load');
    await inventoryStore.save(
      inventory({ ownedItemIds: ['beginner-armor', 'iron-greatsword'] }),
    );
    renderProvider(buildStore, inventoryStore);
    await screen.findByText('Owned beginner-armor,iron-greatsword');

    fireEvent.click(screen.getByRole('button', { name: 'Load another build' }));

    expect(
      await screen.findByText('Draft owned beginner-armor,iron-greatsword'),
    ).toBeVisible();
    expect(screen.getByText('Owned beginner-armor,iron-greatsword')).toBeVisible();
  });

  it('resets inventory and overlays cloud persistence status', async () => {
    const { buildStore, inventoryStore } = await stores('reset');
    await inventoryStore.save(
      inventory({ ownedItemIds: ['iron-greatsword'] }),
    );
    renderProvider(buildStore, inventoryStore);
    await screen.findByText('Owned iron-greatsword');

    fireEvent.click(screen.getByRole('button', { name: 'Queue cloud' }));
    expect(screen.getByText('Status sync-queued')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset inventory' }));

    expect(await screen.findByText('Owned none')).toBeVisible();
    expect(await screen.findByText('Draft owned none')).toBeVisible();
    await expect(inventoryStore.load()).resolves.toEqual(inventory());
  });

  it('retains in-memory state and surfaces storage rejection', async () => {
    const { buildStore, inventoryStore: base } = await stores('error');
    const inventoryStore: InventoryStore = {
      ...base,
      save: async () => {
        throw new DOMException('Storage quota exhausted', 'QuotaExceededError');
      },
    };
    renderProvider(buildStore, inventoryStore);
    await screen.findByText('Owned none');

    fireEvent.click(screen.getByRole('button', { name: 'Own armor' }));

    expect(screen.getByText('Owned beginner-armor')).toBeVisible();
    expect(await screen.findByText('Inventory storage failed')).toBeVisible();
  });
});
