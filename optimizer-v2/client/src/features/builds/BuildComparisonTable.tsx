import type {
  BuildComparisonEvaluation,
  BuildComparisonMetricRow,
  BuildComparisonResult,
} from '../../domain/build/comparison';
import type { EquipmentSlot } from '../../domain/build/model';

const slots: EquipmentSlot[] = [
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
];

const slotLabels: Record<EquipmentSlot, string> = {
  'main-hand': 'Main hand',
  'off-hand': 'Off hand',
  armor: 'Armor',
  shield: 'Shield',
  'upper-head': 'Upper headwear',
  'lower-head': 'Lower headwear',
};

function formatValue(
  value: number | null,
  format: BuildComparisonMetricRow['format'],
) {
  if (value === null) return 'Missing verified data';
  return format === 'percent'
    ? `${(value * 100).toFixed(2)}%`
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function leaderLabel(leader: BuildComparisonMetricRow['leader']) {
  if (leader === 'left') return 'Higher verified value: First build';
  if (leader === 'right') return 'Higher verified value: Second build';
  if (leader === 'equal') return 'Equal verified value';
  return 'Comparison unavailable';
}

function equipmentDetails(
  evaluation: BuildComparisonEvaluation,
  slot: EquipmentSlot,
  side: 'First' | 'Second',
) {
  const itemId = evaluation.profile.equipped[slot];
  if (!itemId) return <span>Not equipped</span>;
  if (evaluation.status === 'dataset-unavailable') return <span>{itemId}</span>;
  const item = evaluation.dataset.catalog.find((candidate) => candidate.id === itemId);
  if (!item) return <span>{itemId} · unavailable in this dataset</span>;
  const priced = item.acquisitions
    .filter(
      (acquisition): acquisition is typeof acquisition & {
        cost: number;
        currency: string;
      } =>
        typeof acquisition.cost === 'number' &&
        typeof acquisition.currency === 'string',
    )
    .sort((left, right) => left.cost - right.cost)[0];
  return (
    <span>
      <strong>{item.name}</strong>
      {' · '}
      {priced
        ? `${priced.cost.toLocaleString('en-US')} ${priced.currency}`
        : 'Missing verified price'}
      {' · '}
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={
          side === 'First'
            ? `Open ${item.name} Wiki`
            : `Open ${item.name} Wiki for Second build`
        }
      >
        Source
      </a>
    </span>
  );
}

function statusMessage(evaluation: BuildComparisonEvaluation) {
  if (evaluation.status === 'dataset-unavailable') {
    return `Dataset ${evaluation.profile.datasetVersion} is unavailable.`;
  }
  if (evaluation.status === 'profile-incomplete') {
    return 'Stored character inputs are incomplete.';
  }
  if (evaluation.status === 'equipment-incomplete') {
    return `Equipment is incomplete for dataset ${evaluation.dataset.version}.`;
  }
  if (evaluation.status === 'optimizer-unavailable') {
    return evaluation.explanation;
  }
  return null;
}

function PlanSummary({
  evaluation,
  label,
}: {
  evaluation: BuildComparisonEvaluation;
  label: string;
}) {
  if (evaluation.status !== 'ready') return null;
  const knownCosts = Object.entries(evaluation.costs.totals)
    .map(([currency, amount]) => `${amount.toLocaleString('en-US')} ${currency}`)
    .join(' · ');
  return (
    <section aria-label={`${label} plan summary`}>
      <h3>{label} plan</h3>
      <p>Spend now: {evaluation.plan.statPlan.spendNow.points} points</p>
      <p>Next ten levels: {evaluation.plan.statPlan.futurePoints} points</p>
      <p>
        Shopping: {knownCosts || 'No verified cost'}
        {evaluation.costs.unknownPriceActions > 0
          ? ` · ${evaluation.costs.unknownPriceActions} unknown price`
          : ''}
      </p>
    </section>
  );
}

export function BuildComparisonTable({
  comparison,
}: {
  comparison: BuildComparisonResult;
}) {
  const leftStatus = statusMessage(comparison.left);
  const rightStatus = statusMessage(comparison.right);
  return (
    <div className="build-comparison-evidence">
      {leftStatus ? <p role="status">{leftStatus}</p> : null}
      {rightStatus ? <p role="status">{rightStatus}</p> : null}
      <div
        className="build-comparison-table"
        role="region"
        aria-label="Build metric comparison"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">First build</th>
              <th scope="col">Second build</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {comparison.metrics.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{formatValue(row.left, row.format)}</td>
                <td>{formatValue(row.right, row.format)}</td>
                <td>{leaderLabel(row.leader)}</td>
              </tr>
            ))}
            {slots.map((slot) => (
              <tr key={slot}>
                <th scope="row">{slotLabels[slot]}</th>
                <td>{equipmentDetails(comparison.left, slot, 'First')}</td>
                <td>{equipmentDetails(comparison.right, slot, 'Second')}</td>
                <td>
                  {comparison.left.profile.equipped[slot] ===
                  comparison.right.profile.equipped[slot]
                    ? 'Same stored item'
                    : 'Different stored items'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="build-comparison-columns">
        <PlanSummary evaluation={comparison.left} label="First build" />
        <PlanSummary evaluation={comparison.right} label="Second build" />
      </div>
    </div>
  );
}
