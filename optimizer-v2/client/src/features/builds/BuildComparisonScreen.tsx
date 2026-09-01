import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import {
  resolveDatasetSnapshot,
  useDataset,
} from '../../app/providers/DatasetProvider';
import {
  compareBuildEvaluations,
  evaluateBuildForComparison,
} from '../../domain/build/comparison';
import {
  findBuildLibraryEntry,
  mergeBuildLibrary,
  type BuildLibraryEntry,
} from '../../domain/build/library';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { BuildComparisonTable } from './BuildComparisonTable';
import { BuildWorkspaceNav } from './BuildWorkspaceNav';

type ResolvedDatasets = {
  key: string;
  left: DatasetSnapshot | null;
  right: DatasetSnapshot | null;
};

function buildName(entry: BuildLibraryEntry) {
  return entry.profile.name ?? `Level ${entry.profile.level} build`;
}

export function BuildComparisonScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { snapshot, getSnapshot } = useDataset();
  const { savedBuilds, isHydrated, replaceDraft } = useBuildDraft();
  const cloud = useOptionalCloudBuilds();
  const [mode, setMode] = useState<'historical' | 'current'>('historical');
  const [resolved, setResolved] = useState<ResolvedDatasets | null>(null);
  const entries = useMemo(
    () =>
      mergeBuildLibrary(savedBuilds, [
        ...(cloud?.cloudBuilds ?? []),
        ...(cloud?.archivedCloudBuilds ?? []),
      ]),
    [cloud?.archivedCloudBuilds, cloud?.cloudBuilds, savedBuilds],
  );
  const leftId = searchParams.get('left') ?? '';
  const rightId = searchParams.get('right') ?? '';
  const leftEntry = findBuildLibraryEntry(entries, leftId);
  const rightEntry = findBuildLibraryEntry(entries, rightId);
  const resolutionKey = `${mode}:${leftEntry?.id ?? ''}:${leftEntry?.profile.datasetVersion ?? ''}:${rightEntry?.id ?? ''}:${rightEntry?.profile.datasetVersion ?? ''}:${snapshot.version}`;

  useEffect(() => {
    let active = true;
    if (!leftEntry || !rightEntry || leftEntry.id === rightEntry.id) {
      setResolved(null);
      return () => {
        active = false;
      };
    }
    const leftPromise = mode === 'current'
      ? Promise.resolve(snapshot)
      : resolveDatasetSnapshot(getSnapshot, leftEntry.profile.datasetVersion);
    const rightPromise = mode === 'current'
      ? Promise.resolve(snapshot)
      : resolveDatasetSnapshot(getSnapshot, rightEntry.profile.datasetVersion);
    void Promise.all([leftPromise, rightPromise]).then(([left, right]) => {
      if (active) setResolved({ key: resolutionKey, left, right });
    });
    return () => {
      active = false;
    };
  }, [
    getSnapshot,
    leftEntry?.id,
    leftEntry?.profile.datasetVersion,
    mode,
    resolutionKey,
    rightEntry?.id,
    rightEntry?.profile.datasetVersion,
    snapshot,
  ]);

  const comparison = useMemo(() => {
    if (
      !leftEntry ||
      !rightEntry ||
      !resolved ||
      resolved.key !== resolutionKey
    ) {
      return null;
    }
    const leftProfile = mode === 'current'
      ? { ...leftEntry.profile, datasetVersion: snapshot.version }
      : leftEntry.profile;
    const rightProfile = mode === 'current'
      ? { ...rightEntry.profile, datasetVersion: snapshot.version }
      : rightEntry.profile;
    return compareBuildEvaluations(
      evaluateBuildForComparison(leftProfile, resolved.left),
      evaluateBuildForComparison(rightProfile, resolved.right),
    );
  }, [leftEntry, mode, resolutionKey, resolved, rightEntry, snapshot.version]);

  const setSelection = (side: 'left' | 'right', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(side, value);
    else next.delete(side);
    setMode('historical');
    setSearchParams(next);
  };

  const createDraftFromPreview = (entry: BuildLibraryEntry) => {
    const name = `${buildName(entry)} preview`.slice(0, 60);
    replaceDraft({
      ...structuredClone(entry.profile),
      id: crypto.randomUUID(),
      name,
      datasetVersion: snapshot.version,
    });
    navigate('/character');
  };

  if (!isHydrated) return <main className="build-comparison-screen"><p>Loading builds…</p></main>;

  return (
    <main className="build-comparison-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Side-by-side evidence</p>
        <h2 data-screen-heading tabIndex={-1}>Compare Builds</h2>
        <p>Compare exactly two saved builds without changing either source.</p>
      </header>
      <BuildWorkspaceNav />
      <section className="build-comparison-selectors" aria-label="Build selection">
        <label>
          <span>First build</span>
          <select
            aria-label="First build"
            value={leftId}
            onChange={(event) => setSelection('left', event.target.value)}
          >
            <option value="">Choose first build</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id} disabled={entry.id === rightId}>
                {buildName(entry)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Second build</span>
          <select
            aria-label="Second build"
            value={rightId}
            onChange={(event) => setSelection('right', event.target.value)}
          >
            <option value="">Choose second build</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id} disabled={entry.id === leftId}>
                {buildName(entry)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!leftEntry || !rightEntry || leftEntry.id === rightEntry.id}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set('left', rightId);
            next.set('right', leftId);
            setSearchParams(next);
          }}
        >
          Swap builds
        </button>
      </section>
      {leftEntry && rightEntry && leftEntry.id === rightEntry.id ? (
        <p role="alert">Choose two different builds.</p>
      ) : null}
      {leftEntry && rightEntry ? (
        <section className="comparison-mode" aria-label="Dataset comparison mode">
          <p>
            {mode === 'historical'
              ? 'Each build uses its pinned verified dataset.'
              : `Temporary preview using dataset ${snapshot.version}; saved builds are unchanged.`}
          </p>
          {mode === 'historical' ? (
            <button
              type="button"
              onClick={() => setMode('current')}
            >
              Preview both with dataset {snapshot.version}
            </button>
          ) : (
            <button type="button" onClick={() => setMode('historical')}>
              Return to pinned datasets
            </button>
          )}
        </section>
      ) : (
        <p className="empty-state">Choose two saved builds to compare.</p>
      )}
      {leftEntry && rightEntry && !comparison ? <p>Loading verified datasets…</p> : null}
      {comparison ? <BuildComparisonTable comparison={comparison} /> : null}
      {mode === 'current' && comparison ? (
        <div className="build-comparison-actions">
          <button
            type="button"
            disabled={comparison.left.status !== 'ready'}
            onClick={() => createDraftFromPreview(leftEntry!)}
          >
            Create draft from {buildName(leftEntry!)} preview
          </button>
          <button
            type="button"
            disabled={comparison.right.status !== 'ready'}
            onClick={() => createDraftFromPreview(rightEntry!)}
          >
            Create draft from {buildName(rightEntry!)} preview
          </button>
        </div>
      ) : null}
    </main>
  );
}
