import { isOptimizerSafeEquipment } from './eligibility';
import type { CatalogEquipmentRecord, EquipmentRecord } from './model';

export function projectCatalogForOptimizer(
  catalog: readonly CatalogEquipmentRecord[],
): EquipmentRecord[] {
  return catalog.flatMap((item) => {
    if (!isOptimizerSafeEquipment(item)) return [];
    const acquisition = item.acquisitions.find(
      (candidate) => candidate.floor !== undefined,
    );
    if (acquisition?.floor === undefined) return [];
    return [
      {
        id: item.id,
        name: item.name,
        slot: item.slot,
        weaponPaths: [...item.weaponPaths],
        attack: item.attack,
        defense: item.defense,
        dexterity: item.dexterity,
        levelRequirement: item.levelRequirement,
        skillRequirement: item.skillRequirement,
        floor: acquisition.floor,
        acquisitionType: acquisition.type,
        acquisitionDetail: acquisition.detail,
        availability: acquisition.availability,
        sourceUrl: item.sourceUrl,
        sourceRevision: item.sourceRevision,
        lastReviewedAt: item.lastReviewedAt,
        verificationStatus: 'verified',
      },
    ];
  });
}
