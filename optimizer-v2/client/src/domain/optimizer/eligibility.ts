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
