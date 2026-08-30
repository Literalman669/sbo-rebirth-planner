import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import type { StatBlock, StatName } from '../../domain/build/model';
import { assessOptimizationReadiness } from '../../domain/optimizer/planReadiness';
import { analyzeStatBudget } from './completeness';

const stats: Array<{ key: StatName; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'def', label: 'DEF' },
  { key: 'agi', label: 'AGI' },
  { key: 'vit', label: 'VIT' },
  { key: 'luk', label: 'LUK' },
];

function isValidStatValue(value: string) {
  const numberValue = Number(value);
  return (
    value.trim() !== '' &&
    Number.isInteger(numberValue) &&
    numberValue >= 0 &&
    numberValue <= 500
  );
}

export function StatsScreen() {
  const navigate = useNavigate();
  const { snapshot } = useDataset();
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

  const budget = analyzeStatBudget(draft, snapshot.pointsPerLevel);

  const updateStat = (key: StatName, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setBudgetError(undefined);
    const numberValue = Number(value);
    if (isValidStatValue(value)) {
      updateDraft({
        stats: {
          ...draft.stats,
          [key]: numberValue,
        },
      });
    }
  };

  const continueToEquipment = () => {
    const invalidStat = stats.find(({ key }) => !isValidStatValue(values[key]));
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
    const readiness = assessOptimizationReadiness(
      { ...draft, stats: enteredStats },
      snapshot.pointsPerLevel,
    );
    if (readiness.status !== 'ready') {
      setBudgetError(readiness.explanation);
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
        Available {budget.expected} · Invested {budget.invested} · Unspent {budget.difference}
      </p>
      {budget.status === 'unaccounted' ? (
        <p role="status" aria-live="polite">
          {budget.difference} points remain unspent. Results will tell you exactly where to put them.
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
