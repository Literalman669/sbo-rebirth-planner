import type { CharacterProfile, EquipmentSlot } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import { hashString } from '../datasetImpact/canonical';

const slots: EquipmentSlot[] = [
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
];

export function projectRecommendationBuildInputs(profile: CharacterProfile) {
  const access = profile.accessPreferences;
  return {
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
  };
}

export function fingerprintRecommendationInput(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
) {
  const canonical = {
    ...projectRecommendationBuildInputs(profile),
    datasetVersion: profile.datasetVersion,
    strategyPolicyVersion: dataset.strategyPolicyVersion,
  };
  return `plan-${hashString(JSON.stringify(canonical))}`;
}
