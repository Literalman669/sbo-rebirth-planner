import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import type { StatBlock, StatName } from '../../domain/build/model';
import { assessOptimizationReadiness } from '../../domain/optimizer/planReadiness';
import {
  adjustStat,
  maxAvailableForStat,
  previewStatChange,
  recommendUnspentAllocation,
  resetStats,
} from '../../domain/optimizer/statWorkspace';
import { analyzeStatBudget } from './completeness';
import { StatControl } from './StatControl';
import { StickyPlannerActions } from '../shell/StickyPlannerActions';

const stats: Array<{ key: StatName; label: string; description: string }> = [
  { key: 'str', label: 'STR', description: 'Raises verified attack and multi-hit metrics.' },
  { key: 'def', label: 'DEF', description: 'Raises verified damage reduction from equipped defense.' },
  { key: 'agi', label: 'AGI', description: 'Raises verified walk speed, sprint speed, and stamina.' },
  { key: 'vit', label: 'VIT', description: 'Raises verified bonus HP, stamina, and resistance metrics.' },
  { key: 'luk', label: 'LUK', description: 'Raises verified critical, drop, and multi-hit metrics.' },
];

const previewMetrics = [
  ['attackPerHit', 'Attack per hit'],
  ['damageReductionPerHit', 'Damage reduction'],
  ['bonusHp', 'Bonus HP'],
  ['stamina', 'Stamina'],
  ['walkSpeedBonus', 'Walk speed'],
  ['sprintSpeedBonus', 'Sprint speed'],
  ['critChanceBonus', 'Critical chance'],
  ['dropChanceBonus', 'Drop chance'],
] as const;

function isValidStatValue(value: string) {
  const numberValue = Number(value);
  return value.trim() !== '' && Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 500;
}

function stringsFromStats(block: StatBlock): Record<StatName, string> {
  return { str: String(block.str), def: String(block.def), agi: String(block.agi), vit: String(block.vit), luk: String(block.luk) };
}

function parsedStats(values: Record<StatName, string>, fallback: StatBlock): StatBlock {
  return stats.every(({ key }) => isValidStatValue(values[key]))
    ? (Object.fromEntries(stats.map(({ key }) => [key, Number(values[key])])) as StatBlock)
    : { ...fallback };
}

function formatMetricDelta(delta: number | null) {
  if (delta === null) return 'Not numerically verified';
  if (Math.abs(delta) < 0.000_001) return 'No verified change';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3).replace(/\.0+$/, '')}`;
}

export function StatsScreen() {
  const navigate = useNavigate();
  const { snapshot } = useDataset();
  const { draft, isHydrated, updateDraft, canUndo, undoLastChange } = useBuildDraft();
  const [values, setValues] = useState<Record<StatName, string>>(() => stringsFromStats(draft.stats));
  const [lockedStats, setLockedStats] = useState<Set<StatName>>(new Set());
  const [errors, setErrors] = useState<Partial<Record<StatName, string>>>({});
  const [budgetError, setBudgetError] = useState<string>();
  const baselineStats = useRef<StatBlock>({ ...draft.stats });
  const baselineBuildId = useRef(draft.id);
  const controls = useRef<Partial<Record<StatName, HTMLInputElement | null>>>({});

  useLayoutEffect(() => {
    if (!isHydrated) return;
    setValues(stringsFromStats(draft.stats));
    if (baselineBuildId.current !== draft.id) {
      baselineBuildId.current = draft.id;
      baselineStats.current = { ...draft.stats };
      setLockedStats(new Set());
    }
  }, [draft.id, draft.stats.agi, draft.stats.def, draft.stats.luk, draft.stats.str, draft.stats.vit, isHydrated]);

  if (!isHydrated) return <p>Loading draft</p>;

  const currentStats = parsedStats(values, draft.stats);
  const currentProfile = { ...draft, stats: currentStats };
  const budget = analyzeStatBudget(currentProfile, snapshot.pointsPerLevel);
  const preview = previewStatChange({ ...draft, stats: baselineStats.current }, currentStats, snapshot);

  const applyStats = (next: StatBlock) => {
    setValues(stringsFromStats(next));
    setErrors({});
    setBudgetError(undefined);
    updateDraft({ stats: next });
  };

  const updateStat = (key: StatName, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setBudgetError(undefined);
    if (!isValidStatValue(value)) return;
    const nextValue = Number(value);
    const next = adjustStat(currentProfile, key, nextValue - currentStats[key], snapshot.pointsPerLevel);
    if (next[key] === nextValue) updateDraft({ stats: next });
  };

  const continueToEquipment = () => {
    const invalidStat = stats.find(({ key }) => !isValidStatValue(values[key]));
    if (invalidStat) {
      setErrors({ [invalidStat.key]: `${invalidStat.label} must be a whole number from 0 to 500.` });
      controls.current[invalidStat.key]?.focus();
      return;
    }
    const readiness = assessOptimizationReadiness(currentProfile, snapshot.pointsPerLevel);
    if (readiness.status !== 'ready') {
      setBudgetError(readiness.explanation);
      controls.current.str?.focus();
      return;
    }
    navigate('/equipment');
  };

  return (
    <section className="planner-screen stats-workspace">
      <h2 data-screen-heading tabIndex={-1}>Stats</h2>
      <section className="stat-budget" aria-label="Stat point budget">
        <div className="stat-budget-heading">
          <strong>{budget.invested} / {budget.expected} points spent</strong>
          <span>Unspent {budget.difference}</span>
        </div>
        <progress max={Math.max(budget.expected, 1)} value={Math.min(budget.invested, budget.expected)}>
          {budget.invested} of {budget.expected}
        </progress>
        <p aria-live="polite">Available {budget.expected} · Invested {budget.invested} · Unspent {budget.difference}</p>
      </section>

      <div className="stat-control-grid">
        {stats.map((stat) => (
          <div key={stat.key} ref={(element) => { controls.current[stat.key] = element?.querySelector('input') ?? null; }}>
            <StatControl
              stat={stat.key}
              label={stat.label}
              description={stat.description}
              value={values[stat.key]}
              maxValue={maxAvailableForStat(currentProfile, stat.key, snapshot.pointsPerLevel)}
              locked={lockedStats.has(stat.key)}
              onInput={(value) => updateStat(stat.key, value)}
              onChange={(value) => applyStats(adjustStat(currentProfile, stat.key, value - currentStats[stat.key], snapshot.pointsPerLevel))}
              onToggleLock={() => setLockedStats((current) => {
                const next = new Set(current);
                if (next.has(stat.key)) next.delete(stat.key);
                else next.add(stat.key);
                return next;
              })}
            />
            {errors[stat.key] ? <span role="alert">{errors[stat.key]}</span> : null}
          </div>
        ))}
      </div>

      <div className="stat-workspace-actions">
        <button type="button" onClick={() => {
          try {
            applyStats(recommendUnspentAllocation(currentProfile, snapshot, lockedStats));
          } catch {
            setBudgetError('Unlock at least one stat with room below the cap.');
          }
        }}>Apply recommended current points</button>
        <button type="button" onClick={() => applyStats(resetStats())}>Reset stats</button>
        <button type="button" disabled={!canUndo} onClick={undoLastChange}>Undo stat change</button>
      </div>

      {budget.status === 'unaccounted' ? <p role="status" aria-live="polite">{budget.difference} points remain unspent. Results will tell you exactly where to put them.</p> : null}
      {budgetError ? <p role="alert">{budgetError}</p> : null}

      <details className="metric-preview">
        <summary>Verified live metric changes</summary>
        <dl>{previewMetrics.map(([metric, label]) => <div key={metric}><dt>{label}</dt><dd>{formatMetricDelta(preview.deltas[metric])}</dd></div>)}</dl>
      </details>
      <p className="plan-match-state">No saved exact plan for this level yet.</p>
      <StickyPlannerActions back={{ label: 'Back', onClick: () => navigate('/character') }} next={{ label: 'Continue', onClick: continueToEquipment }} />
    </section>
  );
}
