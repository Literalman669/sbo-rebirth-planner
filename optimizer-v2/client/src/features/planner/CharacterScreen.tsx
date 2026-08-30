import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import type {
  OptimizationGoal,
  WeaponPath,
} from '../../domain/build/model';
import { WeaponPathIcon } from './WeaponPathIcon';

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
  const [values, setValues] = useState(() => ({
    level: String(draft.level),
    maxFloor: String(draft.maxFloor),
  }));
  const [errors, setErrors] = useState<
    Partial<Record<'level' | 'maxFloor', string>>
  >({});
  const controls = useRef<
    Partial<Record<'level' | 'maxFloor', HTMLInputElement | null>>
  >({});

  useEffect(() => {
    if (isHydrated) {
      setValues({ level: String(draft.level), maxFloor: String(draft.maxFloor) });
    }
  }, [isHydrated]);

  if (!isHydrated) return <p>Loading draft</p>;

  const updateNumber =
    (key: 'level' | 'maxFloor' | 'weaponSkill') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      if (key === 'weaponSkill') {
        updateDraft({ weaponSkill: value === '' ? undefined : Number(value) });
        return;
      }

      setValues((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
      const numberValue = Number(value);
      const valid =
        Number.isInteger(numberValue) &&
        (key === 'level'
          ? numberValue >= 1 && numberValue <= 10000
          : numberValue >= 1 && numberValue <= 19);
      if (valid) updateDraft({ [key]: numberValue });
    };

  const continueToStats = () => {
    const level = Number(values.level);
    if (!Number.isInteger(level) || level < 1 || level > 10000) {
      setErrors({ level: 'Enter a whole-number level from 1 to 10000.' });
      controls.current.level?.focus();
      return;
    }

    const maxFloor = Number(values.maxFloor);
    if (!Number.isInteger(maxFloor) || maxFloor < 1 || maxFloor > 19) {
      setErrors({ maxFloor: 'Enter a whole-number floor from 1 to 19.' });
      controls.current.maxFloor?.focus();
      return;
    }

    navigate('/stats');
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
            ref={(element) => {
              controls.current.level = element;
            }}
            type="number"
            min="1"
            max="10000"
            value={values.level}
            aria-invalid={Boolean(errors.level)}
            onChange={updateNumber('level')}
          />
          {errors.level ? <span role="alert">{errors.level}</span> : null}
        </label>
        <label>
          Highest Unlocked Floor
          <input
            ref={(element) => {
              controls.current.maxFloor = element;
            }}
            type="number"
            min="1"
            max="19"
            value={values.maxFloor}
            aria-invalid={Boolean(errors.maxFloor)}
            onChange={updateNumber('maxFloor')}
          />
          {errors.maxFloor ? <span role="alert">{errors.maxFloor}</span> : null}
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
              <span className="weapon-icon">
                <WeaponPathIcon path={weapon.value} />
              </span>
              <span className="weapon-label">{weapon.label}</span>
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
        <button type="button" onClick={continueToStats}>
          Continue
        </button>
      </div>
    </section>
  );
}
