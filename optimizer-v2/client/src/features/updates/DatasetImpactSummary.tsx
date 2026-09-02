import type { DatasetImpactReport } from '../../domain/datasetImpact/report';

export function DatasetImpactSummary({
  report,
  buildName,
}: {
  report: DatasetImpactReport;
  buildName: string;
}) {
  return (
    <section className="dataset-impact-summary" aria-labelledby="impact-summary-heading">
      <p className="eyebrow">Pinned-to-current report</p>
      <h2 id="impact-summary-heading">{buildName}</h2>
      <p>
        Dataset <strong>{report.pinned.version}</strong> →{' '}
        <strong>{report.target.version}</strong>
      </p>
      <p>
        This report compares verified facts first, then shows the exact effect
        on this build&apos;s recommendation.
      </p>
    </section>
  );
}
