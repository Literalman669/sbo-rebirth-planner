import type { DatasetSnapshot } from '../dataset/model';
import { equipmentTotalsForProfile } from '../optimizer/equipmentTotals';
import { compileMechanics } from '../optimizer/mechanics';
import {
  optimizeBuild,
  type RecommendationPlan,
} from '../optimizer/optimizeBuild';
import { assessOptimizationReadiness } from '../optimizer/planReadiness';
import {
  projectMetrics,
  type ProjectedMetrics,
} from '../optimizer/projections';
import {
  buildActionChecklist,
  sumVerifiedCosts,
  type PlanAction,
} from '../results/actionChecklist';
import {
  firstIncompleteEquipmentStep,
  firstIncompleteProfileStep,
} from '../../features/planner/completeness';
import type { CharacterProfile } from './model';

type BuildComparisonBase = {
  profile: CharacterProfile;
};

export type BuildComparisonEvaluation =
  | (BuildComparisonBase & { status: 'dataset-unavailable' })
  | (BuildComparisonBase & {
      status: 'profile-incomplete' | 'equipment-incomplete';
      dataset: DatasetSnapshot;
    })
  | (BuildComparisonBase & {
      status: 'optimizer-unavailable';
      dataset: DatasetSnapshot;
      explanation: string;
    })
  | (BuildComparisonBase & {
      status: 'ready';
      dataset: DatasetSnapshot;
      plan: RecommendationPlan;
      metrics: ProjectedMetrics;
      actions: PlanAction[];
      costs: ReturnType<typeof sumVerifiedCosts>;
    });

export type BuildComparisonMetricId =
  | 'level'
  | 'maxFloor'
  | 'str'
  | 'def'
  | 'agi'
  | 'vit'
  | 'luk'
  | keyof ProjectedMetrics;

export interface BuildComparisonMetricRow {
  id: BuildComparisonMetricId;
  label: string;
  left: number | null;
  right: number | null;
  leader: 'left' | 'right' | 'equal' | 'unknown';
  format: 'number' | 'percent';
}

export interface BuildComparisonResult {
  left: BuildComparisonEvaluation;
  right: BuildComparisonEvaluation;
  metrics: BuildComparisonMetricRow[];
}

export function evaluateBuildForComparison(
  profile: CharacterProfile,
  dataset: DatasetSnapshot | null,
): BuildComparisonEvaluation {
  if (!dataset) return { status: 'dataset-unavailable', profile };
  if (firstIncompleteProfileStep(profile)) {
    return { status: 'profile-incomplete', profile, dataset };
  }
  if (firstIncompleteEquipmentStep(profile, dataset)) {
    return { status: 'equipment-incomplete', profile, dataset };
  }

  const readiness = assessOptimizationReadiness(
    profile,
    dataset.pointsPerLevel,
  );
  if (readiness.status !== 'ready') {
    return {
      status: 'optimizer-unavailable',
      profile,
      dataset,
      explanation: readiness.explanation,
    };
  }

  const plan = optimizeBuild(profile, dataset);
  const metrics = projectMetrics(
    {
      level: profile.level,
      stats: profile.stats,
      gear: equipmentTotalsForProfile(profile, dataset),
    },
    compileMechanics(dataset),
  );
  const names = new Map([
    ...dataset.catalog.map((item) => [item.id, item.name] as const),
    ...dataset.equipment.map((item) => [item.id, item.name] as const),
  ]);
  const actions = buildActionChecklist(profile, plan, names);
  return {
    status: 'ready',
    profile,
    dataset,
    plan,
    metrics,
    actions,
    costs: sumVerifiedCosts(actions),
  };
}

function metricValue(
  evaluation: BuildComparisonEvaluation,
  metric: keyof ProjectedMetrics,
) {
  return evaluation.status === 'ready' ? evaluation.metrics[metric] : null;
}

function leader(left: number | null, right: number | null) {
  if (left === null || right === null) return 'unknown' as const;
  if (Math.abs(left - right) <= 1e-9) return 'equal' as const;
  return left > right ? ('left' as const) : ('right' as const);
}

export function compareBuildEvaluations(
  left: BuildComparisonEvaluation,
  right: BuildComparisonEvaluation,
): BuildComparisonResult {
  const stored: Array<{
    id: BuildComparisonMetricId;
    label: string;
    left: number;
    right: number;
  }> = [
    { id: 'level', label: 'Level', left: left.profile.level, right: right.profile.level },
    { id: 'maxFloor', label: 'Highest floor', left: left.profile.maxFloor, right: right.profile.maxFloor },
    { id: 'str', label: 'STR', left: left.profile.stats.str, right: right.profile.stats.str },
    { id: 'def', label: 'DEF', left: left.profile.stats.def, right: right.profile.stats.def },
    { id: 'agi', label: 'AGI', left: left.profile.stats.agi, right: right.profile.stats.agi },
    { id: 'vit', label: 'VIT', left: left.profile.stats.vit, right: right.profile.stats.vit },
    { id: 'luk', label: 'LUK', left: left.profile.stats.luk, right: right.profile.stats.luk },
  ];
  const projected: Array<{
    id: keyof ProjectedMetrics;
    label: string;
    format: 'number' | 'percent';
  }> = [
    { id: 'attackPerHit', label: 'Damage per hit', format: 'number' },
    { id: 'damageReductionPerHit', label: 'Damage reduction', format: 'number' },
    { id: 'bonusHp', label: 'Bonus HP', format: 'number' },
    { id: 'stamina', label: 'Stamina', format: 'number' },
    { id: 'walkSpeedBonus', label: 'Walk speed bonus', format: 'number' },
    { id: 'sprintSpeedBonus', label: 'Sprint speed bonus', format: 'number' },
    { id: 'critChanceBonus', label: 'Critical chance bonus', format: 'percent' },
    { id: 'dropChanceBonus', label: 'Drop chance bonus', format: 'percent' },
    { id: 'multiHitChanceBonus', label: 'Multi-hit chance bonus', format: 'percent' },
    { id: 'debuffResistanceBonus', label: 'Debuff resistance bonus', format: 'percent' },
  ];

  const metrics: BuildComparisonMetricRow[] = [
    ...stored.map((row) => ({
      ...row,
      leader: leader(row.left, row.right),
      format: 'number' as const,
    })),
    ...projected.map((row) => {
      const leftValue = metricValue(left, row.id);
      const rightValue = metricValue(right, row.id);
      return {
        ...row,
        left: leftValue,
        right: rightValue,
        leader: leader(leftValue, rightValue),
      };
    }),
  ];

  return { left, right, metrics };
}
