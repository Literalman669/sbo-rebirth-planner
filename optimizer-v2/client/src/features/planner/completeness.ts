import type {
  CharacterProfile,
  EquipmentSlot,
} from '../../domain/build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../../domain/dataset/model';

export type StatBudget = {
  expected: number;
  invested: number;
  difference: number;
  status: 'balanced' | 'unaccounted' | 'overspent';
};

function itemFitsSlot(
  profile: CharacterProfile,
  item: EquipmentRecord | undefined,
  slot: EquipmentSlot,
) {
  if (!item || item.verificationStatus !== 'verified') return false;
  if (item.floor > profile.maxFloor) return false;
  if (
    item.weaponPaths.length > 0 &&
    !item.weaponPaths.includes(profile.weaponPath)
  ) {
    return false;
  }
  if (
    slot === 'off-hand' &&
    profile.weaponPath === 'dual-wield' &&
    item.slot === 'main-hand'
  ) {
    return true;
  }
  return item.slot === slot;
}

export function requiredEquipmentSlots(
  profile: CharacterProfile,
): EquipmentSlot[] {
  return profile.weaponPath === 'dual-wield'
    ? ['main-hand', 'off-hand', 'armor']
    : ['main-hand', 'armor'];
}

export function firstIncompleteStep(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): '/character' | '/stats' | '/equipment' | null {
  return (
    firstIncompleteProfileStep(profile) ??
    firstIncompleteEquipmentStep(profile, dataset)
  );
}

export function firstIncompleteProfileStep(
  profile: CharacterProfile,
): '/character' | '/stats' | null {
  if (
    profile.level < 1 ||
    profile.maxFloor < 1 ||
    profile.maxFloor > 19 ||
    !profile.weaponPath
  ) {
    return '/character';
  }

  if (
    Object.values(profile.stats).some(
      (value) => !Number.isInteger(value) || value < 0 || value > 500,
    )
  ) {
    return '/stats';
  }

  return null;
}

export function firstIncompleteEquipmentStep(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): '/equipment' | null {
  const equipmentById = new Map(
    dataset.equipment.map((item) => [item.id, item]),
  );
  const missingEquipment = requiredEquipmentSlots(profile).some((slot) =>
    !itemFitsSlot(profile, equipmentById.get(profile.equipped[slot] ?? ''), slot),
  );

  return missingEquipment ? '/equipment' : null;
}

export function expectedInvestedPoints(level: number) {
  return level * 3;
}

export function analyzeStatBudget(
  profile: CharacterProfile,
  pointsPerLevel: number,
): StatBudget {
  const expected = profile.level * pointsPerLevel;
  const invested = Object.values(profile.stats).reduce(
    (total, value) => total + value,
    0,
  );
  const difference = expected - invested;

  return {
    expected,
    invested,
    difference,
    status:
      difference === 0
        ? 'balanced'
        : difference > 0
          ? 'unaccounted'
          : 'overspent',
  };
}

export function compatibleItemsForSlot(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
  slot: EquipmentSlot,
) {
  return dataset.equipment.filter((item) => itemFitsSlot(profile, item, slot));
}
