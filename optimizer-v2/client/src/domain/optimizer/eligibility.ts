import type { CharacterProfile } from '../build/model';
import type { EquipmentRecord } from '../dataset/model';
import { DEFAULT_ACCESS_PREFERENCES } from '../build/model';

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

  const preferences = profile.accessPreferences ?? DEFAULT_ACCESS_PREFERENCES;
  const isOwned = owned.has(item.id);
  if (
    ['inactive-event', 'legacy', 'unobtainable', 'unknown'].includes(
      item.availability,
    ) &&
    !isOwned
  ) {
    return {
      eligible: false,
      reason: 'Item is not currently obtainable',
    };
  }
  const preferenceRequired =
    (item.availability === 'gamepass' && !preferences.gamepass) ||
    (item.availability === 'badge' && !preferences.badge) ||
    (item.availability === 'active-event' && !preferences.activeEvent) ||
    (['limited', 'rotating'].includes(item.availability) &&
      !preferences.limited);
  if (preferenceRequired && !isOwned) {
    return {
      eligible: false,
      reason: 'Item requires enabled access or ownership',
    };
  }

  if (item.levelRequirement > profile.level + 10) {
    return {
      eligible: false,
      reason: `Requires Level ${item.levelRequirement} beyond the ten-level plan`,
    };
  }

  const unmetRequirements: string[] = [];
  if (item.levelRequirement > profile.level) {
    unmetRequirements.push(`Requires Level ${item.levelRequirement}`);
  }

  let dualWieldGateUnmet = false;
  if (profile.weaponPath === 'dual-wield') {
    if (profile.weaponSkill === undefined) {
      dualWieldGateUnmet = true;
      unmetRequirements.push(
        'Requires Weapon Skill 200 for Dual Wield; confirm in game',
      );
    } else if (profile.weaponSkill < 200) {
      dualWieldGateUnmet = true;
      unmetRequirements.push('Requires Weapon Skill 200 for Dual Wield');
    }
  }

  if (item.skillRequirement !== undefined) {
    const itemSkillUnmet =
      profile.weaponSkill === undefined ||
      profile.weaponSkill < item.skillRequirement;
    const itemSkillExceedsDualWieldGate = item.skillRequirement > 200;
    if (itemSkillUnmet && (!dualWieldGateUnmet || itemSkillExceedsDualWieldGate)) {
      unmetRequirements.push(
        profile.weaponSkill === undefined
          ? `Requires Weapon Skill ${item.skillRequirement}; confirm in game`
          : `Requires Weapon Skill ${item.skillRequirement}`,
      );
    }
  }

  if (unmetRequirements.length > 0) {
    return {
      eligible: true,
      immediate: false,
      reason: unmetRequirements.join(' · '),
    };
  }

  return { eligible: true, immediate: true };
}
