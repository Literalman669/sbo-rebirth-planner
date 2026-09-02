import { useEffect, useState } from 'react';
import type { ShoppingPlan as ShoppingPlanModel } from '../../domain/progress/shopping';

export function ShoppingPlan({
  plan,
  balance,
  onSaveBalance,
}: {
  plan: ShoppingPlanModel;
  balance?: number;
  onSaveBalance(balance: number | undefined): void;
}) {
  const [value, setValue] = useState(balance?.toString() ?? '');
  useEffect(() => setValue(balance?.toString() ?? ''), [balance]);
  const affordability =
    plan.affordability === 'affordable'
      ? 'Affordable now'
      : plan.affordability === 'needs-more'
        ? `Need ${plan.remainingNeeded?.toLocaleString() ?? 0} more Col`
        : plan.affordability === 'unsupported'
          ? 'Mixed currencies cannot be totaled'
          : 'Add current Col to calculate affordability';
  return (
    <section className="progress-card progress-shopping" aria-label="Shopping plan">
      <h3>Shopping plan</h3>
      <div className="progress-wallet">
        <label>
          Current Col
          <input
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const normalized = value.trim();
            onSaveBalance(normalized ? Number(normalized) : undefined);
          }}
        >
          Save Col balance
        </button>
      </div>
      <strong>{affordability}</strong>
      <p>
        Known total {plan.knownTotal.toLocaleString()} {plan.currency ?? 'Col'}
        {plan.unknownPriceCount > 0
          ? ` · ${plan.unknownPriceCount} price${plan.unknownPriceCount === 1 ? '' : 's'} not verified`
          : ''}
      </p>
      <ul>
        {plan.entries.map(({ task }) => (
          <li key={task.actionKey}>
            <span>{task.title}</span>
            <strong>
              {task.verifiedCost
                ? `${task.verifiedCost.amount.toLocaleString()} ${task.verifiedCost.currency}`
                : 'Price not verified'}
            </strong>
            {task.sourceUrl ? <a href={task.sourceUrl}>Source</a> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
