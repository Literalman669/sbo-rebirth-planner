import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import { analyzeStatBudget } from '../../features/planner/completeness';
import {
  allocateStatPlan,
  type StatAllocationPlan,
} from './allocateStats';
import {
  recommendEquipment,
  type ImmediateAction,
  type UpgradeTarget,
} from './recommendEquipment';
import { assessOptimizationReadiness } from './planReadiness';
import { compileMechanics } from './mechanics';

export interface RecommendationPlan {
  datasetVersion: string;
  immediateAction: ImmediateAction;
  statPlan: StatAllocationPlan;
  upgradeTargets: UpgradeTarget[];
  warnings: string[];
  explanation: string[];
}

export function optimizeBuild(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): RecommendationPlan {
  const readiness = assessOptimizationReadiness(profile, dataset.pointsPerLevel);
  if (readiness.status !== 'ready') {
    throw new Error(readiness.explanation);
  }

  if (!['sbor-stats-v1', 'sbor-stats-v2'].includes(dataset.formulaSetVersion)) {
    throw new Error(`unsupported formula set: ${dataset.formulaSetVersion}`);
  }

  const equipment = recommendEquipment(profile, dataset);
  const statBudget = analyzeStatBudget(profile, dataset.pointsPerLevel);
  const mechanics = compileMechanics(dataset);
  const warnings: string[] = [];

  return {
    datasetVersion: dataset.version,
    immediateAction: equipment.immediateAction,
    statPlan: allocateStatPlan({
      level: profile.level,
      stats: profile.stats,
      gear: dataset.equipment.reduce(
        (totals, item) => {
          if (!Object.values(profile.equipped).includes(item.id)) return totals;
          totals.attack += item.attack;
          totals.defense += item.defense;
          totals.dexterity += item.dexterity;
          return totals;
        },
        { attack: 0, defense: 0, dexterity: 0 },
      ),
      goal: profile.goal,
      mechanics,
      unspentPoints: statBudget.difference,
    }),
    upgradeTargets: equipment.upgradeTargets,
    warnings,
    explanation: [
      `Planner strategy policy ${dataset.strategyPolicyVersion} applied ${profile.goal} priorities to verified metrics.`,
      `Only verified records from dataset ${dataset.version} were considered.`,
      ...(mechanics.descriptive.length > 0
        ? [
            `${mechanics.descriptive.map((item) => item.id).join(', ')} are documented descriptively and were not numerically scored.`,
          ]
        : []),
    ],
  };
}
