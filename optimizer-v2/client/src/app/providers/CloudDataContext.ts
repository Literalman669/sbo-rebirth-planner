import { createContext, useContext } from 'react';
import type { Infer } from 'spacetimedb';
import MyBuildRevisionsRow from '../../module_bindings/my_build_revisions_table';
import MyBuildsRow from '../../module_bindings/my_builds_table';
import MyProfileRow from '../../module_bindings/my_profile_table';
import MyRevisionEquipmentRow from '../../module_bindings/my_revision_equipment_table';
import MyRevisionOwnedItemsRow from '../../module_bindings/my_revision_owned_items_table';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';

export interface CloudDataState {
  isAuthenticated: boolean;
  isReady: boolean;
  profiles: readonly Infer<typeof MyProfileRow>[];
  builds: readonly Infer<typeof MyBuildsRow>[];
  revisions: readonly Infer<typeof MyBuildRevisionsRow>[];
  equipment: readonly Infer<typeof MyRevisionEquipmentRow>[];
  ownedItems: readonly Infer<typeof MyRevisionOwnedItemsRow>[];
  planProgress: readonly PlanProgress[];
  preferences: PlannerPreferences | null;
}

export const CloudDataContext = createContext<CloudDataState | null>(null);

export function useCloudData(): CloudDataState {
  const value = useContext(CloudDataContext);
  if (!value) throw new Error('useCloudData must be used inside CloudDataProvider');
  return value;
}
