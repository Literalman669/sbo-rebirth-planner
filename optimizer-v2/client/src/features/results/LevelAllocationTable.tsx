import type { StatBlock, StatName } from '../../domain/build/model';
import type {
  LevelAllocationRow,
  SpendNowAllocation,
} from '../../domain/optimizer/allocateStats';

export const statLabels: Array<{ key: StatName; label: string }> = [
  { key: 'str', label: 'STR' },
  { key: 'def', label: 'DEF' },
  { key: 'agi', label: 'AGI' },
  { key: 'vit', label: 'VIT' },
  { key: 'luk', label: 'LUK' },
];

function statSummary(stats: StatBlock) {
  return statLabels
    .map(({ key, label }) => `${label} ${stats[key]}`)
    .join(' · ');
}

function addedSummary(stats: StatBlock) {
  const additions = statLabels
    .filter(({ key }) => stats[key] > 0)
    .map(({ key, label }) => `${label} +${stats[key]}`);
  return additions.length > 0 ? additions.join(' · ') : 'No points to spend';
}

export function SpendNowPanel({
  current,
  allocation,
  currentLevel,
  headingId = 'spend-now-heading',
}: {
  current: StatBlock;
  allocation: SpendNowAllocation;
  currentLevel: number;
  headingId?: string;
}) {
  const earnedPoints = statLabels.reduce(
    (total, { key }) => total + current[key],
    allocation.points,
  );

  return (
    <section
      aria-labelledby={headingId}
      className="result-band spend-now-band"
    >
      <div className="result-band-heading">
        <h3 id={headingId}>Spend now</h3>
        <strong>
          {allocation.points} point{allocation.points === 1 ? '' : 's'} available now
        </strong>
      </div>
      {allocation.points > 0 ? (
        <>
          <p className="spend-now-action">Add {addedSummary(allocation.added)}</p>
          <dl className="spend-now-totals">
            <div>
              <dt>Before</dt>
              <dd>{statSummary(current)}</dd>
            </div>
            <div>
              <dt>After spending</dt>
              <dd>{statSummary(allocation.totals)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <p className="spend-now-action">
            All {earnedPoints} earned points are invested. Your next allocation begins at Level {currentLevel + 1}.
          </p>
          <dl className="spend-now-totals spend-now-current">
            <div>
              <dt>Current stats</dt>
              <dd>{statSummary(current)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

export function LevelAllocationTable({
  rows,
  showAllLevels = false,
  onShowAll,
  onAdvance,
}: {
  rows: readonly LevelAllocationRow[];
  showAllLevels?: boolean;
  onShowAll?(): void;
  onAdvance?(level: number): void;
}) {
  const visibleRows = showAllLevels ? rows : rows.slice(0, 3);
  return (
    <>
      <p className="level-allocation-note">
        Add this level is new spending for that level; totals are your stats after spending.
      </p>
      <div className="level-allocation-table-wrapper">
        <table aria-label="Next ten levels" className="level-allocation-table">
          <thead>
            <tr>
              <th rowSpan={2} scope="col">Level</th>
              <th colSpan={5} scope="colgroup">Add this level</th>
              <th colSpan={5} scope="colgroup">Stats after spending</th>
              {onAdvance ? <th rowSpan={2} scope="col">Update</th> : null}
            </tr>
            <tr>
              {statLabels.map(({ key, label }) => (
                <th key={`add:${key}`} scope="col">{label}+</th>
              ))}
              {statLabels.map(({ key, label }) => (
                <th key={`total:${key}`} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.level}>
                <th scope="row">Level {row.level}</th>
                {statLabels.map(({ key, label }) => (
                  <td key={`add:${key}`} data-label={`${label}+`}>
                    +{row.added[key]}
                  </td>
                ))}
                {statLabels.map(({ key, label }) => (
                  <td key={`total:${key}`} data-label={`${label} total`}>
                    {row.totals[key]}
                  </td>
                ))}
                {onAdvance ? (
                  <td data-label="Update">
                    <button type="button" onClick={() => onAdvance(row.level)}>
                      Advance to Level {row.level}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAllLevels && rows.length > visibleRows.length && onShowAll ? (
        <button type="button" className="show-all-levels" onClick={onShowAll}>
          Show all ten levels
        </button>
      ) : null}
    </>
  );
}
