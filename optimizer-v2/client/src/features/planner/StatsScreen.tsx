import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftProvider';
import type { StatName } from '../../domain/build/model';
import { expectedInvestedPoints } from './completeness';

const stats: Array<{ key: StatName; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'def', label: 'DEF' },
  { key: 'agi', label: 'AGI' },
  { key: 'vit', label: 'VIT' },
  { key: 'luk', label: 'LUK' },
];

export function StatsScreen() {
  const navigate = useNavigate();
  const { draft, isHydrated, updateDraft } = useBuildDraft();
  if (!isHydrated) return <p>Loading draft</p>;

  const entered = Object.values(draft.stats).reduce(
    (total, value) => total + value,
    0,
  );
  const expected = expectedInvestedPoints(draft.level);

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>Stats</h2>
      <div className="stat-fields">
        {stats.map((stat) => (
          <label key={stat.key}>
            {stat.label}
            <input
              type="number"
              min="0"
              max="500"
              value={draft.stats[stat.key]}
              onChange={(event) =>
                updateDraft({
                  stats: {
                    ...draft.stats,
                    [stat.key]: Number(event.currentTarget.value),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <p aria-live="polite">
        Expected {expected} · Entered {entered} · Difference {expected - entered}
      </p>
      <div className="screen-actions">
        <button type="button" onClick={() => navigate('/character')}>
          Back
        </button>
        <button type="button" onClick={() => navigate('/equipment')}>
          Continue
        </button>
      </div>
    </section>
  );
}
