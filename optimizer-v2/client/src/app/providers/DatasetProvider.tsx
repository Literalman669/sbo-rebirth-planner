import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';
import { useOptionalPublicDataset } from '../../infrastructure/spacetime/PublicDataProvider';
import type { DatasetSource } from '../../infrastructure/spacetime/datasetSelection';

export type DatasetContextValue = {
  snapshot: DatasetSnapshot;
  source: DatasetSource;
};

type DatasetProviderProps = PropsWithChildren<{
  snapshot?: unknown;
}>;

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({
  children,
  snapshot,
}: DatasetProviderProps) {
  const publicDataset = useOptionalPublicDataset();
  const selectedSnapshot = snapshot ?? publicDataset?.snapshot ?? bootstrapRelease;
  const source = snapshot ? 'bundled' : (publicDataset?.source ?? 'bundled');
  const parsed = useMemo(
    () => datasetSnapshotSchema.safeParse(selectedSnapshot),
    [selectedSnapshot],
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
      value={{ snapshot: parsed.data, source }}
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
