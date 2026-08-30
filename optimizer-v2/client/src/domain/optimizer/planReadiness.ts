import type { CharacterProfile } from '../build/model';

const REQUIRED_STAT_CAPACITY = 30;
const STAT_CAP = 500;

export type OptimizationReadiness =
  | {
      status: 'ready';
      remainingStatCapacity: number;
    }
  | {
      status: 'overspent';
      excessPoints: number;
      remainingStatCapacity: number;
      explanation: string;
    }
  | {
      status: 'insufficient-stat-capacity';
      requiredStatCapacity: typeof REQUIRED_STAT_CAPACITY;
      remainingStatCapacity: number;
      explanation: string;
    };

export function assessOptimizationReadiness(
  profile: CharacterProfile,
  pointsPerLevel: number,
): OptimizationReadiness {
  const investedPoints = Object.values(profile.stats).reduce(
    (total, value) => total + value,
    0,
  );
  const availablePoints = profile.level * pointsPerLevel;
  const remainingStatCapacity = Object.values(profile.stats).reduce(
    (total, value) => total + (STAT_CAP - value),
    0,
  );

  if (investedPoints > availablePoints) {
    const excessPoints = investedPoints - availablePoints;
    return {
      status: 'overspent',
      excessPoints,
      remainingStatCapacity,
      explanation: `Invested stats exceed the available point budget by ${excessPoints}.`,
    };
  }

  if (remainingStatCapacity < REQUIRED_STAT_CAPACITY) {
    return {
      status: 'insufficient-stat-capacity',
      requiredStatCapacity: REQUIRED_STAT_CAPACITY,
      remainingStatCapacity,
      explanation: `The next ten levels require 30 open stat slots, but only ${remainingStatCapacity} remain.`,
    };
  }

  return { status: 'ready', remainingStatCapacity };
}
