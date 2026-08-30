import type { OptimizationGoal } from '../../domain/build/model';

export const GOAL_PRESENTATION: Record<
  OptimizationGoal,
  { label: string; description: string; metrics: string[] }
> = {
  balanced: {
    label: 'Balanced',
    description:
      'Keeps damage, survivability, mobility, and farming metrics in the plan without overcommitting to one.',
    metrics: ['Attack', 'Defense and HP', 'Movement and stamina', 'Drop chance'],
  },
  damage: {
    label: 'Damage',
    description:
      'Emphasizes attack per hit, critical chance, and multi-hit chance while retaining basic defense.',
    metrics: ['Attack per hit', 'Critical chance', 'Multi-hit chance'],
  },
  survivability: {
    label: 'Survivability',
    description:
      'Emphasizes damage reduction, bonus HP, and modeled debuff resistance.',
    metrics: ['Damage reduction', 'Bonus HP', 'Debuff resistance'],
  },
  mobility: {
    label: 'Mobility',
    description:
      'Emphasizes movement speed and stamina while keeping enough damage and survival value to progress.',
    metrics: ['Stamina', 'Walk speed', 'Sprint speed'],
  },
  farming: {
    label: 'Farming',
    description:
      'Emphasizes modeled drop chance while retaining light damage, survival, and movement support.',
    metrics: ['Drop chance', 'Attack', 'Movement support'],
  },
};

export function GoalCard({
  goal,
  selected,
  onSelect,
}: {
  goal: OptimizationGoal;
  selected: boolean;
  onSelect(goal: OptimizationGoal): void;
}) {
  const presentation = GOAL_PRESENTATION[goal];
  return (
    <label className="goal-card">
      <input
        type="radio"
        name="optimization-goal"
        value={goal}
        aria-label={presentation.label}
        checked={selected}
        onChange={() => onSelect(goal)}
      />
      <span className="goal-card-heading">{presentation.label}</span>
      <span className="goal-card-description">{presentation.description}</span>
      <span className="goal-card-metrics">
        {presentation.metrics.join(' · ')}
      </span>
    </label>
  );
}
