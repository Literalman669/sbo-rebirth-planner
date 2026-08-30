import type {
  CharacterProfile,
  StatBlock,
  StatName,
} from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import { allocateStatPlan } from './allocateStats';
import { compileMechanics } from './mechanics';
import { projectMetrics, type GearTotals, type ProjectedMetrics } from './projections';

const STAT_CAP = 500;
const STAT_NAMES: StatName[] = ['str', 'def', 'agi', 'vit', 'luk'];

function total(stats: StatBlock) {
  return STAT_NAMES.reduce((sum, stat) => sum + stats[stat], 0);
}

function gearTotals(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): GearTotals {
  const equippedIds = new Set(Object.values(profile.equipped));
  return dataset.equipment.reduce(
    (sum, item) => {
      if (equippedIds.has(item.id)) {
        sum.attack += item.attack;
        sum.defense += item.defense;
        sum.dexterity += item.dexterity;
      }
      return sum;
    },
    { attack: 0, defense: 0, dexterity: 0 },
  );
}

export function adjustStat(
  profile: CharacterProfile,
  stat: StatName,
  delta: number,
  pointsPerLevel: number,
): StatBlock {
  const next = { ...profile.stats };
  if (!Number.isInteger(delta)) return next;
  if (delta <= 0) {
    next[stat] = Math.max(0, next[stat] + delta);
    return next;
  }
  const unspent = Math.max(profile.level * pointsPerLevel - total(next), 0);
  next[stat] = Math.min(STAT_CAP, next[stat] + Math.min(delta, unspent));
  return next;
}

export function resetStats(): StatBlock {
  return { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
}

export function maxAvailableForStat(
  profile: CharacterProfile,
  stat: StatName,
  pointsPerLevel: number,
) {
  const unspent = Math.max(
    profile.level * pointsPerLevel - total(profile.stats),
    0,
  );
  return Math.min(STAT_CAP, profile.stats[stat] + unspent);
}

export function recommendUnspentAllocation(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
  lockedStats: ReadonlySet<StatName> = new Set(),
): StatBlock {
  const unspent = Math.max(
    profile.level * dataset.pointsPerLevel - total(profile.stats),
    0,
  );
  if (unspent === 0) return { ...profile.stats };
  const plan = allocateStatPlan({
    level: profile.level,
    stats: profile.stats,
    gear: gearTotals(profile, dataset),
    goal: profile.goal,
    mechanics: compileMechanics(dataset),
    unspentPoints: unspent,
    lockedStats,
  });
  return { ...plan.spendNow.totals };
}

export function previewStatChange(
  profile: CharacterProfile,
  nextStats: StatBlock,
  dataset: DatasetSnapshot,
): {
  before: ProjectedMetrics;
  after: ProjectedMetrics;
  deltas: Record<keyof ProjectedMetrics, number | null>;
} {
  const mechanics = compileMechanics(dataset);
  const gear = gearTotals(profile, dataset);
  const before = projectMetrics(
    { level: profile.level, stats: profile.stats, gear },
    mechanics,
  );
  const after = projectMetrics(
    { level: profile.level, stats: nextStats, gear },
    mechanics,
  );
  const deltas = Object.fromEntries(
    (Object.keys(before) as Array<keyof ProjectedMetrics>).map((metric) => [
      metric,
      before[metric] === null || after[metric] === null
        ? null
        : after[metric] - before[metric],
    ]),
  ) as Record<keyof ProjectedMetrics, number | null>;
  return { before, after, deltas };
}
