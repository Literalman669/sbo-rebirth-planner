import type { CharacterProfile, EquipmentSlot } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';

const slots: EquipmentSlot[] = [
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
];

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintRecommendationInput(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
) {
  const access = profile.accessPreferences;
  const canonical = {
    level: profile.level,
    maxFloor: profile.maxFloor,
    weaponPath: profile.weaponPath,
    goal: profile.goal,
    weaponSkill: profile.weaponSkill ?? null,
    stats: [
      profile.stats.str,
      profile.stats.def,
      profile.stats.agi,
      profile.stats.vit,
      profile.stats.luk,
    ],
    equipped: slots.map((slot) => [slot, profile.equipped[slot] ?? null]),
    ownedItemIds: [...profile.ownedItemIds].sort(),
    accessPreferences: [
      access?.activeEvent ?? false,
      access?.gamepass ?? false,
      access?.badge ?? false,
      access?.limited ?? false,
    ],
    datasetVersion: profile.datasetVersion,
    strategyPolicyVersion: dataset.strategyPolicyVersion,
  };
  return `plan-${hashString(JSON.stringify(canonical))}`;
}
