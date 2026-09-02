import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDatasetUpdates } from '../../app/providers/DatasetUpdatesContext';
import type { DatasetImpactReport } from '../../domain/datasetImpact/report';
import type { RecommendationPlan } from '../../domain/optimizer/optimizeBuild';
import { ApplyDatasetUpdateDialog } from './ApplyDatasetUpdateDialog';
import {
  DatasetUpdateBuildList,
  datasetCandidateQuerySource,
  datasetCandidateValue,
} from './DatasetUpdateBuildList';
import { DatasetImpactSummary } from './DatasetImpactSummary';
import { FactsChangedSection } from './FactsChangedSection';
import { PlanImpactSection } from './PlanImpactSection';
import { ReleaseTrailSection } from './ReleaseTrailSection';

export function DatasetUpdatesScreen() {
  const updates = useDatasetUpdates();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBuild = searchParams.get('build');
  const requestedSource = searchParams.get('source');
  const requested = updates.candidates.find(
    (candidate) =>
      candidate.id === requestedBuild &&
      datasetCandidateQuerySource(candidate) === requestedSource,
  );
  const fallback =
    updates.candidates.find((candidate) => candidate.status === 'unreviewed') ??
    updates.candidates[0];
  const selected = requested ?? fallback;
  const staleSelection = Boolean(requestedBuild && !requested);
  const [report, setReport] = useState<DatasetImpactReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    endpoint: 'pinned' | 'current';
    plan: RecommendationPlan;
  } | null>(null);
  const updateTriggerRef = useRef<HTMLButtonElement>(null);

  const selectedValue = selected ? datasetCandidateValue(selected) : '';
  useEffect(() => {
    let active = true;
    setReport(null);
    setReportError(null);
    setPreview(null);
    setStatus(null);
    setDialogOpen(false);
    if (!updates.isHydrated || !selected) return () => { active = false; };
    setReportLoading(true);
    void updates.loadReport(selected.id).then((result) => {
      if (!active) return;
      if (result.status === 'ready') setReport(result.report);
      else setReportError(result.reason);
    }).catch((error: unknown) => {
      if (active) {
        setReportError(error instanceof Error ? error.message : 'Report failed to load.');
      }
    }).finally(() => {
      if (active) setReportLoading(false);
    });
    return () => { active = false; };
  }, [selected, updates.isHydrated, updates.loadReport]);

  const buildName = useMemo(
    () => selected?.profile.name ?? (selected ? `Level ${selected.profile.level} build` : ''),
    [selected],
  );

  const closeDialog = () => {
    setDialogOpen(false);
    window.setTimeout(() => updateTriggerRef.current?.focus(), 0);
  };

  if (!updates.isHydrated) {
    return <main className="dataset-updates-screen"><p>Loading owned builds and verified releases…</p></main>;
  }

  if (updates.candidates.length === 0) {
    return (
      <main className="dataset-updates-screen">
        <h1 data-screen-heading tabIndex={-1}>Dataset Updates</h1>
        <section className="dataset-updates-empty">
          <h2>No owned builds need review</h2>
          <p>Your builds already use the current verified dataset or their current reports were reviewed.</p>
          <div><Link to="/builds">Open Builds</Link><Link to="/character">Create Build</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="dataset-updates-screen">
      <header className="dataset-updates-heading">
        <p className="eyebrow">Verified release review</p>
        <h1 data-screen-heading tabIndex={-1}>Dataset Updates</h1>
        <p>Review facts and recommendation changes one build at a time. Updating remains optional.</p>
      </header>
      {staleSelection ? (
        <p className="dataset-selection-note" role="status">
          The linked build is no longer available. Showing the first build that still needs review.
        </p>
      ) : null}
      {updates.storageError ? <p role="alert">{updates.storageError}</p> : null}
      <div className="dataset-updates-layout">
        <DatasetUpdateBuildList
          candidates={updates.candidates}
          selectedValue={selectedValue}
          onSelect={(value) => {
            const separator = value.indexOf(':');
            const source = value.slice(0, separator);
            const build = value.slice(separator + 1);
            setSearchParams({ build, source });
          }}
        />
        <div className="dataset-impact-report" aria-live="polite">
          {reportLoading ? <p>Building a deterministic impact report…</p> : null}
          {reportError ? (
            <section className="dataset-report-blocked" role="status">
              <h2>Comparison unavailable</h2>
              <p>{reportError}</p>
              <button type="button" onClick={() => void updates.refresh()}>Retry data</button>
            </section>
          ) : null}
          {report && selected ? (
            <>
              <DatasetImpactSummary report={report} buildName={buildName} />
              <FactsChangedSection
                changes={report.facts}
                omitted={report.omittedFactChangeCount}
              />
              <PlanImpactSection impact={report.plan} />
              <ReleaseTrailSection
                steps={report.trail}
                onLoadPlan={(stepIndex) =>
                  updates.loadReleaseStepPlan(report, stepIndex)}
              />
              {report.unknowns.length > 0 ? (
                <section className="dataset-impact-section" aria-labelledby="impact-unknowns-heading">
                  <h2 id="impact-unknowns-heading">Known unknowns</h2>
                  <ul>{report.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul>
                </section>
              ) : null}
              {preview ? (
                <section className="dataset-impact-preview" aria-labelledby="planner-preview-heading">
                  <p className="eyebrow">Temporary · draft unchanged</p>
                  <h2 id="planner-preview-heading">
                    {preview.endpoint === 'pinned' ? 'Pinned' : 'Current'} planner preview
                  </h2>
                  <p><strong>{preview.plan.immediateAction.summary}</strong></p>
                  <p>
                    Dataset {preview.plan.datasetVersion} · Spend now{' '}
                    {preview.plan.statPlan.spendNow.points} points ·{' '}
                    {preview.plan.upgradeTargets.length} upgrade targets
                  </p>
                </section>
              ) : null}
              <section className="dataset-impact-actions" aria-labelledby="dataset-actions-heading">
                <h2 id="dataset-actions-heading">Actions</h2>
                <p>Reviewing or previewing never changes this build.</p>
                <div>
                  <button type="button" onClick={() => {
                    void updates.keepPinned(report).then(() => {
                      setStatus('Review saved. This build remains pinned.');
                    }).catch((error: unknown) => {
                      setStatus(error instanceof Error ? error.message : 'Review could not be saved.');
                    });
                  }}>Keep pinned</button>
                  <button type="button" onClick={() => {
                    setStatus('Loading pinned preview…');
                    void updates.loadPreview(report, 'pinned').then((plan) => {
                      setPreview({ endpoint: 'pinned', plan });
                      setStatus(`Temporary preview of ${report.pinned.version}; your draft was not changed.`);
                    }).catch((error: unknown) => {
                      setStatus(error instanceof Error ? error.message : 'Pinned preview failed.');
                    });
                  }}>Open pinned preview</button>
                  <button type="button" onClick={() => {
                    setStatus('Loading current preview…');
                    void updates.loadPreview(report, 'current').then((plan) => {
                      setPreview({ endpoint: 'current', plan });
                      setStatus(`Temporary preview of ${report.target.version}; your draft was not changed.`);
                    }).catch((error: unknown) => {
                      setStatus(error instanceof Error ? error.message : 'Current preview failed.');
                    });
                  }}>Open current preview</button>
                  <button
                    ref={updateTriggerRef}
                    type="button"
                    onClick={() => setDialogOpen(true)}
                  >
                    Update this build
                  </button>
                </div>
                {status ? <p role="status">{status}</p> : null}
              </section>
            </>
          ) : null}
        </div>
      </div>
      {dialogOpen && report ? (
        <ApplyDatasetUpdateDialog
          buildName={buildName}
          pinnedVersion={report.pinned.version}
          targetVersion={report.target.version}
          busy={busy}
          onCancel={closeDialog}
          onConfirm={() => {
            setBusy(true);
            void updates.applyUpdate(report).then(() => {
              setStatus('Dataset update applied. Recovery history is available.');
              closeDialog();
            }).catch((error: unknown) => {
              setStatus(error instanceof Error ? error.message : 'Dataset update failed.');
              closeDialog();
            }).finally(() => setBusy(false));
          }}
        />
      ) : null}
    </main>
  );
}
