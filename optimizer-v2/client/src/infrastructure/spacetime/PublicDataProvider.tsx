import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useTable } from 'spacetimedb/react';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';
import { tables } from '../../module_bindings';
import {
  createDatasetCache,
  type DatasetCache,
} from '../storage/datasetCache';
import { mapPublishedRelease } from './datasetMapper';
import {
  selectPreferredDataset,
  type DatasetSelection,
  type DatasetSource,
} from './datasetSelection';
import type { DatasetRelease } from './releaseSelection';

export type PublicDatasetState = DatasetSelection & {
  release: DatasetRelease;
  isReady: boolean;
  warning: string | null;
};

const bundledSnapshot = datasetSnapshotSchema.parse(bootstrapRelease);
const PublicDatasetContext = createContext<PublicDatasetState | null>(null);

function releaseFromSnapshot(snapshot: DatasetSnapshot): DatasetRelease {
  return {
    version: snapshot.version,
    formulaSetVersion: snapshot.formulaSetVersion,
    sourceSummary: snapshot.sourceSummary,
    publishedAtMicros: BigInt(new Date(snapshot.publishedAt).getTime()) * 1000n,
    lastReviewedAt: snapshot.lastReviewedAt,
  };
}

function PublicDatasetSubscription({
  children,
  cache,
  bundled,
}: PropsWithChildren<{
  cache: DatasetCache;
  bundled: DatasetSnapshot;
}>) {
  const [releaseRows, releasesReady] = useTable(tables.datasetRelease);
  const [equipmentRows, equipmentReady] = useTable(tables.equipment);
  const [formulaRows, formulasReady] = useTable(tables.formula);
  const [sourceRows, sourcesReady] = useTable(tables.sourceReference);
  const allReady =
    releasesReady && equipmentReady && formulasReady && sourcesReady;
  const [selection, setSelection] = useState<DatasetSelection>({
    snapshot: bundled,
    source: 'bundled',
  });
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void cache.getLatest().then((cached) => {
      if (!active || !cached) return;
      setSelection((current) =>
        selectPreferredDataset(current, { snapshot: cached, source: 'cached' }),
      );
    });
    return () => {
      active = false;
    };
  }, [cache]);

  useEffect(() => {
    if (!allReady) return;
    const currentRows = releaseRows.filter((release) => release.isCurrent);
    if (currentRows.length !== 1) {
      setWarning(
        currentRows.length === 0
          ? 'Live dataset is unavailable; using the last valid local release.'
          : 'Live dataset state is ambiguous; using the last valid local release.',
      );
      return;
    }
    try {
      const snapshot = mapPublishedRelease(
        currentRows[0]!,
        equipmentRows,
        formulaRows,
        sourceRows,
      );
      setSelection((current) =>
        selectPreferredDataset(current, { snapshot, source: 'live' }),
      );
      setWarning(null);
      void cache.put(snapshot).catch(() => {
        setWarning('Live data is valid, but its offline cache could not be updated.');
      });
    } catch {
      setWarning(
        'Live dataset failed complete validation; using the last valid local release.',
      );
    }
  }, [
    allReady,
    cache,
    equipmentRows,
    formulaRows,
    releaseRows,
    sourceRows,
  ]);

  const value = useMemo<PublicDatasetState>(
    () => ({
      ...selection,
      release: releaseFromSnapshot(selection.snapshot),
      isReady: allReady,
      warning,
    }),
    [allReady, selection, warning],
  );
  return (
    <PublicDatasetContext.Provider value={value}>
      {children}
    </PublicDatasetContext.Provider>
  );
}

export function PublicDataProvider({
  children,
  cache,
  bundled = bundledSnapshot,
}: PropsWithChildren<{
  cache?: DatasetCache;
  bundled?: DatasetSnapshot;
}>) {
  const resolvedCache = useMemo(() => cache ?? createDatasetCache(), [cache]);
  return (
    <PublicDatasetSubscription cache={resolvedCache} bundled={bundled}>
      {children}
    </PublicDatasetSubscription>
  );
}

export function useOptionalPublicDataset(): PublicDatasetState | null {
  return useContext(PublicDatasetContext);
}

export function usePublicRelease(): {
  release: DatasetRelease;
  source: DatasetSource;
  isReady: boolean;
  warning: string | null;
} {
  const value = useContext(PublicDatasetContext);
  if (!value) {
    throw new Error('usePublicRelease must be used inside PublicDataProvider');
  }
  return {
    release: value.release,
    source: value.source,
    isReady: value.isReady,
    warning: value.warning,
  };
}
