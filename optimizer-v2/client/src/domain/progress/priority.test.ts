import { describe, expect, it } from 'vitest';
import type { ProgressTask } from './tasks';
import { selectNextProgressTask } from './priority';

function task(
  actionKey: string,
  kind: ProgressTask['kind'],
  group: ProgressTask['group'],
  withPrice = false,
): ProgressTask {
  return {
    id: actionKey,
    actionKey,
    kind,
    group,
    category: kind === 'spend-stats' ? 'stat-allocation' : 'equipment-upgrade',
    planFingerprint: 'plan-1',
    automatic: kind === 'spend-stats' || kind === 'equip',
    title: actionKey,
    detail: actionKey,
    ...(withPrice ? { verifiedCost: { amount: 1_000, currency: 'Col' } } : {}),
  };
}

describe('next progress move', () => {
  it('uses explicit category priority without reordering equal choices', () => {
    const laterManual = task('manual', 'unlock', 'later');
    const futureStats = task('future-stats', 'spend-stats', 'next-level');
    const secondPurchase = task('purchase-2', 'buy', 'later', true);
    const firstPurchase = task('purchase-1', 'buy', 'do-now', true);
    const ownedEquip = task('equip', 'equip', 'do-now');
    const currentStats = task('current-stats', 'spend-stats', 'do-now');

    expect(
      selectNextProgressTask([
        laterManual,
        futureStats,
        secondPurchase,
        firstPurchase,
        ownedEquip,
        currentStats,
      ]),
    ).toBe(currentStats);
    expect(
      selectNextProgressTask([
        laterManual,
        futureStats,
        secondPurchase,
        firstPurchase,
      ]),
    ).toBe(firstPurchase);
    expect(selectNextProgressTask([laterManual, futureStats])).toBe(futureStats);
    expect(selectNextProgressTask([])).toBeNull();
  });
});
