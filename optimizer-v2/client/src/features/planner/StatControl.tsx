import type { StatName } from '../../domain/build/model';

export function StatControl({
  stat,
  label,
  description,
  value,
  maxValue,
  locked,
  onChange,
  onInput,
  onToggleLock,
}: {
  stat: StatName;
  label: string;
  description: string;
  value: number | string;
  maxValue: number;
  locked: boolean;
  onChange(value: number): void;
  onInput?(value: string): void;
  onToggleLock(): void;
}) {
  const numericValue =
    typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : 0;
  const setBounded = (next: number) =>
    onChange(Math.min(Math.max(Math.trunc(next), 0), Math.min(maxValue, 500)));
  return (
    <article className={`stat-control${locked ? ' stat-control-locked' : ''}`}>
      <div className="stat-control-heading">
        <label>
          {label}
          <input
            type="number"
            min="0"
            max="500"
            aria-label={label}
            value={value}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (onInput) onInput(next);
              else setBounded(next === '' ? 0 : Number(next));
            }}
          />
        </label>
        <button
          type="button"
          className="stat-lock"
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
          aria-pressed={locked}
          onClick={onToggleLock}
        >
          {locked ? 'Locked' : 'Lock'}
        </button>
      </div>
      <p>{description}</p>
      <div className="stat-adjustments">
        <button
          type="button"
          aria-label={`Remove 1 ${label}`}
          disabled={numericValue <= 0}
          onClick={() => setBounded(numericValue - 1)}
        >
          −1
        </button>
        <button
          type="button"
          aria-label={`Add 1 ${label}`}
          disabled={numericValue >= maxValue}
          onClick={() => setBounded(numericValue + 1)}
        >
          +1
        </button>
        <button
          type="button"
          aria-label={`Add 5 ${label}`}
          disabled={numericValue >= maxValue}
          onClick={() => setBounded(numericValue + 5)}
        >
          +5
        </button>
        <button
          type="button"
          aria-label={`Set ${label} to max`}
          disabled={numericValue >= maxValue}
          onClick={() => setBounded(maxValue)}
        >
          Max
        </button>
      </div>
      {numericValue >= 500 ? (
        <span className="stat-cap-state">Capped at 500</span>
      ) : numericValue >= 490 ? (
        <span className="stat-cap-state">Near the 500 cap</span>
      ) : null}
    </article>
  );
}
