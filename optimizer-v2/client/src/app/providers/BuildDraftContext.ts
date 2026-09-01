import { createContext, useContext } from 'react';
import type { CharacterProfile } from '../../domain/build/model';
import type { BuildRevisionSnapshot } from '../../domain/build/record';
import type {
  DraftPersistenceStatus,
  QuarantinedRecord,
} from '../../domain/planner/state';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';

export type BuildDraftContextValue = {
  draft: CharacterProfile;
  updateDraft(
    patch: Partial<CharacterProfile>,
    options?: { recordUndo?: boolean },
  ): void;
  replaceDraft(profile: CharacterProfile): void;
  saveNamedBuild(
    name: string,
    overrides?: Partial<CharacterProfile>,
  ): Promise<CharacterProfile>;
  saveBuild(
    request: SaveBuildRequest,
    overrides?: Partial<CharacterProfile>,
  ): Promise<CharacterProfile>;
  renameSavedBuild(id: string, name: string): Promise<void>;
  duplicateSavedBuild(id: string): Promise<CharacterProfile>;
  setBuildArchived(id: string, archived: boolean): Promise<void>;
  savePersonalPreset(
    source: CharacterProfile,
    name: string,
  ): Promise<CharacterProfile>;
  loadSavedBuildHistory(buildId: string): Promise<BuildRevisionSnapshot[]>;
  restoreSavedBuildRevision(
    buildId: string,
    revisionId: string,
  ): Promise<CharacterProfile>;
  quarantinedRecords: readonly QuarantinedRecord[];
  exportQuarantinedRecord(id: string): Promise<string | null>;
  deleteQuarantinedRecord(id: string): Promise<void>;
  resetDraft(): Promise<void>;
  isHydrated: boolean;
  hasActiveDraft: boolean;
  storageError: string | null;
  savedBuilds: GuestBuildListResult[];
  loadSavedBuild(profile: CharacterProfile): void;
  deleteSavedBuild(id: string): Promise<void>;
  persistenceStatus: DraftPersistenceStatus;
  canUndo: boolean;
  undoLastChange(): void;
  setCloudPersistenceStatus(
    status: 'sync-queued' | 'synced' | 'error' | null,
  ): void;
};

export type SaveBuildRequest = {
  name: string;
  mode: 'overwrite' | 'duplicate';
  destination: 'local' | 'cloud';
};

export const BuildDraftContext = createContext<BuildDraftContextValue | null>(
  null,
);

export function useBuildDraft(): BuildDraftContextValue {
  const value = useContext(BuildDraftContext);
  if (!value) {
    throw new Error('useBuildDraft must be used inside BuildDraftProvider');
  }
  return value;
}
