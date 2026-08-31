import { createContext, useContext } from 'react';
import type { InventoryState } from '../../domain/inventory/state';
import type { DraftPersistenceStatus } from '../../domain/planner/state';

export type ComparisonToggleResult =
  | { ok: true }
  | { ok: false; reason: 'comparison-full' };

export type InventoryContextValue = {
  inventory: InventoryState;
  isHydrated: boolean;
  persistenceStatus: DraftPersistenceStatus;
  storageError: string | null;
  setOwned(itemId: string, owned: boolean): void;
  toggleFavorite(itemId: string): void;
  toggleComparison(itemId: string): ComparisonToggleResult;
  setNote(itemId: string, note: string): void;
  replaceInventory(inventory: InventoryState): void;
  resetInventory(): Promise<void>;
  setCloudPersistenceStatus(
    status: 'sync-queued' | 'synced' | 'error' | null,
  ): void;
};

export const InventoryContext = createContext<InventoryContextValue | null>(
  null,
);

export function useInventory(): InventoryContextValue {
  const value = useContext(InventoryContext);
  if (!value) {
    throw new Error('useInventory must be used inside InventoryProvider');
  }
  return value;
}

export function useOptionalInventory(): InventoryContextValue | null {
  return useContext(InventoryContext);
}
