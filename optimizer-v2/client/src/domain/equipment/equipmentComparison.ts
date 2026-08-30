import type {
  CharacterProfile,
  EquipmentSlot,
} from '../build/model';
import type {
  CatalogEquipmentRecord,
  DatasetSnapshot,
} from '../dataset/model';
import { aggregateGearEffects, compareGearEffects } from '../optimizer/gearEffects';
import { scoreMetricDelta } from '../optimizer/goalConfig';
import { compileMechanics } from '../optimizer/mechanics';
import {
  projectMetrics,
  type ProjectedMetrics,
} from '../optimizer/projections';

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
    critChanceBonus: difference(next.critChanceBonus, current.critChanceBonus),
    dropChanceBonus: difference(next.dropChanceBonus, current.dropChanceBonus),
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

export function compareEquipment(
  profile: CharacterProfile,
  slot: EquipmentSlot,
  candidate: CatalogEquipmentRecord,
  snapshot: DatasetSnapshot,
) {
  const catalogById = new Map(snapshot.catalog.map((item) => [item.id, item]));
  const currentItemId = profile.equipped[slot];
  const currentItem = currentItemId ? catalogById.get(currentItemId) : undefined;
  const currentEffects = aggregateGearEffects(profile.equipped, catalogById);
  const candidateEquipped = { ...profile.equipped, [slot]: candidate.id };
  const candidateEffects = aggregateGearEffects(candidateEquipped, catalogById);
  const mechanics = compileMechanics(snapshot);
  const currentMetrics = projectMetrics(
    {
      level: profile.level,
      stats: profile.stats,
      gear: {
        attack: currentEffects.attack,
        defense: currentEffects.defense,
        dexterity: currentEffects.dexterity,
      },
    },
    mechanics,
  );
  const candidateMetrics = projectMetrics(
    {
      level: profile.level,
      stats: profile.stats,
      gear: {
        attack: candidateEffects.attack,
        defense: candidateEffects.defense,
        dexterity: candidateEffects.dexterity,
      },
    },
    mechanics,
  );
  const gearComparison = compareGearEffects(currentItem, candidate);
  const pricedAcquisition = candidate.acquisitions
    .filter(
      (acquisition) =>
        acquisition.cost !== undefined && acquisition.currency !== undefined,
    )
    .sort((left, right) => left.cost! - right.cost!)[0];

  return {
    rawDelta: gearComparison.rawDelta,
    projectedDelta: projectedDelta(currentMetrics, candidateMetrics),
    score: scoreMetricDelta(currentMetrics, candidateMetrics, profile.goal),
    unmodeledEffects: gearComparison.unmodeledEffects,
    unsupportedNumericFields: candidateEffects.unsupportedNumericFields,
    price: pricedAcquisition
      ? { cost: pricedAcquisition.cost!, currency: pricedAcquisition.currency! }
      : null,
    acquisition: pricedAcquisition ?? candidate.acquisitions[0] ?? null,
    sourceUrl: candidate.sourceUrl,
    sourceRevision: candidate.sourceRevision,
  };
}
