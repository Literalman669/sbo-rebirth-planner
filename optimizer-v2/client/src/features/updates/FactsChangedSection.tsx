import type { ComparableFactValue } from '../../domain/datasetImpact/factProjection';
import type { DatasetFactChange } from '../../domain/datasetImpact/factDiff';

function factValue(value: ComparableFactValue) {
  if (value === null) return 'Not recorded';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function entityName(entityId: string) {
  const words = entityId.split(':')[0]!.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function FactsChangedSection({
  changes,
  omitted,
}: {
  changes: readonly DatasetFactChange[];
  omitted: number;
}) {
  return (
    <section className="dataset-impact-section" aria-labelledby="facts-changed-heading">
      <h2 id="facts-changed-heading">Verified facts changed</h2>
      {changes.length === 0 ? (
        <p>No build-relevant verified facts changed.</p>
      ) : (
        <div className="dataset-fact-grid">
          {changes.map((change) => (
            <article key={change.id} className="dataset-fact-change">
              <header>
                <strong>{entityName(change.entityId)}</strong>
                <span>{change.field} · {change.change}</span>
              </header>
              <dl>
                <div>
                  <dt>Before</dt>
                  <dd>
                    <span>{factValue(change.before)}</span>
                    {change.beforeSourceUrl ? (
                      <a
                        href={change.beforeSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Before source"
                      >
                        Before source{change.beforeSourceRevision
                          ? ` · revision ${change.beforeSourceRevision}`
                          : ''}
                      </a>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd>
                    <span>{factValue(change.after)}</span>
                    {change.afterSourceUrl ? (
                      <a
                        href={change.afterSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="After source"
                      >
                        After source{change.afterSourceRevision
                          ? ` · revision ${change.afterSourceRevision}`
                          : ''}
                      </a>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
      {omitted > 0 ? (
        <p className="dataset-impact-omitted">
          {omitted} other verified {omitted === 1 ? 'change was' : 'changes were'}
          {' '}outside this build&apos;s equipment, path, access, and recommendation.
        </p>
      ) : null}
    </section>
  );
}
