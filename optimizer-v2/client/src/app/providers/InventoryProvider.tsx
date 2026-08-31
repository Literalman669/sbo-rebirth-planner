import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  createEmptyInventory,
  mergeInventoryStates,
  normalizeInventoryState,
  type InventoryState,
} from '../../domain/inventory/state';
import { inventoryStateSchema } from '../../domain/inventory/stateSchema';
import type { DraftPersistenceStatus } from '../../domain/planner/state';
import {
  createInventoryStore,
  type InventoryStore,
} from '../../infrastructure/storage/inventoryStore';
import { useBuildDraft } from './BuildDraftContext';
import {
  InventoryContext,
  type ComparisonToggleResult,
  type InventoryContextValue,
} from './InventoryContext';

const defaultStore = createInventoryStore();

type InventoryProviderProps = PropsWithChildren<{
  store?: InventoryStore;
}>;

function equalIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((itemId, index) => itemId === right[index])
  );
}

export function InventoryProvider({
  children,
  store = defaultStore,
}: InventoryProviderProps) {
  const {
    draft,
    hasActiveDraft,
    isHydrated: draftHydrated,
    updateDraft,
  } = useBuildDraft();
  const [inventory, setInventory] = useState<InventoryState>(() =>
    createEmptyInventory(),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] =
    useState<DraftPersistenceStatus>('idle');
  const [cloudPersistenceStatus, setCloudPersistenceStatus] = useState<
    'sync-queued' | 'synced' | 'error' | null
  >(null);
  const inventoryRef = useRef(inventory);

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    if (!draftHydrated) return;
    let active = true;
    void store
      .load()
      .then((stored) => {
        if (!active) return;
        const migrated = hasActiveDraft
          ? mergeInventoryStates(
              stored,
              normalizeInventoryState({
                ...createEmptyInventory(),
                ownedItemIds: draft.ownedItemIds,
              }),
            )
          : stored;
        inventoryRef.current = migrated;
        setInventory(migrated);
        setStorageError(null);
        setPersistenceStatus('saved-local');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStorageError(
          error instanceof Error ? error.message : 'Inventory storage failed',
        );
        setPersistenceStatus('error');
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [draftHydrated, store]);

  useEffect(() => {
    if (!isHydrated) return;
    setPersistenceStatus('saving');
    const timeout = window.setTimeout(() => {
      void store
        .save(inventory)
        .then(() => {
          setStorageError(null);
          setPersistenceStatus('saved-local');
        })
        .catch(() => {
          setStorageError('Inventory storage failed');
          setPersistenceStatus('error');
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [inventory, isHydrated, store]);

  useEffect(() => {
    if (!isHydrated || !draftHydrated || !hasActiveDraft) return;
    if (equalIds(draft.ownedItemIds, inventory.ownedItemIds)) return;
    updateDraft(
      { ownedItemIds: [...inventory.ownedItemIds] },
      { recordUndo: false },
    );
  }, [
    draft.id,
    draft.ownedItemIds,
    draftHydrated,
    hasActiveDraft,
    inventory.ownedItemIds,
    isHydrated,
    updateDraft,
  ]);

  const commit = useCallback((next: InventoryState) => {
    const valid = inventoryStateSchema.parse(normalizeInventoryState(next));
    if (JSON.stringify(valid) === JSON.stringify(inventoryRef.current)) return;
    inventoryRef.current = valid;
    setInventory(valid);
    setStorageError(null);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('saving');
  }, []);

  const setOwned = useCallback(
    (itemId: string, owned: boolean) => {
      const current = inventoryRef.current;
      const ownedSet = new Set(current.ownedItemIds);
      if (owned) ownedSet.add(itemId);
      else ownedSet.delete(itemId);
      commit({ ...current, ownedItemIds: [...ownedSet] });
    },
    [commit],
  );

  const toggleFavorite = useCallback(
    (itemId: string) => {
      const current = inventoryRef.current;
      const favorites = new Set(current.favoriteItemIds);
      if (favorites.has(itemId)) favorites.delete(itemId);
      else favorites.add(itemId);
      commit({ ...current, favoriteItemIds: [...favorites] });
    },
    [commit],
  );

  const toggleComparison = useCallback(
    (itemId: string): ComparisonToggleResult => {
      const current = inventoryRef.current;
      if (current.comparisonItemIds.includes(itemId)) {
        commit({
          ...current,
          comparisonItemIds: current.comparisonItemIds.filter(
            (candidate) => candidate !== itemId,
          ),
        });
        return { ok: true };
      }
      if (current.comparisonItemIds.length >= 4) {
        return { ok: false, reason: 'comparison-full' };
      }
      commit({
        ...current,
        comparisonItemIds: [...current.comparisonItemIds, itemId],
      });
      return { ok: true };
    },
    [commit],
  );

  const setNote = useCallback(
    (itemId: string, note: string) => {
      const current = inventoryRef.current;
      const notes = { ...current.notes };
      if (note.trim()) notes[itemId] = note;
      else delete notes[itemId];
      commit({ ...current, notes });
    },
    [commit],
  );

  const replaceInventory = useCallback(
    (next: InventoryState) => commit(next),
    [commit],
  );

  const resetInventory = useCallback(async () => {
    const empty = createEmptyInventory();
    inventoryRef.current = empty;
    setInventory(empty);
    setStorageError(null);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('idle');
    try {
      await store.reset();
    } catch {
      setStorageError('Inventory storage failed');
      setPersistenceStatus('error');
    }
  }, [store]);

  const exportBackup = useCallback(
    async (datasetVersion: string) => {
      await store.save(inventoryRef.current);
      return store.exportBackup(datasetVersion);
    },
    [store],
  );

  const importBackup = useCallback(
    async (rawJson: string, mode: 'merge' | 'replace') => {
      const imported = await store.importBackup(rawJson, mode);
      inventoryRef.current = imported;
      setInventory(imported);
      setStorageError(null);
      setCloudPersistenceStatus(null);
      setPersistenceStatus('saved-local');
      return imported;
    },
    [store],
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      inventory,
      isHydrated,
      persistenceStatus: cloudPersistenceStatus ?? persistenceStatus,
      storageError,
      setOwned,
      toggleFavorite,
      toggleComparison,
      setNote,
      replaceInventory,
      resetInventory,
      exportBackup,
      importBackup,
      setCloudPersistenceStatus,
    }),
    [
      cloudPersistenceStatus,
      inventory,
      isHydrated,
      persistenceStatus,
      exportBackup,
      importBackup,
      replaceInventory,
      resetInventory,
      setNote,
      setOwned,
      storageError,
      toggleComparison,
      toggleFavorite,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}
