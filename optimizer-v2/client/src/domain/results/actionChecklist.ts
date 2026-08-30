import type { CharacterProfile, EquipmentSlot } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import {
  rankEquipmentUpgradeCandidates,
  type RankedEquipmentUpgradeCandidate,
  type UpgradeTarget,
} from '../optimizer/recommendEquipment';

export interface PlanAction {
  id: string;
  group: 'do-now' | 'next-level' | 'next-floor' | 'later';
  kind: 'spend-stats' | 'equip' | 'buy' | 'farm' | 'unlock';
  title: string;
  detail: string;
  itemId?: string;
  level?: number;
  verifiedCost?: { amount: number; currency: string };
  sourceUrl?: string;
}

function equipmentAction(
  profile: CharacterProfile,
  target: UpgradeTarget | RankedEquipmentUpgradeCandidate,
  names: ReadonlyMap<string, string>,
): PlanAction {
  const owned = profile.ownedItemIds.includes(target.itemId);
  const drop = /drop|boss|mob|farm/i.test(target.acquisitionDetail);
  const kind: PlanAction['kind'] = owned
    ? 'equip'
    : target.verifiedCost
      ? 'buy'
      : drop
        ? 'farm'
        : target.immediate
          ? 'unlock'
          : 'unlock';
  const group: PlanAction['group'] = target.immediate
    ? 'do-now'
    : /Requires Floor/i.test(target.eligibilityNote ?? '')
      ? 'next-floor'
      : 'later';
  const verb =
    kind === 'equip'
      ? 'Equip'
      : kind === 'buy'
        ? 'Buy'
        : kind === 'farm'
          ? 'Farm'
          : 'Unlock';
  return {
    id: `equipment:${target.slot}:${target.itemId}`,
    group,
    kind,
    title: `${verb} ${names.get(target.itemId) ?? target.itemId}`,
    detail: [
      target.requirementText,
      target.eligibilityNote,
      target.acquisitionDetail,
    ]
      .filter(Boolean)
      .join(' · '),
    itemId: target.itemId,
    ...(target.verifiedCost ? { verifiedCost: target.verifiedCost } : {}),
    sourceUrl: target.sourceUrl,
  };
}

export function buildActionChecklist(
  profile: CharacterProfile,
  plan: RecommendationPlan,
  names: ReadonlyMap<string, string>,
): PlanAction[] {
  const actions: PlanAction[] = [];
  const immediateItemId =
    plan.immediateAction.kind === 'keep-current'
      ? undefined
      : plan.immediateAction.itemId;
  const immediateTarget = immediateItemId
    ? plan.upgradeTargets.find((target) => target.itemId === immediateItemId)
    : undefined;
  if (immediateTarget) actions.push(equipmentAction(profile, immediateTarget, names));
  if (plan.statPlan.spendNow.points > 0) {
    actions.push({
      id: `spend-stats:level:${profile.level}`,
      group: 'do-now',
      kind: 'spend-stats',
      title: `Spend ${plan.statPlan.spendNow.points} current stat points`,
      detail: Object.entries(plan.statPlan.spendNow.added)
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${stat.toUpperCase()} +${value}`)
        .join(' · '),
      level: profile.level,
    });
  }
  for (const row of plan.statPlan.levelRows) {
    actions.push({
      id: `spend-stats:level:${row.level}`,
      group: 'next-level',
      kind: 'spend-stats',
      title: `Allocate Level ${row.level} points`,
      detail: Object.entries(row.added)
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${stat.toUpperCase()} +${value}`)
        .join(' · '),
      level: row.level,
    });
  }
  for (const target of plan.upgradeTargets) {
    if (target === immediateTarget) continue;
    actions.push(equipmentAction(profile, target, names));
  }
  return actions;
}

export function replaceDismissedRecommendations(
  actions: readonly PlanAction[],
  dismissedActionIds: ReadonlySet<string>,
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): PlanAction[] {
  const retained = actions.filter((action) => !dismissedActionIds.has(action.id));
  const removedEquipmentCount = actions.filter(
    (action) =>
      dismissedActionIds.has(action.id) && action.id.startsWith('equipment:'),
  ).length;
  if (removedEquipmentCount === 0) return retained;
  const existingIds = new Set(retained.map((action) => action.id));
  const names = new Map(dataset.catalog.map((item) => [item.id, item.name]));
  for (const candidate of rankEquipmentUpgradeCandidates(profile, dataset)) {
    const replacement = equipmentAction(profile, candidate, names);
    if (existingIds.has(replacement.id) || dismissedActionIds.has(replacement.id)) {
      continue;
    }
    retained.push({ ...replacement, group: 'later' });
    existingIds.add(replacement.id);
    if (
      retained.filter(
        (action) =>
          action.id.startsWith('equipment:') && !actions.includes(action),
      ).length >= removedEquipmentCount
    ) {
      break;
    }
  }
  return retained;
}

export function sumVerifiedCosts(actions: readonly PlanAction[]) {
  const totals: Record<string, number> = {};
  let unknownPriceActions = 0;
  for (const action of actions) {
    if (!action.itemId || action.kind === 'equip') continue;
    if (!action.verifiedCost) {
      unknownPriceActions += 1;
      continue;
    }
    totals[action.verifiedCost.currency] =
      (totals[action.verifiedCost.currency] ?? 0) +
      action.verifiedCost.amount;
  }
  return { totals, unknownPriceActions };
}

export function reconcileProfileToLevel(
  profile: CharacterProfile,
  plan: RecommendationPlan,
  targetLevel: number,
): CharacterProfile {
  if (targetLevel <= profile.level) {
    throw new Error('Target level must be above the current level');
  }
  const row = plan.statPlan.levelRows.find(
    (candidate) => candidate.level === targetLevel,
  );
  if (!row) throw new Error('Target level is outside this plan');
  return { ...profile, level: targetLevel, stats: { ...row.totals } };
}

export function slotFromAction(action: PlanAction): EquipmentSlot | null {
  if (!action.id.startsWith('equipment:')) return null;
  return action.id.split(':')[1] as EquipmentSlot;
}
