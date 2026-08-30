import type {
  CatalogEquipmentRecord,
  OptimizerSafeCatalogEquipment,
} from './model';

export function isOptimizerSafeEquipment(
  item: CatalogEquipmentRecord,
): item is OptimizerSafeCatalogEquipment {
  return (
    item.verificationStatus === 'verified' &&
    typeof item.attack === 'number' &&
    Number.isFinite(item.attack) &&
    typeof item.defense === 'number' &&
    Number.isFinite(item.defense) &&
    typeof item.dexterity === 'number' &&
    Number.isFinite(item.dexterity) &&
    typeof item.levelRequirement === 'number' &&
    Number.isInteger(item.levelRequirement) &&
    item.acquisitions.length > 0
  );
}
