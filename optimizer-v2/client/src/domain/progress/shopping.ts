import type { ProgressWallet } from './model';
import type { ProgressTask } from './tasks';

export interface ShoppingPlanEntry {
  task: ProgressTask;
}

export interface ShoppingPlan {
  entries: ShoppingPlanEntry[];
  currency?: string;
  knownTotal: number;
  unknownPriceCount: number;
  affordability: 'unknown' | 'affordable' | 'needs-more' | 'unsupported';
  remainingNeeded?: number;
}

export function buildShoppingPlan(
  tasks: readonly ProgressTask[],
  wallet?: ProgressWallet,
): ShoppingPlan {
  const shoppingTasks = tasks.filter(
    (task) => task.itemId !== undefined && task.kind !== 'equip',
  );
  const priced = shoppingTasks.filter((task) => task.verifiedCost !== undefined);
  const currencies = new Set(
    priced.map((task) => task.verifiedCost!.currency),
  );
  if (currencies.size > 1) {
    return {
      entries: shoppingTasks.map((task) => ({ task })),
      currency: undefined,
      knownTotal: 0,
      unknownPriceCount: shoppingTasks.length - priced.length,
      affordability: 'unsupported',
    };
  }

  let knownTotal = 0;
  for (const task of priced) {
    const amount = task.verifiedCost!.amount;
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error('Verified shopping price is not a safe integer');
    }
    const next = knownTotal + amount;
    if (!Number.isSafeInteger(next)) {
      throw new Error('Verified shopping total exceeds the safe integer limit');
    }
    knownTotal = next;
  }

  const currency = currencies.values().next().value as string | undefined;
  const unknownPriceCount = shoppingTasks.length - priced.length;
  if (!wallet) {
    return {
      entries: shoppingTasks.map((task) => ({ task })),
      ...(currency ? { currency } : {}),
      knownTotal,
      unknownPriceCount,
      affordability: 'unknown',
      remainingNeeded: undefined,
    };
  }
  const remainingNeeded = Math.max(knownTotal - wallet.balance, 0);
  return {
    entries: shoppingTasks.map((task) => ({ task })),
    ...(currency ? { currency } : {}),
    knownTotal,
    unknownPriceCount,
    affordability: remainingNeeded === 0 ? 'affordable' : 'needs-more',
    remainingNeeded,
  };
}
