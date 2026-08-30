import type {
  CharacterProfile,
  EquipmentSlot,
} from '../build/model';
import type {
  DatasetSnapshot,
  EquipmentRecord,
} from '../dataset/model';
import { classifyCandidate } from './eligibility';
import { scoreMetricDelta } from './goalConfig';
import {
  projectMetrics,
  type GearTotals,
  type ProjectedMetrics,
} from './projections';
import { compileMechanics } from './mechanics';

export interface UpgradeTarget {
  itemId: string;
  slot: EquipmentSlot;
  immediate: boolean;
  eligibilityNote?: string;
  acquisitionDetail: string;
  requirementText: string;
  sourceUrl: string;
  delta: Partial<ProjectedMetrics>;
}

export type ImmediateAction =
  | { kind: 'equip-owned'; itemId: string; summary: string }
  | { kind: 'obtain-upgrade'; itemId: string; summary: string }
  | { kind: 'keep-current'; summary: string };

export interface EquipmentRecommendation {
  immediateAction: ImmediateAction;
  upgradeTargets: UpgradeTarget[];
}

type RankedUpgrade = UpgradeTarget & {
  item: EquipmentRecord;
  owned: boolean;
  score: number;
};

function indexEquipment(dataset: DatasetSnapshot) {
  return new Map(dataset.equipment.map((item) => [item.id, item]));
}

function gearTotals(
  equipped: CharacterProfile['equipped'],
  equipmentById: ReadonlyMap<string, EquipmentRecord>,
): GearTotals {
  const totals: GearTotals = { attack: 0, defense: 0, dexterity: 0 };

  for (const itemId of Object.values(equipped)) {
    if (!itemId) continue;
    const item = equipmentById.get(itemId);
    if (!item) throw new Error(`equipped item is missing from dataset: ${itemId}`);
    totals.attack += item.attack;
    totals.defense += item.defense;
    totals.dexterity += item.dexterity;
  }

  return totals;
}

function targetSlots(
  profile: CharacterProfile,
  item: EquipmentRecord,
): EquipmentSlot[] {
  if (profile.weaponPath === 'dual-wield' && item.slot === 'main-hand') {
    return ['main-hand', 'off-hand'];
  }

  return [item.slot];
}

function projectedDelta(
  current: ProjectedMetrics,
  next: ProjectedMetrics,
): ProjectedMetrics {
  const difference = (nextValue: number | null, currentValue: number | null) =>
    nextValue === null || currentValue === null
      ? null
      : nextValue - currentValue;
  return {
    attackPerHit: difference(next.attackPerHit, current.attackPerHit),
    damageReductionPerHit: difference(
      next.damageReductionPerHit,
      current.damageReductionPerHit,
    ),
    bonusHp: difference(next.bonusHp, current.bonusHp),
    stamina: difference(next.stamina, current.stamina),
    walkSpeedBonus: difference(next.walkSpeedBonus, current.walkSpeedBonus),
    sprintSpeedBonus: difference(
      next.sprintSpeedBonus,
      current.sprintSpeedBonus,
    ),
    critChanceBonus: difference(
      next.critChanceBonus,
      current.critChanceBonus,
    ),
    dropChanceBonus: difference(
      next.dropChanceBonus,
      current.dropChanceBonus,
    ),
    multiHitChanceBonus: difference(
      next.multiHitChanceBonus,
      current.multiHitChanceBonus,
    ),
    debuffResistanceBonus: difference(
      next.debuffResistanceBonus,
      current.debuffResistanceBonus,
    ),
  };
}

function requirementText(item: EquipmentRecord) {
  const requirements = [`Level ${item.levelRequirement}`];
  if (item.skillRequirement !== undefined) {
    requirements.push(`Weapon Skill ${item.skillRequirement}`);
  }
  return requirements.join(' · ');
}

function compareRankedUpgrades(left: RankedUpgrade, right: RankedUpgrade) {
  const leftOwnedImmediate = Number(left.owned && left.immediate);
  const rightOwnedImmediate = Number(right.owned && right.immediate);
  if (leftOwnedImmediate !== rightOwnedImmediate) {
    return rightOwnedImmediate - leftOwnedImmediate;
  }
  if (left.score !== right.score) return right.score - left.score;
  if (left.item.floor !== right.item.floor) {
    return left.item.floor - right.item.floor;
  }
  if (left.item.levelRequirement !== right.item.levelRequirement) {
    return left.item.levelRequirement - right.item.levelRequirement;
  }
  const itemOrder = left.item.id.localeCompare(right.item.id);
  return itemOrder !== 0 ? itemOrder : left.slot.localeCompare(right.slot);
}

function rankUpgrades(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): RankedUpgrade[] {
  const equipmentById = indexEquipment(dataset);
  const mechanics = compileMechanics(dataset);
  const owned = new Set(profile.ownedItemIds);
  const equippedItemIds = new Set(Object.values(profile.equipped));
  const currentMetrics = projectMetrics({
    level: profile.level,
    stats: profile.stats,
    gear: gearTotals(profile.equipped, equipmentById),
  }, mechanics);
  const ranked: RankedUpgrade[] = [];

  for (const item of dataset.equipment) {
    if (equippedItemIds.has(item.id)) continue;
    const classification = classifyCandidate(profile, item, owned);
    if (!classification.eligible) continue;

    for (const slot of targetSlots(profile, item)) {
      const candidateEquipped = { ...profile.equipped, [slot]: item.id };
      const candidateMetrics = projectMetrics({
        level: profile.level,
        stats: profile.stats,
        gear: gearTotals(candidateEquipped, equipmentById),
      }, mechanics);
      const score = scoreMetricDelta(
        currentMetrics,
        candidateMetrics,
        profile.goal,
      );

      if (score <= 1e-12) continue;

      ranked.push({
        item,
        itemId: item.id,
        slot,
        immediate: classification.immediate,
        ...(!classification.immediate && classification.reason
          ? { eligibilityNote: classification.reason }
          : {}),
        owned: owned.has(item.id),
        score,
        acquisitionDetail: item.acquisitionDetail,
        requirementText: requirementText(item),
        sourceUrl: item.sourceUrl,
        delta: projectedDelta(currentMetrics, candidateMetrics),
      });
    }
  }

  return ranked.sort(compareRankedUpgrades);
}

export function recommendEquipment(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): EquipmentRecommendation {
  const ranked = rankUpgrades(profile, dataset);
  const selectedSlots = new Set<EquipmentSlot>();
  const selectedItems = new Set<string>();
  const selected: RankedUpgrade[] = [];

  for (const candidate of ranked) {
    if (
      selectedSlots.has(candidate.slot) ||
      selectedItems.has(candidate.itemId)
    ) {
      continue;
    }
    selected.push(candidate);
    selectedSlots.add(candidate.slot);
    selectedItems.add(candidate.itemId);
    if (selected.length === 3) break;
  }

  const ownedImmediate = ranked.find(
    (candidate) => candidate.owned && candidate.immediate,
  );
  const obtainableImmediate = ranked.find(
    (candidate) => !candidate.owned && candidate.immediate,
  );

  let immediateAction: ImmediateAction;
  if (ownedImmediate) {
    immediateAction = {
      kind: 'equip-owned',
      itemId: ownedImmediate.itemId,
      summary: `Equip ${ownedImmediate.item.name} now`,
    };
  } else if (obtainableImmediate) {
    immediateAction = {
      kind: 'obtain-upgrade',
      itemId: obtainableImmediate.itemId,
      summary: `Obtain ${obtainableImmediate.item.name} next`,
    };
  } else {
    immediateAction = {
      kind: 'keep-current',
      summary: 'Keep your current verified equipment for now',
    };
  }

  return {
    immediateAction,
    upgradeTargets: selected.map(
      ({ item: _item, owned: _owned, score: _score, ...target }) => target,
    ),
  };
}
