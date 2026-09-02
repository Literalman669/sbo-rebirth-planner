import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProgressEventOutcome,
  ProgressHistoryEvent,
  ProgressTaskCategory,
} from '../../domain/progress/model';

type HistoryResultFilter = 'all' | ProgressEventOutcome;
type HistoryCategoryFilter = 'all' | ProgressTaskCategory;

const categoryLabels: Record<ProgressTaskCategory, string> = {
  'stat-allocation': 'Stat allocation',
  'equipment-upgrade': 'Equipment upgrades',
  'level-milestone': 'Level milestones',
  'floor-milestone': 'Floor milestones',
  'manual-objective': 'Manual objectives',
};

function historyGroup(event: ProgressHistoryEvent) {
  return event.occurredAt?.slice(0, 10) || 'Before progress history';
}

export function JourneyHistory({
  events,
  onReopen,
  onReset,
}: {
  events: readonly ProgressHistoryEvent[];
  onReopen(actionKey: string): void;
  onReset(): void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resultFilter, setResultFilter] = useState<HistoryResultFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<HistoryCategoryFilter>('all');
  const [resetOpen, setResetOpen] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelResetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (resetOpen) cancelResetRef.current?.focus();
  }, [resetOpen]);
  const groups = useMemo(() => {
    const grouped = new Map<string, ProgressHistoryEvent[]>();
    for (const event of [...events].reverse()) {
      if (resultFilter !== 'all' && event.outcome !== resultFilter) continue;
      if (categoryFilter !== 'all' && event.category !== categoryFilter) continue;
      const key = historyGroup(event);
      const group = grouped.get(key) ?? [];
      group.push(event);
      grouped.set(key, group);
    }
    return [...grouped.entries()];
  }, [categoryFilter, events, resultFilter]);
  return (
    <section className="progress-card progress-history" aria-label="Journey history">
      <h3>Journey history</h3>
      <div className="progress-history__actions">
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Hide journey history' : 'Show journey history'}
        </button>
        <button
          ref={resetTriggerRef}
          type="button"
          className="danger-button"
          onClick={() => setResetOpen(true)}
        >
          Reset progress
        </button>
      </div>
      {expanded ? (
        <>
          <div className="progress-history__filters">
            <label>
              History result
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.currentTarget.value as HistoryResultFilter)}
              >
                <option value="all">All results</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
                <option value="reopened">Reopened</option>
                <option value="superseded">Superseded</option>
              </select>
            </label>
            <label>
              History category
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.currentTarget.value as HistoryCategoryFilter)}
              >
                <option value="all">All categories</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          {groups.length > 0 ? groups.map(([group, groupEvents]) => (
            <div className="progress-history__group" key={group}>
              <h4>{group}</h4>
              <ol>
                {groupEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{event.label} {event.outcome}</strong>
                    <span>{event.occurredAt ?? 'Time not recorded'}</span>
                    <small>{categoryLabels[event.category]} · {event.source}</small>
                    {event.note ? <p>{event.note}</p> : null}
                    {event.outcome === 'completed' || event.outcome === 'skipped' ? (
                      <button type="button" onClick={() => onReopen(event.actionKey)}>
                        Reopen {event.label}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )) : <p>No journey history matches these filters.</p>}
        </>
      ) : null}
      {resetOpen ? (
        <div className="confirmation-dialog-backdrop" role="presentation">
          <div
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-progress-heading"
            aria-describedby="reset-progress-description"
          >
            <h4 id="reset-progress-heading">Reset progress?</h4>
            <p id="reset-progress-description">
              This permanently clears the wallet, notes, manual choices, and journey history for this build. The planner will detect current build facts again.
            </p>
            <div className="dialog-actions">
              <button
                ref={cancelResetRef}
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  queueMicrotask(() => resetTriggerRef.current?.focus());
                }}
              >
                Cancel reset
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  setResetOpen(false);
                  void onReset();
                }}
              >
                Reset permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
