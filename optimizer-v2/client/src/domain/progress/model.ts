export const MAX_PROGRESS_OBJECTIVES = 200;
export const MAX_PROGRESS_HISTORY = 1_000;

export type ProgressTaskCategory =
  | 'stat-allocation'
  | 'equipment-upgrade'
  | 'level-milestone'
  | 'floor-milestone'
  | 'manual-objective';

export type ProgressObjectiveStatus = 'pending' | 'completed' | 'skipped';

export type ProgressEventOutcome =
  | 'completed'
  | 'skipped'
  | 'reopened'
  | 'superseded';

export type ProgressEventSource = 'automatic' | 'manual' | 'legacy';

export interface ProgressObjectiveState {
  actionKey: string;
  category: ProgressTaskCategory;
  status: ProgressObjectiveStatus;
  source: ProgressEventSource;
  planFingerprint: string;
  updatedAt?: string;
  note?: string;
}

export interface ProgressHistoryEvent {
  id: string;
  actionKey: string;
  category: ProgressTaskCategory;
  label: string;
  outcome: ProgressEventOutcome;
  source: ProgressEventSource;
  planFingerprint: string;
  datasetVersion?: string;
  occurredAt?: string;
  note?: string;
}

export interface ProgressWallet {
  balance: number;
  updatedAt: string;
}

export interface PlanProgress {
  schemaVersion: 2;
  buildId: string;
  wallet?: ProgressWallet;
  objectives: ProgressObjectiveState[];
  history: ProgressHistoryEvent[];
  currentPlanFingerprint?: string;
  reconciledThroughLevel?: number;
  acknowledgedDatasetVersion?: string;
}
