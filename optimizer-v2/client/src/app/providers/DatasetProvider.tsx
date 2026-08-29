import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';

export type DatasetContextValue = {
  snapshot: DatasetSnapshot;
  source: 'bundled';
};

type DatasetProviderProps = PropsWithChildren<{
  snapshot?: unknown;
}>;

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({
  children,
  snapshot = bootstrapRelease,
}: DatasetProviderProps) {
  const parsed = useMemo(
    () => datasetSnapshotSchema.safeParse(snapshot),
    [snapshot],
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
      value={{ snapshot: parsed.data, source: 'bundled' }}
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
