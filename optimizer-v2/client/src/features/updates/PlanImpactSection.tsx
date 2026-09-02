import type { RecommendationPlanImpact } from '../../domain/datasetImpact/planDiff';

function fieldLabel(field: string) {
  return field
    .replace(/^levelRows\./, 'Level ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statAllocation(value: unknown) {
  if (!isRecord(value)) return '';
  const labels = [
    ['str', 'STR'],
    ['def', 'DEF'],
    ['agi', 'AGI'],
    ['vit', 'VIT'],
    ['luk', 'LUK'],
  ] as const;
  return labels.flatMap(([key, label]) =>
    typeof value[key] === 'number' && value[key] !== 0
      ? [`${label} +${value[key]}`]
      : [],
  ).join(' · ');
}

function planValue(raw: string | number | null) {
  if (raw === null) return 'Not available';
  if (typeof raw === 'number') return raw.toLocaleString('en-US');
  let value: unknown = raw;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
  if (value === null) return 'Not available';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return String(item);
      }
      if (isRecord(item)) {
        const label = item.summary ?? item.itemId ?? item.name;
        if (typeof label === 'string') return label;
      }
      return JSON.stringify(item);
    }).join(' · ');
  }
  if (isRecord(value)) {
    if (typeof value.summary === 'string') return value.summary;
    if (typeof value.points === 'number') {
      const allocation = statAllocation(value.added);
      return `${value.points} points${allocation ? ` · ${allocation}` : ''}`;
    }
    if (typeof value.level === 'number') {
      const allocation = statAllocation(value.added);
      return `Level ${value.level}${allocation ? ` · ${allocation}` : ''}`;
    }
  }
  return JSON.stringify(value);
}

export function PlanImpactSection({
  impact,
}: {
  impact: RecommendationPlanImpact;
}) {
  return (
    <section className="dataset-impact-section" aria-labelledby="plan-impact-heading">
      <h2 id="plan-impact-heading">Effect on your plan</h2>
      {impact.status === 'blocked' ? (
        <div className="dataset-plan-blocked" role="status">
          <p>The plan comparison is blocked, but verified fact changes remain available.</p>
          {impact.pinnedReason ? <p>Pinned plan: {impact.pinnedReason}</p> : null}
          {impact.targetReason ? <p>Current plan: {impact.targetReason}</p> : null}
        </div>
      ) : impact.status === 'unchanged' ? (
        <p><strong>Plan unchanged.</strong> The verified changes do not alter this recommendation.</p>
      ) : (
        <>
          <p><strong>Recommendation changed.</strong></p>
          {impact.changedLevelRows.length > 0 ? (
            <p>Levels {impact.changedLevelRows.join(', ')} changed.</p>
          ) : null}
          <div className="dataset-plan-change-list">
            {impact.changes.map((change) => (
              <article key={change.id}>
                <h3>{fieldLabel(change.field)}</h3>
                <dl>
                  <div><dt>Before</dt><dd>{planValue(change.before)}</dd></div>
                  <div><dt>After</dt><dd>{planValue(change.after)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
      {impact.status !== 'blocked' ? (
        <p className="dataset-shopping-impact">
          Known shopping total: {impact.shopping.beforeKnownTotal.toLocaleString('en-US')}
          {impact.shopping.currency ? ` ${impact.shopping.currency}` : ''} →{' '}
          {impact.shopping.afterKnownTotal.toLocaleString('en-US')}
          {impact.shopping.currency ? ` ${impact.shopping.currency}` : ''}.
          {' '}{impact.shopping.afterUnknownCount} current price
          {impact.shopping.afterUnknownCount === 1 ? ' is' : 's are'} still unknown.
        </p>
      ) : null}
    </section>
  );
}
