type CoverageManifest = {
  discovered: number;
  fetched: number;
  parsed: number;
  normalized: number;
  verified: number;
  partial: number;
  conflicting: number;
  unknown: number;
  legacy: number;
  unresolvedJson: string;
};

export function CoverageManifestPanel({
  manifest,
}: {
  manifest: CoverageManifest | undefined;
}) {
  if (!manifest) {
    return (
      <section className="curation-card" aria-label="Wiki coverage">
        <h2>Wiki coverage</h2>
        <p>No coverage manifest has been staged for this draft.</p>
      </section>
    );
  }
  let unresolved: Array<{ pageTitle: string; reason: string }> = [];
  let unaccountedPages: string[] = [];
  try {
    const detail = JSON.parse(manifest.unresolvedJson) as {
      unresolved?: Array<{ pageTitle: string; reason: string }>;
      unaccountedPages?: string[];
    };
    unresolved = detail.unresolved ?? [];
    unaccountedPages = detail.unaccountedPages ?? [];
  } catch {
    unaccountedPages = ['Manifest detail is invalid JSON'];
  }

  return (
    <section className="curation-card" aria-label="Wiki coverage">
      <h2>Wiki coverage</h2>
      <dl className="coverage-counts">
        {([
          ['Discovered', manifest.discovered],
          ['Fetched', manifest.fetched],
          ['Parsed', manifest.parsed],
          ['Normalized', manifest.normalized],
          ['Verified', manifest.verified],
          ['Partial', manifest.partial],
          ['Conflicting', manifest.conflicting],
          ['Unknown', manifest.unknown],
          ['Legacy', manifest.legacy],
        ] as const).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {unaccountedPages.length > 0 && (
        <div role="alert">
          <strong>Unaccounted pages</strong>
          <ul>{unaccountedPages.map((page) => <li key={page}>{page}</li>)}</ul>
        </div>
      )}
      {unresolved.length > 0 && (
        <details>
          <summary>{unresolved.length} explicitly unresolved pages</summary>
          <ul>
            {unresolved.map((item) => (
              <li key={`${item.pageTitle}:${item.reason}`}>
                <strong>{item.pageTitle}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
