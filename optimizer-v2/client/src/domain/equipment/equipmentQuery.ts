import type {
  CharacterProfile,
  EquipmentSlot,
} from '../build/model';
import { DEFAULT_ACCESS_PREFERENCES } from '../build/model';
import type {
  CatalogEquipmentRecord,
  DatasetSnapshot,
  EquipmentRecord,
} from '../dataset/model';
import { compareEquipment } from './equipmentComparison';

export type EquipmentSort =
  | 'projected-improvement'
  | 'raw-strength'
  | 'price'
  | 'value-per-col'
  | 'level'
  | 'floor'
  | 'name';

export interface EquipmentQuery {
  slot: EquipmentSlot;
  search: string;
  sort: EquipmentSort;
  showFuture: boolean;
  ownedOnly: boolean;
  pricedOnly: boolean;
}

export interface EquipmentIndexEntry {
  item: CatalogEquipmentRecord;
  optimizerItem: EquipmentRecord | null;
  searchText: string;
  price: number | null;
  currency: string | null;
  floor: number | null;
}

export interface EquipmentIndex {
  version: string;
  snapshot: DatasetSnapshot;
  entries: readonly EquipmentIndexEntry[];
}

export interface EquipmentQueryResult extends EquipmentIndexEntry {
  state: 'equip-now' | 'unlock-later' | 'unavailable';
  reasons: string[];
  owned: boolean;
  equipped: boolean;
  projectedImprovement: number | null;
  rawStrength: number | null;
  valuePerCol: number | null;
}

function targetMatchesSlot(
  item: CatalogEquipmentRecord,
  slot: EquipmentSlot,
  profile: CharacterProfile,
) {
  if (item.slot === slot) return true;
  return (
    slot === 'off-hand' &&
    profile.weaponPath === 'dual-wield' &&
    item.slot === 'main-hand'
  );
}

export function buildEquipmentIndex(snapshot: DatasetSnapshot): EquipmentIndex {
  const optimizerById = new Map(
    snapshot.equipment.map((item) => [item.id, item]),
  );
  const entries = snapshot.catalog.map((item) => {
    const prices = item.acquisitions
      .filter(
        (acquisition) =>
          acquisition.cost !== undefined && acquisition.currency !== undefined,
      )
      .sort((left, right) => left.cost! - right.cost!);
    const floors = item.acquisitions.flatMap((acquisition) =>
      acquisition.floor === undefined ? [] : [acquisition.floor],
    );
    return Object.freeze({
      item,
      optimizerItem: optimizerById.get(item.id) ?? null,
      searchText: [item.name, item.id, ...item.aliases].join(' ').toLowerCase(),
      price: prices[0]?.cost ?? null,
      currency: prices[0]?.currency ?? null,
      floor: floors.length > 0 ? Math.min(...floors) : null,
    });
  });
  return Object.freeze({
    version: snapshot.version,
    snapshot,
    entries: Object.freeze(entries),
  });
}

function classify(
  entry: EquipmentIndexEntry,
  profile: CharacterProfile,
): Pick<EquipmentQueryResult, 'state' | 'reasons' | 'owned' | 'equipped'> {
  const { item, optimizerItem } = entry;
  const owned = profile.ownedItemIds.includes(item.id);
  const equipped = Object.values(profile.equipped).includes(item.id);
  const hardReasons: string[] = [];
  const futureReasons: string[] = [];

  if (item.verificationStatus !== 'verified' || !optimizerItem) {
    hardReasons.push('Numeric stats are not fully verified');
  }
  if (
    item.weaponPaths.length > 0 &&
    !item.weaponPaths.includes(profile.weaponPath)
  ) {
    hardReasons.push('Incompatible weapon path');
  }

  const preferences = profile.accessPreferences ?? DEFAULT_ACCESS_PREFERENCES;
  if (!owned) {
    const accessTypes = new Set(item.acquisitions.map((row) => row.accessType));
    if (accessTypes.has('gamepass') && !preferences.gamepass) {
      hardReasons.push('Enable gamepass access');
    } else if (accessTypes.has('badge') && !preferences.badge) {
      hardReasons.push('Enable badge access');
    } else if (accessTypes.has('event') && !preferences.activeEvent) {
      hardReasons.push('Enable active event access');
    } else if (accessTypes.has('limited') && !preferences.limited) {
      hardReasons.push('Enable limited or rotating access');
    } else if (
      item.acquisitions.length > 0 &&
      item.acquisitions.every(
        (row) =>
          row.floor === undefined &&
          row.accessType === 'free' &&
          ['shop', 'mob-drop', 'boss-drop', 'crafting', 'quest'].includes(
            row.type,
          ),
      )
    ) {
      hardReasons.push('Acquisition floor is not verified');
    }
  }

  if (item.levelRequirement === null) {
    hardReasons.push('Level requirement is not verified');
  } else if (item.levelRequirement > profile.level) {
    futureReasons.push(`Requires Level ${item.levelRequirement}`);
  }
  if (entry.floor !== null && entry.floor > profile.maxFloor) {
    futureReasons.push(`Requires Floor ${entry.floor}`);
  }
  if (
    item.skillRequirement !== undefined &&
    (profile.weaponSkill === undefined ||
      profile.weaponSkill < item.skillRequirement)
  ) {
    futureReasons.push(`Requires Weapon Skill ${item.skillRequirement}`);
  }

  return {
    state:
      hardReasons.length > 0
        ? 'unavailable'
        : futureReasons.length > 0
          ? 'unlock-later'
          : 'equip-now',
    reasons: hardReasons.length > 0 ? hardReasons : futureReasons,
    owned,
    equipped,
  };
}

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

export function queryEquipment(
  index: EquipmentIndex,
  profile: CharacterProfile,
  query: EquipmentQuery,
): EquipmentQueryResult[] {
  const search = query.search.trim().toLowerCase();
  const results = index.entries.flatMap((entry) => {
    if (!targetMatchesSlot(entry.item, query.slot, profile)) return [];
    if (search && !entry.searchText.includes(search)) return [];
    const state = classify(entry, profile);
    if (!query.showFuture && state.state === 'unlock-later') return [];
    if (query.ownedOnly && !state.owned) return [];
    if (query.pricedOnly && entry.price === null) return [];
    let projectedImprovement: number | null = null;
    if (entry.optimizerItem && entry.item.verificationStatus === 'verified') {
      try {
        projectedImprovement = compareEquipment(
          profile,
          query.slot,
          entry.item,
          index.snapshot,
        ).score;
      } catch {
        projectedImprovement = null;
      }
    }
    const rawStrength =
      entry.item.attack === null ||
      entry.item.defense === null ||
      entry.item.dexterity === null
        ? null
        : entry.item.attack + entry.item.defense + entry.item.dexterity;
    return [
      {
        ...entry,
        ...state,
        projectedImprovement,
        rawStrength,
        valuePerCol:
          projectedImprovement !== null &&
          entry.price !== null &&
          entry.price > 0
            ? projectedImprovement / entry.price
            : null,
      },
    ];
  });

  return results.sort((left, right) => {
    let result = 0;
    if (query.sort === 'projected-improvement') {
      result = compareNullable(
        left.projectedImprovement,
        right.projectedImprovement,
        'descending',
      );
    } else if (query.sort === 'raw-strength') {
      result = compareNullable(left.rawStrength, right.rawStrength, 'descending');
    } else if (query.sort === 'price') {
      result = compareNullable(left.price, right.price, 'ascending');
    } else if (query.sort === 'value-per-col') {
      result = compareNullable(left.valuePerCol, right.valuePerCol, 'descending');
    } else if (query.sort === 'level') {
      result = compareNullable(
        left.item.levelRequirement,
        right.item.levelRequirement,
        'ascending',
      );
    } else if (query.sort === 'floor') {
      result = compareNullable(left.floor, right.floor, 'ascending');
    }
    return result || left.item.name.localeCompare(right.item.name) || left.item.id.localeCompare(right.item.id);
  });
}
