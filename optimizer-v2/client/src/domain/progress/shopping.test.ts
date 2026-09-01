import { describe, expect, it } from 'vitest';
import type { ProgressTask } from './tasks';
import { buildShoppingPlan } from './shopping';

const baseTask: ProgressTask = {
  id: 'equipment:armor:fields-warrior',
  actionKey: 'equipment:armor:fields-warrior',
  group: 'do-now',
  kind: 'buy',
  category: 'equipment-upgrade',
  planFingerprint: 'plan-1',
  automatic: false,
  title: 'Buy Fields Warrior',
  detail: 'Floor 1 Shop',
  itemId: 'fields-warrior',
};

describe('progress shopping plan', () => {
  it('separates verified totals from unknown prices and calculates remaining Col', () => {
    const result = buildShoppingPlan(
      [
        {
          ...baseTask,
          verifiedCost: { amount: 9_120, currency: 'Col' },
        },
        {
          ...baseTask,
          id: 'equipment:upper-head:bucket-helmet',
          actionKey: 'equipment:upper-head:bucket-helmet',
          itemId: 'bucket-helmet',
          verifiedCost: { amount: 5_720, currency: 'Col' },
        },
        {
          ...baseTask,
          id: 'equipment:lower-head:unknown',
          actionKey: 'equipment:lower-head:unknown',
          itemId: 'unknown',
        },
      ],
      { balance: 10_000, updatedAt: '2026-09-01T12:00:00.000Z' },
    );

    expect(result).toMatchObject({
      currency: 'Col',
      knownTotal: 14_840,
      unknownPriceCount: 1,
      affordability: 'needs-more',
      remainingNeeded: 4_840,
    });
    expect(result.entries.map((entry) => entry.task.itemId)).toEqual([
      'fields-warrior',
      'bucket-helmet',
      'unknown',
    ]);
  });

  it('keeps affordability unknown without a wallet and marks exact totals affordable', () => {
    const task = {
      ...baseTask,
      verifiedCost: { amount: 2_000, currency: 'Col' },
    };

    expect(buildShoppingPlan([task])).toMatchObject({
      knownTotal: 2_000,
      affordability: 'unknown',
      remainingNeeded: undefined,
    });
    expect(
      buildShoppingPlan([task], {
        balance: 2_000,
        updatedAt: '2026-09-01T12:00:00.000Z',
      }),
    ).toMatchObject({ affordability: 'affordable', remainingNeeded: 0 });
  });

  it('does not sum mixed currencies or overflow safe integer arithmetic', () => {
    const col = {
      ...baseTask,
      verifiedCost: { amount: 2_000, currency: 'Col' },
    };
    const other = {
      ...baseTask,
      id: 'equipment:armor:other',
      actionKey: 'equipment:armor:other',
      itemId: 'other',
      verifiedCost: { amount: 5, currency: 'Token' },
    };

    expect(buildShoppingPlan([col, other])).toMatchObject({
      currency: undefined,
      knownTotal: 0,
      affordability: 'unsupported',
    });
    expect(() =>
      buildShoppingPlan([
        { ...col, verifiedCost: { amount: Number.MAX_SAFE_INTEGER, currency: 'Col' } },
        { ...other, verifiedCost: { amount: 1, currency: 'Col' } },
      ]),
    ).toThrow('Verified shopping total exceeds the safe integer limit');
  });
});
