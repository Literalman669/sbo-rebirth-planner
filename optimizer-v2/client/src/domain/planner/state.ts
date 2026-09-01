export type PlannerPreferences = {
  schemaVersion: 1;
  mode: 'beginner' | 'detailed';
  density: 'comfortable' | 'compact';
  showAllLevels: boolean;
  compactWeaponPathsAfterFirstUse: boolean;
};

export type { PlanProgress } from '../progress/model';

export type DraftPersistenceStatus =
  | 'idle'
  | 'saving'
  | 'saved-local'
  | 'sync-queued'
  | 'synced'
  | 'error';

export type QuarantinedRecord = {
  id: string;
  kind: string;
  rawJson: string;
  quarantinedAt: string;
};
