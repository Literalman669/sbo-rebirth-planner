import type {
  OptimizationGoal,
  StatBlock,
  StatName,
} from '../build/model';
import {
  scoreMetricDelta,
  STAT_TIE_BREAK_ORDER,
  TARGET_ALIGNMENT_WEIGHT,
  TARGET_SHARES,
} from './goalConfig';
import {
  projectMetrics,
  type GearTotals,
} from './projections';

export interface StatAllocationPlan {
  levels: 10;
  totalPoints: 30;
  added: StatBlock;
  final: StatBlock;
  milestones: Array<{
    afterLevel: number;
    added: StatBlock;
    totals: StatBlock;
  }>;
}

export interface StatAllocationInput {
  level: number;
  stats: StatBlock;
  gear: GearTotals;
  goal: OptimizationGoal;
}

function emptyStats(): StatBlock {
  return { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
}

function copyStats(stats: StatBlock): StatBlock {
  return { ...stats };
}

function sumStats(stats: StatBlock) {
  return STAT_TIE_BREAK_ORDER.reduce(
    (total, stat) => total + stats[stat],
    0,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function targetShareCorrection(
  stats: StatBlock,
  stat: StatName,
  goal: OptimizationGoal,
) {
  const total = Math.max(sumStats(stats), 1);
  const currentShare = stats[stat] / total;
  const desiredShare = TARGET_SHARES[goal][stat];

  return clamp(1 + (desiredShare - currentShare) * 4, 0.5, 2.5);
}

function targetAlignmentBonus(
  stats: StatBlock,
  stat: StatName,
  goal: OptimizationGoal,
) {
  const total = Math.max(sumStats(stats), 1);
  const currentShare = stats[stat] / total;
  const deficit = Math.max(TARGET_SHARES[goal][stat] - currentShare, 0);
  return deficit * TARGET_ALIGNMENT_WEIGHT[goal];
}

function chooseNextStat(
  level: number,
  stats: StatBlock,
  gear: GearTotals,
  goal: OptimizationGoal,
): StatName {
  const current = projectMetrics({ level, stats, gear });
  let bestStat: StatName | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const stat of STAT_TIE_BREAK_ORDER) {
    if (stats[stat] >= 500) continue;

    const candidateStats = { ...stats, [stat]: stats[stat] + 1 };
    const candidate = projectMetrics({ level, stats: candidateStats, gear });
    const score =
      scoreMetricDelta(current, candidate, goal) *
        targetShareCorrection(stats, stat, goal) +
      targetAlignmentBonus(stats, stat, goal);

    if (score > bestScore) {
      bestStat = stat;
      bestScore = score;
    }
  }

  if (!bestStat) {
    throw new Error('not enough stat capacity for a thirty-point plan');
  }

  return bestStat;
}

export function allocateNextTenLevels(
  input: StatAllocationInput,
): StatAllocationPlan {
  const final = copyStats(input.stats);
  const added = emptyStats();
  const milestones: StatAllocationPlan['milestones'] = [];

  for (let pointIndex = 0; pointIndex < 30; pointIndex += 1) {
    const projectedLevel = input.level + Math.floor(pointIndex / 3) + 1;
    const selectedStat = chooseNextStat(
      projectedLevel,
      final,
      input.gear,
      input.goal,
    );
    final[selectedStat] += 1;
    added[selectedStat] += 1;

    if (pointIndex === 14 || pointIndex === 29) {
      milestones.push({
        afterLevel: pointIndex === 14 ? 5 : 10,
        added: copyStats(added),
        totals: copyStats(final),
      });
    }
  }

  return {
    levels: 10,
    totalPoints: 30,
    added,
    final,
    milestones,
  };
}
