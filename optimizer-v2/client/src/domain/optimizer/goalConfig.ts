import type {
  OptimizationGoal,
  StatBlock,
  StatName,
} from '../build/model';
import type { ProjectedMetrics } from './projections';

export type GoalDimension = 'damage' | 'survival' | 'mobility' | 'farming';
export type GoalWeights = Record<GoalDimension, number>;

export const GOAL_WEIGHTS: Record<OptimizationGoal, GoalWeights> = {
  balanced: { damage: 1, survival: 1, mobility: 0.5, farming: 0.25 },
  damage: { damage: 1.75, survival: 0.5, mobility: 0.35, farming: 0.05 },
  survivability: {
    damage: 0.55,
    survival: 1.75,
    mobility: 0.35,
    farming: 0.05,
  },
  mobility: { damage: 0.65, survival: 0.55, mobility: 1.75, farming: 0.1 },
  farming: { damage: 0.6, survival: 0.5, mobility: 0.5, farming: 2 },
};

export const TARGET_SHARES: Record<OptimizationGoal, StatBlock> = {
  balanced: { str: 0.3, def: 0.2, agi: 0.2, vit: 0.2, luk: 0.1 },
  damage: { str: 0.55, def: 0.1, agi: 0.2, vit: 0.1, luk: 0.05 },
  survivability: { str: 0.15, def: 0.35, agi: 0.1, vit: 0.35, luk: 0.05 },
  mobility: { str: 0.2, def: 0.1, agi: 0.5, vit: 0.15, luk: 0.05 },
  farming: { str: 0.2, def: 0.1, agi: 0.15, vit: 0.1, luk: 0.45 },
};

export const STAT_TIE_BREAK_ORDER: readonly StatName[] = [
  'str',
  'def',
  'agi',
  'vit',
  'luk',
];

function metricDelta(next: number, current: number) {
  return next - current;
}

export function metricDimensionDeltas(
  current: ProjectedMetrics,
  next: ProjectedMetrics,
): Record<GoalDimension, number> {
  return {
    damage:
      metricDelta(next.attackPerHit, current.attackPerHit) / 100 +
      (metricDelta(next.critChanceBonus, current.critChanceBonus) / 0.05) *
        0.25,
    survival:
      metricDelta(
        next.damageReductionPerHit,
        current.damageReductionPerHit,
      ) /
        100 +
      metricDelta(next.bonusHp, current.bonusHp) / 1_000,
    mobility:
      metricDelta(next.stamina, current.stamina) / 100 +
      metricDelta(next.walkSpeedBonus, current.walkSpeedBonus) / 2 +
      metricDelta(next.sprintSpeedBonus, current.sprintSpeedBonus) / 10,
    farming:
      metricDelta(next.dropChanceBonus, current.dropChanceBonus) / 0.05,
  };
}

export function scoreMetricDelta(
  current: ProjectedMetrics,
  next: ProjectedMetrics,
  goal: OptimizationGoal,
) {
  const dimensions = metricDimensionDeltas(current, next);
  const weights = GOAL_WEIGHTS[goal];

  return (
    dimensions.damage * weights.damage +
    dimensions.survival * weights.survival +
    dimensions.mobility * weights.mobility +
    dimensions.farming * weights.farming
  );
}
