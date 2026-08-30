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
  type ProjectedMetrics,
} from './projections';
import { compileMechanics } from './mechanics';
import { aggregateGearEffects, compareGearEffects } from './gearEffects';

export interface UpgradeTarget {
  itemId: string;
  slot: EquipmentSlot;
  immediate: boolean;
  eligibilityNote?: string;
  acquisitionDetail: string;
  requirementText: string;
  sourceUrl: string;
  priceText?: string;
  verifiedCost?: { amount: number; currency: string };
  delta: Partial<ProjectedMetrics>;
  rawDelta: ReturnType<typeof compareGearEffects>['rawDelta'];
  unmodeledEffects: string[];
}

export type ImmediateAction =
  | { kind: 'equip-owned'; itemId: string; summary: string }
  | { kind: 'obtain-upgrade'; itemId: string; summary: string }
  | { kind: 'keep-current'; summary: string };

export interface EquipmentRecommendation {
  immediateAction: ImmediateAction;
  upgradeTargets: UpgradeTarget[];
}

export type RankedEquipmentUpgradeCandidate = UpgradeTarget & {
  item: EquipmentRecord;
  owned: boolean;
  score: number;
};

function indexEquipment(dataset: DatasetSnapshot) {
  return new Map(dataset.equipment.map((item) => [item.id, item]));
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

function compareRankedUpgrades(
  left: RankedEquipmentUpgradeCandidate,
  right: RankedEquipmentUpgradeCandidate,
) {
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

export function rankEquipmentUpgradeCandidates(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): RankedEquipmentUpgradeCandidate[] {
  const equipmentById = indexEquipment(dataset);
  const mechanics = compileMechanics(dataset);
  const catalogById = new Map(dataset.catalog.map((item) => [item.id, item]));
  for (const item of dataset.equipment) {
    if (catalogById.has(item.id)) continue;
    catalogById.set(item.id, {
      id: item.id,
      name: item.name,
      aliases: [],
      slot: item.slot,
      weaponPaths: [...item.weaponPaths],
      attack: item.attack,
      defense: item.defense,
      dexterity: item.dexterity,
      levelRequirement: item.levelRequirement,
      skillRequirement: item.skillRequirement,
      acquisitions: [{
        id: `${item.id}:legacy`,
        type: item.acquisitionType,
        detail: item.acquisitionDetail,
        floor: item.floor,
        availability: item.availability,
        accessType: 'free',
        sourceUrl: item.sourceUrl,
        sourceRevision: item.sourceRevision,
      }],
      resistances: [],
      specialEffects: [],
      verificationStatus: 'verified',
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
      lastReviewedAt: item.lastReviewedAt,
    });
  }
  const owned = new Set(profile.ownedItemIds);
  const equippedItemIds = new Set(Object.values(profile.equipped));
  const currentEffects = aggregateGearEffects(profile.equipped, catalogById);
  const currentMetrics = projectMetrics({
    level: profile.level,
    stats: profile.stats,
    gear: {
      attack: currentEffects.attack,
      defense: currentEffects.defense,
      dexterity: currentEffects.dexterity,
    },
  }, mechanics);
  const ranked: RankedEquipmentUpgradeCandidate[] = [];

  for (const item of dataset.equipment) {
    if (equippedItemIds.has(item.id)) continue;
    const classification = classifyCandidate(profile, item, owned);
    if (!classification.eligible) continue;

    for (const slot of targetSlots(profile, item)) {
      const candidateEquipped = { ...profile.equipped, [slot]: item.id };
      const candidateEffects = aggregateGearEffects(
        candidateEquipped,
        catalogById,
      );
      const candidateMetrics = projectMetrics({
        level: profile.level,
        stats: profile.stats,
        gear: {
          attack: candidateEffects.attack,
          defense: candidateEffects.defense,
          dexterity: candidateEffects.dexterity,
        },
      }, mechanics);
      const score = scoreMetricDelta(
        currentMetrics,
        candidateMetrics,
        profile.goal,
      );

      if (score <= 1e-12) continue;

      const catalogItem = catalogById.get(item.id)!;
      const pricedAcquisition = catalogItem.acquisitions.find(
        (acquisition) =>
          acquisition.cost !== undefined && acquisition.currency !== undefined,
      );
      const comparison = compareGearEffects(
        profile.equipped[slot]
          ? catalogById.get(profile.equipped[slot]!)
          : undefined,
        catalogItem,
      );
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
        sourceUrl: catalogItem.sourceUrl,
        ...(pricedAcquisition
          ? {
              priceText: `${pricedAcquisition.cost!.toLocaleString('en-US')} ${pricedAcquisition.currency}`,
              verifiedCost: {
                amount: pricedAcquisition.cost!,
                currency: pricedAcquisition.currency!,
              },
            }
          : {}),
        delta: projectedDelta(currentMetrics, candidateMetrics),
        rawDelta: comparison.rawDelta,
        unmodeledEffects: comparison.unmodeledEffects,
      });
    }
  }

  return ranked.sort(compareRankedUpgrades);
}

export function recommendEquipment(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): EquipmentRecommendation {
  const ranked = rankEquipmentUpgradeCandidates(profile, dataset);
  const selectedSlots = new Set<EquipmentSlot>();
  const selectedItems = new Set<string>();
  const selected: RankedEquipmentUpgradeCandidate[] = [];

  const ownedImmediate = ranked.find(
    (candidate) => candidate.owned && candidate.immediate,
  );
  const obtainableImmediate = ranked.find(
    (candidate) => !candidate.owned && candidate.immediate,
  );
  const immediateTarget = ownedImmediate ?? obtainableImmediate;
  if (immediateTarget) {
    selected.push(immediateTarget);
    selectedSlots.add(immediateTarget.slot);
    selectedItems.add(immediateTarget.itemId);
  }

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
