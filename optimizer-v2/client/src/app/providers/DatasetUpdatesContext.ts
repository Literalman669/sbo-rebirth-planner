import { createContext, useContext } from 'react';
import type { DatasetImpactCandidate } from '../../domain/datasetImpact/candidates';
import type { DatasetImpactReport } from '../../domain/datasetImpact/report';

export type DatasetImpactReportResult =
  | { status: 'ready'; report: DatasetImpactReport }
  | { status: 'blocked'; reason: string };

export interface DatasetUpdatesState {
  candidates: readonly DatasetImpactCandidate[];
  unreviewedCount: number;
  isHydrated: boolean;
  storageError: string | null;
  loadReport(candidateId: string): Promise<DatasetImpactReportResult>;
  keepPinned(report: DatasetImpactReport): Promise<void>;
  applyUpdate(report: DatasetImpactReport): Promise<void>;
  refresh(): Promise<void>;
}

export const DatasetUpdatesContext = createContext<DatasetUpdatesState | null>(
  null,
);

export function useOptionalDatasetUpdates(): DatasetUpdatesState | null {
  return useContext(DatasetUpdatesContext);
}

export function useDatasetUpdates(): DatasetUpdatesState {
  const value = useOptionalDatasetUpdates();
  if (!value) {
    throw new Error(
      'useDatasetUpdates must be used inside DatasetUpdatesProvider',
    );
  }
  return value;
}
