import type { DatasetImpactCandidate } from '../../domain/datasetImpact/candidates';

export function datasetCandidateValue(candidate: DatasetImpactCandidate) {
  return `${datasetCandidateQuerySource(candidate)}:${candidate.id}`;
}

export function datasetCandidateQuerySource(candidate: DatasetImpactCandidate) {
  const source =
    candidate.source === 'active'
      ? candidate.backingSource
      : candidate.source;
  return source === 'cloud' ? 'cloud' : 'local';
}

function candidateLabel(candidate: DatasetImpactCandidate) {
  const name =
    candidate.profile.name ?? `Level ${candidate.profile.level} build`;
  const labels = [
    candidate.kind === 'active-draft'
      ? 'Active draft'
      : candidate.kind === 'personal-preset'
        ? 'Personal preset'
        : candidate.source === 'local+cloud'
          ? 'Local and cloud'
          : candidate.source === 'cloud'
            ? 'Cloud'
            : 'Local',
  ];
  if (candidate.archivedAt) labels.push('Archived');
  if (candidate.status === 'reviewed-pinned') labels.push('Reviewed');
  if (candidate.status === 'blocked') labels.push('Data unavailable');
  return `${labels.join(' · ')} — ${name}`;
}

export function DatasetUpdateBuildList({
  candidates,
  selectedValue,
  onSelect,
}: {
  candidates: readonly DatasetImpactCandidate[];
  selectedValue: string;
  onSelect(value: string): void;
}) {
  return (
    <section className="dataset-update-build-list" aria-labelledby="review-builds-heading">
      <h2 id="review-builds-heading">Owned builds</h2>
      <label>
        Review build
        <select
          value={selectedValue}
          onChange={(event) => onSelect(event.target.value)}
        >
          {candidates.map((candidate) => (
            <option
              key={datasetCandidateValue(candidate)}
              value={datasetCandidateValue(candidate)}
            >
              {candidateLabel(candidate)}
            </option>
          ))}
        </select>
      </label>
      <ul className="dataset-update-build-statuses">
        {candidates.map((candidate) => (
          <li key={datasetCandidateValue(candidate)}>
            <span>{candidate.profile.name ?? `Level ${candidate.profile.level} build`}</span>
            <small>{candidate.status === 'unreviewed'
              ? 'Needs review'
              : candidate.status === 'reviewed-pinned'
                ? 'Reviewed · pinned'
                : 'Comparison blocked'}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
