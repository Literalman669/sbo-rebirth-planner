import type { RecommendationPlan } from '../optimizer/optimizeBuild';
import { canonicalJson } from './canonical';

export interface ShoppingImpact {
  beforeKnownTotal: number;
  afterKnownTotal: number;
  beforeUnknownCount: number;
  afterUnknownCount: number;
  currency?: string;
}

export interface PlanFieldChange {
  id: string;
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export type PlanEndpointResult =
  | { status: 'ready'; plan: RecommendationPlan }
  | { status: 'blocked'; explanation: string };

export type RecommendationPlanImpact =
  | {
      status: 'unchanged';
      changes: [];
      changedLevelRows: number[];
      shopping: ShoppingImpact;
    }
  | {
      status: 'changed';
      changes: PlanFieldChange[];
      changedLevelRows: number[];
      shopping: ShoppingImpact;
    }
  | {
      status: 'blocked';
      pinnedReason?: string;
      targetReason?: string;
    };

function shopping(plan: RecommendationPlan) {
  const priced = plan.upgradeTargets.filter(
    (target) => target.verifiedCost !== undefined,
  );
  const currencies = new Set(
    priced.map((target) => target.verifiedCost!.currency),
  );
  const knownTotal = currencies.size > 1
    ? 0
    : priced.reduce((total, target) => total + target.verifiedCost!.amount, 0);
  return {
    knownTotal,
    unknownCount: plan.upgradeTargets.length - priced.length,
    currency:
      currencies.size === 1
        ? (currencies.values().next().value as string)
        : undefined,
  };
}

function comparable(value: unknown): string {
  return canonicalJson(value);
}

function addChange(
  changes: PlanFieldChange[],
  field: string,
  before: unknown,
  after: unknown,
) {
  const beforeValue = comparable(before);
  const afterValue = comparable(after);
  if (beforeValue === afterValue) return;
  changes.push({
    id: `plan:${field}`,
    field,
    before: beforeValue,
    after: afterValue,
  });
}

export function diffRecommendationPlans(
  pinned: PlanEndpointResult,
  target: PlanEndpointResult,
): RecommendationPlanImpact {
  if (pinned.status === 'blocked' || target.status === 'blocked') {
    return {
      status: 'blocked',
      ...(pinned.status === 'blocked'
        ? { pinnedReason: pinned.explanation }
        : {}),
      ...(target.status === 'blocked'
        ? { targetReason: target.explanation }
        : {}),
    };
  }

  const changes: PlanFieldChange[] = [];
  addChange(
    changes,
    'immediateAction',
    pinned.plan.immediateAction,
    target.plan.immediateAction,
  );
  addChange(
    changes,
    'spendNow',
    pinned.plan.statPlan.spendNow,
    target.plan.statPlan.spendNow,
  );
  const pinnedRows = new Map(
    pinned.plan.statPlan.levelRows.map((row) => [row.level, row]),
  );
  const targetRows = new Map(
    target.plan.statPlan.levelRows.map((row) => [row.level, row]),
  );
  const changedLevelRows: number[] = [];
  for (const level of [...new Set([...pinnedRows.keys(), ...targetRows.keys()])]
    .sort((left, right) => left - right)) {
    const before = pinnedRows.get(level) ?? null;
    const after = targetRows.get(level) ?? null;
    if (comparable(before) === comparable(after)) continue;
    changedLevelRows.push(level);
    addChange(changes, `levelRows.${level}`, before, after);
  }
  addChange(
    changes,
    'upgradeTargets',
    pinned.plan.upgradeTargets,
    target.plan.upgradeTargets,
  );
  addChange(changes, 'warnings', pinned.plan.warnings, target.plan.warnings);

  const beforeShopping = shopping(pinned.plan);
  const afterShopping = shopping(target.plan);
  const shoppingImpact: ShoppingImpact = {
    beforeKnownTotal: beforeShopping.knownTotal,
    afterKnownTotal: afterShopping.knownTotal,
    beforeUnknownCount: beforeShopping.unknownCount,
    afterUnknownCount: afterShopping.unknownCount,
    ...(afterShopping.currency ?? beforeShopping.currency
      ? { currency: afterShopping.currency ?? beforeShopping.currency }
      : {}),
  };
  addChange(changes, 'shopping', beforeShopping, afterShopping);

  return changes.length === 0
    ? {
        status: 'unchanged',
        changes: [],
        changedLevelRows,
        shopping: shoppingImpact,
      }
    : {
        status: 'changed',
        changes,
        changedLevelRows,
        shopping: shoppingImpact,
      };
}
