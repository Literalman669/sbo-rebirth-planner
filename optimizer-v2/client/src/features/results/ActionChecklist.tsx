import type { PlanAction } from '../../domain/results/actionChecklist';
import { sumVerifiedCosts } from '../../domain/results/actionChecklist';

const groupLabels: Record<PlanAction['group'], string> = {
  'do-now': 'Do now',
  'next-level': 'Next levels',
  'next-floor': 'Next floors',
  later: 'Later',
};

export function ActionChecklist({
  actions,
  completedActionIds,
  onToggle,
  onDismiss,
  onUndo,
  canUndo,
}: {
  actions: readonly PlanAction[];
  completedActionIds: ReadonlySet<string>;
  onToggle(actionId: string): void;
  onDismiss(actionId: string): void;
  onUndo(): void;
  canUndo: boolean;
}) {
  const costs = sumVerifiedCosts(actions);
  return (
    <section className="result-band action-checklist" aria-labelledby="action-checklist-heading">
      <div className="result-band-heading">
        <h3 id="action-checklist-heading">Action checklist</h3>
        {canUndo ? <button type="button" onClick={onUndo}>Undo checklist change</button> : null}
      </div>
      <div className="verified-cost-summary">
        {Object.entries(costs.totals).map(([currency, amount]) => (
          <strong key={currency}>{amount.toLocaleString('en-US')} {currency} verified</strong>
        ))}
        {costs.unknownPriceActions > 0 ? (
          <span>{costs.unknownPriceActions} action{costs.unknownPriceActions === 1 ? '' : 's'} with unknown price</span>
        ) : null}
      </div>
      {(['do-now', 'next-level', 'next-floor', 'later'] as const).map((group) => {
        const grouped = actions.filter((action) => action.group === group);
        if (grouped.length === 0) return null;
        return (
          <section key={group} aria-label={groupLabels[group]}>
            <h4>{groupLabels[group]}</h4>
            <ul>
              {grouped.map((action) => (
                <li key={action.id} className={completedActionIds.has(action.id) ? 'completed' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={completedActionIds.has(action.id)}
                      aria-label={`Complete ${action.title}`}
                      onChange={() => onToggle(action.id)}
                    />
                    <span><strong>{action.title}</strong><small>{action.detail}</small></span>
                  </label>
                  {action.sourceUrl ? <a href={action.sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
                  {action.itemId ? <button type="button" onClick={() => onDismiss(action.id)}>Dismiss</button> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
