import type { CharacterProfile } from '../build/model';
import type { EquipmentRecord } from '../dataset/model';

export type CandidateClassification =
  | { eligible: false; reason: string }
  | { eligible: true; immediate: boolean; reason?: string };

export function classifyCandidate(
  profile: CharacterProfile,
  item: EquipmentRecord,
  owned: ReadonlySet<string>,
): CandidateClassification {
  if (item.verificationStatus !== 'verified') {
    return { eligible: false, reason: 'Item is not verified' };
  }

  if (
    item.weaponPaths.length > 0 &&
    !item.weaponPaths.includes(profile.weaponPath)
  ) {
    return { eligible: false, reason: 'Incompatible weapon path' };
  }

  if (item.floor > profile.maxFloor) {
    return { eligible: false, reason: `Requires Floor ${item.floor}` };
  }

  if (item.availability === 'inactive-event' && !owned.has(item.id)) {
    return {
      eligible: false,
      reason: 'Event item is not currently obtainable',
    };
  }

  if (item.levelRequirement > profile.level + 10) {
    return {
      eligible: false,
      reason: `Requires Level ${item.levelRequirement} beyond the ten-level plan`,
    };
  }

  if (item.levelRequirement > profile.level) {
    return {
      eligible: true,
      immediate: false,
      reason: `Requires Level ${item.levelRequirement}`,
    };
  }

  if (profile.weaponPath === 'dual-wield') {
    if (profile.weaponSkill === undefined) {
      return {
        eligible: true,
        immediate: false,
        reason: 'Requires Weapon Skill 200 for Dual Wield; confirm in game',
      };
    }

    if (profile.weaponSkill < 200) {
      return {
        eligible: true,
        immediate: false,
        reason: 'Requires Weapon Skill 200 for Dual Wield',
      };
    }
  }

  if (item.skillRequirement !== undefined) {
    if (profile.weaponSkill === undefined) {
      return {
        eligible: true,
        immediate: false,
        reason: `Requires Weapon Skill ${item.skillRequirement}; confirm in game`,
      };
    }

    if (profile.weaponSkill < item.skillRequirement) {
      return {
        eligible: true,
        immediate: false,
        reason: `Requires Weapon Skill ${item.skillRequirement}`,
      };
    }
  }

  return { eligible: true, immediate: true };
}
