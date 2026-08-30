import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import type { StatBlock, StatName } from '../../domain/build/model';
import { analyzeStatBudget } from './completeness';

const stats: Array<{ key: StatName; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'def', label: 'DEF' },
  { key: 'agi', label: 'AGI' },
  { key: 'vit', label: 'VIT' },
  { key: 'luk', label: 'LUK' },
];

const pointsPerLevel = 3;

export function StatsScreen() {
  const navigate = useNavigate();
  const { draft, isHydrated, updateDraft } = useBuildDraft();
  const [values, setValues] = useState<Record<StatName, string>>(() => ({
    str: String(draft.stats.str),
    def: String(draft.stats.def),
    agi: String(draft.stats.agi),
    vit: String(draft.stats.vit),
    luk: String(draft.stats.luk),
  }));
  const [errors, setErrors] = useState<Partial<Record<StatName, string>>>({});
  const [budgetError, setBudgetError] = useState<string>();
  const controls = useRef<Partial<Record<StatName, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (isHydrated) {
      setValues({
        str: String(draft.stats.str),
        def: String(draft.stats.def),
        agi: String(draft.stats.agi),
        vit: String(draft.stats.vit),
        luk: String(draft.stats.luk),
      });
    }
  }, [isHydrated]);

  if (!isHydrated) return <p>Loading draft</p>;

  const budget = analyzeStatBudget(draft, pointsPerLevel);

  const updateStat = (key: StatName, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setBudgetError(undefined);
    const numberValue = Number(value);
    if (Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 500) {
      updateDraft({
        stats: {
          ...draft.stats,
          [key]: numberValue,
        },
      });
    }
  };

  const continueToEquipment = () => {
    const invalidStat = stats.find(({ key }) => {
      const value = Number(values[key]);
      return !Number.isInteger(value) || value < 0 || value > 500;
    });
    if (invalidStat) {
      setErrors({
        [invalidStat.key]: `${invalidStat.label} must be a whole number from 0 to 500.`,
      });
      controls.current[invalidStat.key]?.focus();
      return;
    }

    const enteredStats = Object.fromEntries(
      stats.map(({ key }) => [key, Number(values[key])]),
    ) as StatBlock;
    const enteredBudget = analyzeStatBudget(
      { ...draft, stats: enteredStats },
      pointsPerLevel,
    );
    if (enteredBudget.status === 'overspent') {
      setBudgetError(
        `Invested stats exceed the available point budget by ${Math.abs(enteredBudget.difference)}.`,
      );
      controls.current.str?.focus();
      return;
    }

    navigate('/equipment');
  };

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>Stats</h2>
      <div className="stat-fields">
        {stats.map((stat) => (
          <label key={stat.key}>
            {stat.label}
            <input
              ref={(element) => {
                controls.current[stat.key] = element;
              }}
              type="number"
              min="0"
              max="500"
              value={values[stat.key]}
              aria-invalid={Boolean(errors[stat.key])}
              onChange={(event) => updateStat(stat.key, event.currentTarget.value)}
            />
            {errors[stat.key] ? <span role="alert">{errors[stat.key]}</span> : null}
          </label>
        ))}
      </div>
      <p aria-live="polite">
        Expected {budget.expected} · Entered {budget.invested} · Difference {budget.difference}
      </p>
      {budget.status === 'unaccounted' ? (
        <p role="status" aria-live="polite">
          The optimizer sees {budget.difference} points not represented in invested stats and will treat plan precision as reduced.
        </p>
      ) : null}
      {budgetError ? <p role="alert">{budgetError}</p> : null}
      <div className="screen-actions">
        <button type="button" onClick={() => navigate('/character')}>
          Back
        </button>
        <button type="button" onClick={continueToEquipment}>
          Continue
        </button>
      </div>
    </section>
  );
}
