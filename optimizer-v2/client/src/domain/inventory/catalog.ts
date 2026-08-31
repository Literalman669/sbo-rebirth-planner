import type {
  CharacterProfile,
  EquipmentSlot,
} from '../build/model';
import {
  queryEquipment,
  type EquipmentIndex,
  type EquipmentQueryResult,
} from '../equipment/equipmentQuery';
import type { InventoryState } from './state';

export type InventoryCatalogSort =
  | 'name'
  | 'slot'
  | 'level'
  | 'floor'
  | 'price'
  | 'value-per-col'
  | 'projected-improvement';

export type InventoryCatalogQuery = {
  search: string;
  slot: EquipmentSlot | 'all';
  ownership: 'all' | 'owned' | 'missing';
  favoriteOnly: boolean;
  missingUpgradeOnly: boolean;
  pricedOnly: boolean;
  sort: InventoryCatalogSort;
};

export type InventoryCatalogResult = EquipmentQueryResult & {
  favorite: boolean;
  compared: boolean;
  note: string | null;
};

const slots: readonly EquipmentSlot[] = [
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
];

function compareNullable(
  left: number | null,
  right: number | null,
  direction: 'ascending' | 'descending',
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'ascending' ? left - right : right - left;
}

function compareResults(
  left: InventoryCatalogResult,
  right: InventoryCatalogResult,
  sort: InventoryCatalogSort,
) {
  let result = 0;
  if (sort === 'slot') {
    result = left.item.slot.localeCompare(right.item.slot);
  } else if (sort === 'level') {
    result = compareNullable(
      left.item.levelRequirement,
      right.item.levelRequirement,
      'ascending',
    );
  } else if (sort === 'floor') {
    result = compareNullable(left.floor, right.floor, 'ascending');
  } else if (sort === 'price') {
    result = compareNullable(left.price, right.price, 'ascending');
  } else if (sort === 'value-per-col') {
    result = compareNullable(left.valuePerCol, right.valuePerCol, 'descending');
  } else if (sort === 'projected-improvement') {
    result = compareNullable(
      left.projectedImprovement,
      right.projectedImprovement,
      'descending',
    );
  }
  return (
    result ||
    left.item.name.localeCompare(right.item.name) ||
    left.item.id.localeCompare(right.item.id)
  );
}

export function queryInventoryCatalog(
  index: EquipmentIndex,
  profile: CharacterProfile,
  inventory: InventoryState,
  query: InventoryCatalogQuery,
): InventoryCatalogResult[] {
  const resolvedProfile: CharacterProfile = {
    ...profile,
    ownedItemIds: [...inventory.ownedItemIds],
  };
  const targetSlots = query.slot === 'all' ? slots : [query.slot];
  const byId = new Map<string, EquipmentQueryResult>();
  for (const slot of targetSlots) {
    for (const result of queryEquipment(index, resolvedProfile, {
      slot,
      search: query.search,
      sort: 'name',
      showFuture: true,
      ownedOnly: false,
      pricedOnly: false,
    })) {
      if (!byId.has(result.item.id)) byId.set(result.item.id, result);
    }
  }

  const favorites = new Set(inventory.favoriteItemIds);
  const compared = new Set(inventory.comparisonItemIds);
  return [...byId.values()]
    .flatMap((result) => {
      const favorite = favorites.has(result.item.id);
      if (query.ownership === 'owned' && !result.owned) return [];
      if (query.ownership === 'missing' && result.owned) return [];
      if (query.favoriteOnly && !favorite) return [];
      if (query.pricedOnly && result.price === null) return [];
      if (
        query.missingUpgradeOnly &&
        (result.owned ||
          result.state !== 'equip-now' ||
          result.projectedImprovement === null ||
          result.projectedImprovement <= 0)
      ) {
        return [];
      }
      return [
        {
          ...result,
          favorite,
          compared: compared.has(result.item.id),
          note: inventory.notes[result.item.id] ?? null,
        },
      ];
    })
    .sort((left, right) => compareResults(left, right, query.sort));
}

export function unresolvedInventoryIds(
  index: EquipmentIndex,
  inventory: InventoryState,
): string[] {
  const known = new Set(index.entries.map((entry) => entry.item.id));
  return [
    ...new Set([
      ...inventory.ownedItemIds,
      ...inventory.favoriteItemIds,
      ...inventory.comparisonItemIds,
      ...Object.keys(inventory.notes),
    ]),
  ]
    .filter((itemId) => !known.has(itemId))
    .sort((left, right) => left.localeCompare(right));
}
