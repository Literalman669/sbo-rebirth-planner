import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useTable } from 'spacetimedb/react';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';
import { tables } from '../../module_bindings';
import {
  createDatasetCache,
  type DatasetCache,
} from '../storage/datasetCache';
import { mapPublishedRelease, mapPublishedReleaseV2 } from './datasetMapper';
import {
  isCuratedReleaseVersion,
  selectPreferredDataset,
  type DatasetSelection,
  type DatasetSource,
} from './datasetSelection';
import type { DatasetRelease } from './releaseSelection';
import {
  buildDatasetReleaseIndex,
  type DatasetReleaseDescriptor,
} from '../../domain/datasetImpact/releaseIndex';

export type PublicDatasetState = DatasetSelection & {
  release: DatasetRelease;
  isReady: boolean;
  warning: string | null;
  getSnapshot(version: string): Promise<DatasetSnapshot | null>;
  listReleases(): Promise<DatasetReleaseDescriptor[]>;
};

const bundledSnapshot = datasetSnapshotSchema.parse(fallbackRelease);
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
  const [catalogRows, catalogReady] = useTable(tables.catalogEquipment);
  const [aliasRows, aliasesReady] = useTable(tables.equipmentAlias);
  const [acquisitionRows, acquisitionsReady] = useTable(
    tables.equipmentAcquisition,
  );
  const [resistanceRows, resistancesReady] = useTable(
    tables.equipmentResistance,
  );
  const [effectRows, effectsReady] = useTable(tables.equipmentSpecialEffect);
  const [mechanicRows, mechanicsReady] = useTable(tables.mechanic);
  const [policyRows, policiesReady] = useTable(tables.releaseStrategyPolicy);
  const allReady =
    releasesReady &&
    equipmentReady &&
    formulasReady &&
    sourcesReady &&
    catalogReady &&
    aliasesReady &&
    acquisitionsReady &&
    resistancesReady &&
    effectsReady &&
    mechanicsReady &&
    policiesReady;
  const [selection, setSelection] = useState<DatasetSelection>({
    snapshot: bundled,
    source: 'bundled',
  });
  const [warning, setWarning] = useState<string | null>(null);
  const [liveSnapshots, setLiveSnapshots] = useState<
    ReadonlyMap<string, DatasetSnapshot>
  >(() => new Map([[bundled.version, bundled]]));

  useEffect(() => {
    let active = true;
    void cache
      .getLatest()
      .then((cached) => {
        if (!active || !cached) return;
        setSelection((current) =>
          selectPreferredDataset(current, {
            snapshot: cached,
            source: 'cached',
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cache]);

  useEffect(() => {
    if (!allReady) return;
    const currentRows = releaseRows.filter(
      (release) =>
        release.isCurrent && isCuratedReleaseVersion(release.version),
    );
    if (currentRows.length !== 1) {
      setWarning(
        currentRows.length === 0
          ? 'Live dataset is unavailable; using the last valid local release.'
          : 'Live dataset state is ambiguous; using the last valid local release.',
      );
      return;
    }
    const mapped = new Map<string, DatasetSnapshot>();
    for (const release of releaseRows) {
      if (!isCuratedReleaseVersion(release.version)) continue;
      try {
        const snapshot =
          release.formulaSetVersion === 'sbor-stats-v2'
            ? mapPublishedReleaseV2({
                release,
                catalogEquipment: catalogRows,
                aliases: aliasRows,
                acquisitions: acquisitionRows,
                resistances: resistanceRows,
                effects: effectRows,
                mechanics: mechanicRows,
                policy:
                  policyRows.find(
                    (policy) => policy.releaseVersion === release.version,
                  ) ?? (() => {
                    throw new Error('Catalog release has no strategy policy');
                  })(),
                sources: sourceRows,
              })
            : mapPublishedRelease(
                release,
                equipmentRows,
                formulaRows,
                sourceRows,
              );
        mapped.set(snapshot.version, snapshot);
        void cache.put(snapshot).catch(() => {
          setWarning(
            'Live data is valid, but its offline cache could not be updated.',
          );
        });
      } catch {
        // One invalid historical release must not replace or hide valid releases.
      }
    }
    setLiveSnapshots(mapped);
    const snapshot = mapped.get(currentRows[0]!.version);
    if (snapshot) {
      setSelection((current) =>
        selectPreferredDataset(current, { snapshot, source: 'live' }),
      );
      setWarning(null);
    } else {
      setWarning(
        'Live dataset failed complete validation; using the last valid local release.',
      );
    }
  }, [
    allReady,
    acquisitionRows,
    aliasRows,
    cache,
    catalogRows,
    equipmentRows,
    effectRows,
    formulaRows,
    mechanicRows,
    policyRows,
    releaseRows,
    resistanceRows,
    sourceRows,
  ]);

  const getSnapshot = useCallback(
    async (version: string) => {
      if (selection.snapshot.version === version) return selection.snapshot;
      if (bundled.version === version) return bundled;
      const live = liveSnapshots.get(version);
      if (live) return live;
      return cache.get(version);
    },
    [bundled, cache, liveSnapshots, selection.snapshot],
  );
  const listReleases = useCallback(async () => {
    const cached = await cache.list();
    return buildDatasetReleaseIndex([
      { snapshot: bundled, availability: 'bundled' },
      ...cached.map((snapshot) => ({
        snapshot,
        availability: 'cached' as const,
      })),
      ...[...liveSnapshots.values()].map((snapshot) => ({
        snapshot,
        availability: 'live' as const,
      })),
    ]);
  }, [bundled, cache, liveSnapshots]);

  const value = useMemo<PublicDatasetState>(
    () => ({
      ...selection,
      release: releaseFromSnapshot(selection.snapshot),
      isReady: allReady,
      warning,
      getSnapshot,
      listReleases,
    }),
    [allReady, getSnapshot, listReleases, selection, warning],
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
