import type { CharacterProfile } from './model';

export type SavedBuildKind = 'build' | 'personal-preset';

export interface BuildRevisionSnapshot {
  id: string;
  buildId: string;
  parentRevisionId?: string;
  kind: SavedBuildKind;
  profile: CharacterProfile;
  createdAt: string;
}

export interface SavedBuildRecord {
  profile: CharacterProfile;
  kind: SavedBuildKind;
  headRevisionId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
