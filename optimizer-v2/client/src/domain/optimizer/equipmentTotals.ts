import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import type { GearTotals } from './projections';

export function equipmentTotalsForProfile(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): GearTotals {
  const equipped = new Set(Object.values(profile.equipped));
  return dataset.equipment.reduce<GearTotals>(
    (totals, item) => {
      if (!equipped.has(item.id)) return totals;
      return {
        attack: totals.attack + item.attack,
        defense: totals.defense + item.defense,
        dexterity: totals.dexterity + item.dexterity,
      };
    },
    { attack: 0, defense: 0, dexterity: 0 },
  );
}
