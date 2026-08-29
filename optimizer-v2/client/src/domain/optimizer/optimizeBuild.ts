import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import {
  allocateNextTenLevels,
  type StatAllocationPlan,
} from './allocateStats';
import {
  recommendEquipment,
  type ImmediateAction,
  type UpgradeTarget,
} from './recommendEquipment';

export interface RecommendationPlan {
  datasetVersion: string;
  immediateAction: ImmediateAction;
  statPlan: StatAllocationPlan;
  upgradeTargets: UpgradeTarget[];
  explanation: string[];
}

export function optimizeBuild(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): RecommendationPlan {
  if (dataset.formulaSetVersion !== 'sbor-stats-v1') {
    throw new Error(`unsupported formula set: ${dataset.formulaSetVersion}`);
  }

  const equipment = recommendEquipment(profile, dataset);

  return {
    datasetVersion: dataset.version,
    immediateAction: equipment.immediateAction,
    statPlan: allocateNextTenLevels({
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
    }),
    upgradeTargets: equipment.upgradeTargets,
    explanation: [
      `${profile.goal} weighting guided the projected improvements.`,
      `Only verified records from dataset ${dataset.version} were considered.`,
    ],
  };
}
