export type InventoryState = {
  schemaVersion: 1;
  ownedItemIds: string[];
  favoriteItemIds: string[];
  comparisonItemIds: string[];
  notes: Record<string, string>;
};

export type InventoryBackup = {
  schemaVersion: 1;
  exportedAt: string;
  datasetVersion: string;
  inventory: InventoryState;
};

export const EMPTY_INVENTORY: InventoryState = {
  schemaVersion: 1,
  ownedItemIds: [],
  favoriteItemIds: [],
  comparisonItemIds: [],
  notes: {},
};

function normalizedIds(ids: readonly string[], sort: boolean) {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  return sort ? unique.toSorted((left, right) => left.localeCompare(right)) : unique;
}

export function normalizeInventoryState(input: InventoryState): InventoryState {
  const notes: Record<string, string> = {};
  for (const [rawId, rawNote] of Object.entries(input.notes)) {
    const id = rawId.trim();
    const note = rawNote.trim();
    if (id && note) notes[id] = note;
  }

  return {
    schemaVersion: 1,
    ownedItemIds: normalizedIds(input.ownedItemIds, true),
    favoriteItemIds: normalizedIds(input.favoriteItemIds, true),
    comparisonItemIds: normalizedIds(input.comparisonItemIds, false),
    notes: Object.fromEntries(
      Object.entries(notes).toSorted(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}

export function mergeInventoryStates(
  local: InventoryState,
  cloud: InventoryState,
): InventoryState {
  return normalizeInventoryState({
    schemaVersion: 1,
    ownedItemIds: [...cloud.ownedItemIds, ...local.ownedItemIds],
    favoriteItemIds: [...cloud.favoriteItemIds, ...local.favoriteItemIds],
    comparisonItemIds: [
      ...local.comparisonItemIds,
      ...cloud.comparisonItemIds,
    ].slice(0, 4),
    notes: { ...local.notes, ...cloud.notes },
  });
}

export function createEmptyInventory(): InventoryState {
  return normalizeInventoryState(EMPTY_INVENTORY);
}
