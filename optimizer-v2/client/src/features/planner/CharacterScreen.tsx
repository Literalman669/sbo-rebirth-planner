import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftProvider';
import type {
  OptimizationGoal,
  WeaponPath,
} from '../../domain/build/model';

const weaponPaths: Array<{ value: WeaponPath; label: string }> = [
  { value: 'two-handed', label: 'Two-Handed' },
  { value: 'one-handed', label: 'One-Handed' },
  { value: 'rapier', label: 'Rapier' },
  { value: 'dagger', label: 'Dagger' },
  { value: 'dual-wield', label: 'Dual Wield' },
  { value: 'melee', label: 'Melee' },
];

const goals: Array<{ value: OptimizationGoal; label: string }> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'damage', label: 'Damage' },
  { value: 'survivability', label: 'Survivability' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'farming', label: 'Farming' },
];

export function CharacterScreen() {
  const navigate = useNavigate();
  const { draft, isHydrated, updateDraft } = useBuildDraft();

  if (!isHydrated) return <p>Loading draft</p>;

  const updateNumber =
    (key: 'level' | 'maxFloor' | 'weaponSkill') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      updateDraft({ [key]: value === '' ? undefined : Number(value) });
    };

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>
        Tell us where your adventurer stands.
      </h2>

      <div className="field-row">
        <label>
          Current Level
          <input
            type="number"
            min="1"
            max="10000"
            value={draft.level}
            onChange={updateNumber('level')}
          />
        </label>
        <label>
          Highest Unlocked Floor
          <input
            type="number"
            min="1"
            max="19"
            value={draft.maxFloor}
            onChange={updateNumber('maxFloor')}
          />
        </label>
      </div>

      <fieldset>
        <legend>Weapon Path</legend>
        <div className="weapon-path-options">
          {weaponPaths.map((weapon) => (
            <label key={weapon.value}>
              <input
                type="radio"
                name="weapon-path"
                value={weapon.value}
                checked={draft.weaponPath === weapon.value}
                onChange={() =>
                  updateDraft({ weaponPath: weapon.value, equipped: {} })
                }
              />
              <span>{weapon.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Optimization Goal
        <select
          aria-label="Optimization Goal"
          value={draft.goal}
          onChange={(event) =>
            updateDraft({ goal: event.currentTarget.value as OptimizationGoal })
          }
        >
          {goals.map((goal) => (
            <option key={goal.value} value={goal.value}>
              {goal.label}
            </option>
          ))}
        </select>
      </label>

      <details>
        <summary>Improve accuracy</summary>
        <label>
          Weapon Skill
          <input
            type="number"
            min="0"
            max="10000"
            value={draft.weaponSkill ?? ''}
            onChange={updateNumber('weaponSkill')}
          />
        </label>
      </details>

      <div className="screen-actions">
        <button type="button" onClick={() => navigate('/')}>
          Back
        </button>
        <button type="button" onClick={() => navigate('/stats')}>
          Continue
        </button>
      </div>
    </section>
  );
}
