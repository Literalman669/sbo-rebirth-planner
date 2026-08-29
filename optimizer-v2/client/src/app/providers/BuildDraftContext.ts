import { createContext, useContext } from 'react';
import type { CharacterProfile } from '../../domain/build/model';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';

export type BuildDraftContextValue = {
  draft: CharacterProfile;
  updateDraft(patch: Partial<CharacterProfile>): void;
  replaceDraft(profile: CharacterProfile): void;
  saveNamedBuild(name: string): Promise<CharacterProfile>;
  resetDraft(): Promise<void>;
  isHydrated: boolean;
  hasActiveDraft: boolean;
  storageError: string | null;
  savedBuilds: GuestBuildListResult[];
  loadSavedBuild(profile: CharacterProfile): void;
  deleteSavedBuild(id: string): Promise<void>;
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
