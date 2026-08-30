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
import type { CompiledMechanics } from './mechanics';

export interface SpendNowAllocation {
  points: number;
  added: StatBlock;
  totals: StatBlock;
}

export interface LevelAllocationRow {
  level: number;
  added: StatBlock;
  totals: StatBlock;
}

export interface StatAllocationPlan {
  spendNow: SpendNowAllocation;
  levels: 10;
  futurePoints: 30;
  futureAdded: StatBlock;
  levelRows: LevelAllocationRow[];
  final: StatBlock;
  milestones: Array<{
    afterLevel: 5 | 10;
    added: StatBlock;
    totals: StatBlock;
  }>;
}

export interface NextTenLevelsPlan {
  levels: 10;
  totalPoints: 30;
  added: StatBlock;
  final: StatBlock;
  milestones: StatAllocationPlan['milestones'];
}

export interface StatAllocationInput {
  level: number;
  stats: StatBlock;
  gear: GearTotals;
  goal: OptimizationGoal;
  mechanics: CompiledMechanics;
  lockedStats?: ReadonlySet<StatName>;
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
  mechanics: CompiledMechanics,
  lockedStats?: ReadonlySet<StatName>,
): StatName {
  const current = projectMetrics({ level, stats, gear }, mechanics);
  let bestStat: StatName | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const stat of STAT_TIE_BREAK_ORDER) {
    if (lockedStats?.has(stat)) continue;
    if (stats[stat] >= mechanics.statCap) continue;

    const candidateStats = { ...stats, [stat]: stats[stat] + 1 };
    const candidate = projectMetrics(
      { level, stats: candidateStats, gear },
      mechanics,
    );
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

function allocatePoints(
  count: number,
  levelForPoint: (pointIndex: number) => number,
  final: StatBlock,
  added: StatBlock,
  input: StatAllocationInput,
) {
  for (let pointIndex = 0; pointIndex < count; pointIndex += 1) {
    const selectedStat = chooseNextStat(
      levelForPoint(pointIndex),
      final,
      input.gear,
      input.goal,
      input.mechanics,
      input.lockedStats,
    );
    final[selectedStat] += 1;
    added[selectedStat] += 1;
  }
}

export function allocateStatPlan(
  input: StatAllocationInput & { unspentPoints: number },
): StatAllocationPlan {
  if (!Number.isInteger(input.unspentPoints) || input.unspentPoints < 0) {
    throw new Error('unspent points must be a nonnegative whole number');
  }

  const final = copyStats(input.stats);
  const spendNowAdded = emptyStats();
  allocatePoints(
    input.unspentPoints,
    () => input.level,
    final,
    spendNowAdded,
    input,
  );
  const spendNow: SpendNowAllocation = {
    points: input.unspentPoints,
    added: copyStats(spendNowAdded),
    totals: copyStats(final),
  };

  const futureAdded = emptyStats();
  const levelRows: LevelAllocationRow[] = [];
  const milestones: StatAllocationPlan['milestones'] = [];

  for (let levelOffset = 1; levelOffset <= 10; levelOffset += 1) {
    const rowAdded = emptyStats();
    allocatePoints(
      3,
      () => input.level + levelOffset,
      final,
      rowAdded,
      input,
    );
    for (const stat of STAT_TIE_BREAK_ORDER) {
      futureAdded[stat] += rowAdded[stat];
    }
    const row = {
      level: input.level + levelOffset,
      added: copyStats(rowAdded),
      totals: copyStats(final),
    };
    levelRows.push(row);
    if (levelOffset === 5 || levelOffset === 10) {
      milestones.push({
        afterLevel: levelOffset,
        added: copyStats(futureAdded),
        totals: copyStats(final),
      });
    }
  }

  return {
    spendNow,
    levels: 10,
    futurePoints: 30,
    futureAdded,
    levelRows,
    final,
    milestones,
  };
}

export function allocateNextTenLevels(
  input: StatAllocationInput,
): NextTenLevelsPlan {
  const plan = allocateStatPlan({ ...input, unspentPoints: 0 });

  return {
    levels: 10,
    totalPoints: 30,
    added: plan.futureAdded,
    final: plan.final,
    milestones: plan.milestones,
  };
}
