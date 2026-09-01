import type {
  CharacterProfile,
  EquipmentSlot,
  StatBlock,
} from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import {
  buildActionChecklist,
  slotFromAction,
  type PlanAction,
} from '../results/actionChecklist';
import type { ProgressTaskCategory } from './model';

export interface ProgressTask extends PlanAction {
  actionKey: string;
  category: ProgressTaskCategory;
  planFingerprint: string;
  automatic: boolean;
  slot?: EquipmentSlot;
  targetLevel?: number;
  targetFloor?: number;
  targetStats?: StatBlock;
}

export function progressTaskFromPlanAction(
  action: PlanAction,
  planFingerprint: string,
): ProgressTask {
  const slot = slotFromAction(action);
  return {
    ...structuredClone(action),
    actionKey: action.id,
    category:
      action.kind === 'spend-stats'
        ? 'stat-allocation'
        : action.itemId
          ? 'equipment-upgrade'
          : 'manual-objective',
    planFingerprint,
    automatic: action.kind === 'spend-stats' || action.kind === 'equip',
    ...(slot ? { slot } : {}),
    ...(action.level === undefined ? {} : { targetLevel: action.level }),
  };
}

export function generateProgressTasks(
  profile: CharacterProfile,
  plan: RecommendationPlan,
  dataset: DatasetSnapshot,
  planFingerprint: string,
): ProgressTask[] {
  const names = new Map(dataset.catalog.map((item) => [item.id, item.name]));
  const actions = buildActionChecklist(profile, plan, names);
  const tasks = actions.map((action) =>
    progressTaskFromPlanAction(action, planFingerprint),
  );
  const targetFloor = profile.maxFloor + 1;
  tasks.push({
    id: `floor:unlock:${targetFloor}`,
    actionKey: `floor:unlock:${targetFloor}`,
    group: 'next-floor',
    kind: 'unlock',
    category: 'floor-milestone',
    planFingerprint,
    automatic: false,
    title: `Unlock Floor ${targetFloor}`,
    detail: 'Confirm the floor clear in Character after it is unlocked.',
    targetFloor,
  });
  return tasks;
}

export function isProgressTaskAutomaticallyComplete(
  task: ProgressTask,
  profile: CharacterProfile,
) {
  if (task.targetFloor !== undefined && profile.maxFloor >= task.targetFloor) {
    return true;
  }
  if (task.targetStats) {
    return Object.entries(task.targetStats).every(
      ([stat, target]) => profile.stats[stat as keyof StatBlock] >= target,
    );
  }
  if (task.kind === 'equip' && task.itemId && task.slot) {
    return profile.equipped[task.slot] === task.itemId;
  }
  if (task.itemId && task.kind !== 'equip') {
    return profile.ownedItemIds.includes(task.itemId);
  }
  if (task.targetLevel !== undefined) return profile.level >= task.targetLevel;
  return false;
}
