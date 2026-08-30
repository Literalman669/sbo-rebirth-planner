import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import type {
  OptimizationGoal,
  WeaponPath,
} from '../../domain/build/model';
import { WeaponPathIcon } from './WeaponPathIcon';
import { StickyPlannerActions } from '../shell/StickyPlannerActions';
import { GoalCard, GOAL_PRESENTATION } from './GoalCard';

const weaponPaths: Array<{ value: WeaponPath; label: string }> = [
  { value: 'two-handed', label: 'Two-Handed' },
  { value: 'one-handed', label: 'One-Handed' },
  { value: 'rapier', label: 'Rapier' },
  { value: 'dagger', label: 'Dagger' },
  { value: 'dual-wield', label: 'Dual Wield' },
  { value: 'melee', label: 'Melee' },
];

const goals = Object.keys(GOAL_PRESENTATION) as OptimizationGoal[];

export function CharacterScreen() {
  const navigate = useNavigate();
  const { draft, isHydrated, updateDraft } = useBuildDraft();
  const [values, setValues] = useState(() => ({
    name: draft.name ?? '',
    level: String(draft.level),
    maxFloor: String(draft.maxFloor),
    weaponSkill: draft.weaponSkill === undefined ? '' : String(draft.weaponSkill),
  }));
  const [errors, setErrors] = useState<
    Partial<Record<'name' | 'level' | 'maxFloor' | 'weaponSkill', string>>
  >({});
  const controls = useRef<
    Partial<
      Record<
        'name' | 'level' | 'maxFloor' | 'weaponSkill',
        HTMLInputElement | null
      >
    >
  >({});

  useEffect(() => {
    if (isHydrated) {
      setValues({
        name: draft.name ?? '',
        level: String(draft.level),
        maxFloor: String(draft.maxFloor),
        weaponSkill:
          draft.weaponSkill === undefined ? '' : String(draft.weaponSkill),
      });
    }
  }, [isHydrated]);

  if (!isHydrated) return <p>Loading draft</p>;

  const updateNumber =
    (key: 'level' | 'maxFloor' | 'weaponSkill') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      if (key === 'weaponSkill') {
        setValues((current) => ({ ...current, weaponSkill: value }));
        setErrors((current) => ({ ...current, weaponSkill: undefined }));
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
    const name = values.name.trim();
    if (name.length > 60) {
      setErrors({ name: 'Build name must be 60 characters or fewer.' });
      controls.current.name?.focus();
      return;
    }
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

    const weaponSkillText = values.weaponSkill.trim();
    const weaponSkill =
      weaponSkillText === '' ? undefined : Number(weaponSkillText);
    if (
      weaponSkill !== undefined &&
      (!Number.isInteger(weaponSkill) || weaponSkill < 0 || weaponSkill > 10000)
    ) {
      setErrors({
        weaponSkill:
          'Weapon Skill must be a whole number from 0 to 10000, or left blank.',
      });
      controls.current.weaponSkill?.focus();
      return;
    }

    updateDraft({
      name: name || undefined,
      level,
      maxFloor,
      weaponSkill,
    });
    navigate('/stats');
  };

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>
        Tell us where your adventurer stands.
      </h2>

      <label className="build-name-field">
        Build Name <span>(optional)</span>
        <input
          ref={(element) => {
            controls.current.name = element;
          }}
          type="text"
          aria-label="Build Name"
          maxLength={60}
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            const name = event.currentTarget.value;
            setValues((current) => ({
              ...current,
              name,
            }));
            setErrors((current) => ({ ...current, name: undefined }));
          }}
        />
        {errors.name ? <span role="alert">{errors.name}</span> : null}
      </label>

      <div className="field-row">
        <label>
          Current Level
          <input
            ref={(element) => {
              controls.current.level = element;
            }}
            type="number"
            aria-label="Current Level"
            min="1"
            max="10000"
            value={values.level}
            aria-invalid={Boolean(errors.level)}
            onChange={updateNumber('level')}
          />
          {errors.level ? <span role="alert">{errors.level}</span> : null}
          <span className="field-hint">Use the level shown on your in-game profile.</span>
        </label>
        <label>
          Highest Unlocked Floor
          <input
            ref={(element) => {
              controls.current.maxFloor = element;
            }}
            type="number"
            aria-label="Highest Unlocked Floor"
            min="1"
            max="19"
            value={values.maxFloor}
            aria-invalid={Boolean(errors.maxFloor)}
            onChange={updateNumber('maxFloor')}
          />
          {errors.maxFloor ? <span role="alert">{errors.maxFloor}</span> : null}
          <span className="field-hint">Choose the highest floor you can currently enter.</span>
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

      <fieldset>
        <legend>Optimization Goal</legend>
        <div className="goal-card-grid">
          {goals.map((goal) => (
            <GoalCard
              key={goal}
              goal={goal}
              selected={draft.goal === goal}
              onSelect={(selectedGoal) => updateDraft({ goal: selectedGoal })}
            />
          ))}
        </div>
      </fieldset>

      <details
        open={
          draft.weaponPath === 'dual-wield' ||
          Boolean(values.weaponSkill.trim())
        }
      >
        <summary>Improve accuracy</summary>
        <label>
          Weapon Skill
          <input
            ref={(element) => {
              controls.current.weaponSkill = element;
            }}
            type="text"
            inputMode="numeric"
            value={values.weaponSkill}
            aria-invalid={Boolean(errors.weaponSkill)}
            onChange={updateNumber('weaponSkill')}
          />
          {errors.weaponSkill ? (
            <span role="alert">{errors.weaponSkill}</span>
          ) : null}
        </label>
      </details>

      <StickyPlannerActions
        back={{ label: 'Back', onClick: () => navigate('/') }}
        next={{ label: 'Continue', onClick: continueToStats }}
      />
    </section>
  );
}
