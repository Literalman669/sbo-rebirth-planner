import type { DatasetReleaseImpactStep } from '../../domain/datasetImpact/report';
import type { RecommendationPlanImpact } from '../../domain/datasetImpact/planDiff';
import { useState } from 'react';

function ReleaseStepPlanSummary({
  plan,
}: {
  plan: RecommendationPlanImpact | null;
}) {
  if (!plan) return <p>Release-step plan details are unavailable.</p>;
  if (plan.status === 'unchanged') {
    return <p>Plan unchanged in this release step.</p>;
  }
  if (plan.status === 'blocked') {
    return <p>Plan comparison blocked in this release step.</p>;
  }
  return (
    <p>
      {plan.changes.length} plan fields and {plan.changedLevelRows.length}{' '}
      level rows changed.
    </p>
  );
}

export function ReleaseTrailSection({
  steps,
  onLoadPlan,
}: {
  steps: readonly DatasetReleaseImpactStep[];
  onLoadPlan?: (stepIndex: number) => Promise<RecommendationPlanImpact | null>;
}) {
  const [plans, setPlans] = useState(
    new Map<number, RecommendationPlanImpact | null>(),
  );
  const [loading, setLoading] = useState(new Set<number>());

  const loadPlan = (stepIndex: number) => {
    if (!onLoadPlan || plans.has(stepIndex) || loading.has(stepIndex)) return;
    setLoading((current) => new Set(current).add(stepIndex));
    void onLoadPlan(stepIndex).then((plan) => {
      setPlans((current) => new Map(current).set(stepIndex, plan));
    }).finally(() => {
      setLoading((current) => {
        const next = new Set(current);
        next.delete(stepIndex);
        return next;
      });
    });
  };
  return (
    <section className="dataset-impact-section" aria-labelledby="release-trail-heading">
      <h2 id="release-trail-heading">Release trail</h2>
      {steps.length === 0 ? <p>No intermediate releases.</p> : (
        <div className="dataset-release-trail">
          {steps.map((step, stepIndex) => (
            <details
              key={`${step.fromVersion}:${step.toVersion}`}
              onToggle={(event) => {
                if (event.currentTarget.open && step.status === 'available') {
                  loadPlan(stepIndex);
                }
              }}
            >
              <summary>
                {step.fromVersion} → {step.toVersion}
                {' · '}{step.status === 'gap' ? 'Snapshot unavailable' : `${step.factChanges.length} relevant facts`}
              </summary>
              {step.status === 'gap' ? (
                <p>Snapshot unavailable; the pinned-to-current endpoint report remains valid.</p>
              ) : step.factChanges.length === 0 ? (
                <p>No build-relevant fact changes in this release step.</p>
              ) : (
                <ul>{step.factChanges.map((change) => (
                  <li key={change.id}>{change.entityId}: {change.field}</li>
                ))}</ul>
              )}
              {step.status === 'available' && loading.has(stepIndex) ? (
                <p>Loading release-step plan impact…</p>
              ) : null}
              {step.status === 'available' && plans.has(stepIndex) ? (
                <ReleaseStepPlanSummary plan={plans.get(stepIndex) ?? null} />
              ) : null}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
