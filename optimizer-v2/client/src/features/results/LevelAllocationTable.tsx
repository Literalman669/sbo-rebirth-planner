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
  headingId = 'spend-now-heading',
}: {
  current: StatBlock;
  allocation: SpendNowAllocation;
  headingId?: string;
}) {
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
        <p className="spend-now-action">Add {addedSummary(allocation.added)}</p>
      ) : (
        <p className="spend-now-action">Your earned points are already represented.</p>
      )}
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
    </section>
  );
}

export function LevelAllocationTable({
  rows,
}: {
  rows: readonly LevelAllocationRow[];
}) {
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
            {rows.map((row) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
