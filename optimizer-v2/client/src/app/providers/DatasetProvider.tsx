import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';
import { useOptionalPublicDataset } from '../../infrastructure/spacetime/PublicDataProvider';
import type { DatasetSource } from '../../infrastructure/spacetime/datasetSelection';

export type DatasetContextValue = {
  snapshot: DatasetSnapshot;
  source: DatasetSource;
  getSnapshot(version: string): Promise<DatasetSnapshot | null>;
};

type DatasetProviderProps = PropsWithChildren<{
  snapshot?: unknown;
  historicalSnapshots?: readonly unknown[];
}>;

export const DatasetContext = createContext<DatasetContextValue | null>(null);

export async function resolveDatasetSnapshot(
  resolver: (version: string) => Promise<DatasetSnapshot | null>,
  version: string,
): Promise<DatasetSnapshot | null> {
  try {
    return await resolver(version);
  } catch {
    return null;
  }
}

export function DatasetProvider({
  children,
  snapshot,
  historicalSnapshots = [],
}: DatasetProviderProps) {
  const publicDataset = useOptionalPublicDataset();
  const selectedSnapshot = snapshot ?? publicDataset?.snapshot ?? fallbackRelease;
  const source = snapshot ? 'bundled' : (publicDataset?.source ?? 'bundled');
  const parsed = useMemo(
    () => datasetSnapshotSchema.safeParse(selectedSnapshot),
    [selectedSnapshot],
  );
  const parsedHistorical = useMemo(
    () =>
      historicalSnapshots.flatMap((candidate) => {
        const result = datasetSnapshotSchema.safeParse(candidate);
        return result.success ? [result.data] : [];
      }),
    [historicalSnapshots],
  );
  const getSnapshot = useCallback(
    async (version: string) => {
      if (parsed.success && parsed.data.version === version) return parsed.data;
      const historical = parsedHistorical.find(
        (candidate) => candidate.version === version,
      );
      if (historical) return historical;
      return publicDataset?.getSnapshot(version) ?? null;
    },
    [parsed, parsedHistorical, publicDataset],
  );

  if (!parsed.success) {
    return (
      <main className="app-shell">
        <h1>Verified game data could not be loaded</h1>
      </main>
    );
  }

  return (
    <DatasetContext.Provider
      value={{ snapshot: parsed.data, source, getSnapshot }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset(): DatasetContextValue {
  const value = useContext(DatasetContext);
  if (!value) {
    throw new Error('useDataset must be used inside DatasetProvider');
  }
  return value;
}
