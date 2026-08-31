import { useMemo, useRef, type PropsWithChildren } from 'react';
import { SpacetimeDBProvider, useTable } from 'spacetimedb/react';
import { tables } from '../../module_bindings';
import { createConnectionBuilder } from '../../infrastructure/spacetime/connection';
import {
  createPlanProgressSelector,
  createPreferenceSelector,
  createInventorySelector,
} from '../../infrastructure/cloud/buildMappers';
import { useAuthSession } from './AuthContext';
import { CloudDataContext, type CloudDataState } from './CloudDataContext';

const guestCloudData: CloudDataState = {
  isAuthenticated: false,
  isReady: true,
  profiles: [],
  builds: [],
  revisions: [],
  equipment: [],
  ownedItems: [],
  planProgress: [],
  preferences: null,
  inventory: null,
  inventoryRows: [],
};

function PrivateCloudSubscription({ children }: PropsWithChildren) {
  const [profiles, profilesReady] = useTable(tables.myProfile);
  const [builds, buildsReady] = useTable(tables.myBuilds);
  const [revisions, revisionsReady] = useTable(tables.myBuildRevisions);
  const [equipment, equipmentReady] = useTable(tables.myRevisionEquipment);
  const [ownedItems, ownedItemsReady] = useTable(tables.myRevisionOwnedItems);
  const [progressRows, progressReady] = useTable(tables.myPlanProgress);
  const [preferenceRows, preferencesReady] = useTable(
    tables.myUserPreferences,
  );
  const [inventoryRows, inventoryReady] = useTable(tables.myUserInventory);
  const progressSelectorRef = useRef(createPlanProgressSelector());
  const preferenceSelectorRef = useRef(createPreferenceSelector());
  const inventorySelectorRef = useRef(createInventorySelector());
  const planProgress = useMemo(
    () => progressSelectorRef.current.select(progressRows),
    [progressRows],
  );
  const preferences = useMemo(
    () => preferenceSelectorRef.current.select(preferenceRows),
    [preferenceRows],
  );
  const inventory = useMemo(
    () => inventorySelectorRef.current.select(inventoryRows),
    [inventoryRows],
  );
  const value = useMemo<CloudDataState>(
    () => ({
      isAuthenticated: true,
      isReady:
        profilesReady &&
        buildsReady &&
        revisionsReady &&
        equipmentReady &&
        ownedItemsReady &&
        progressReady &&
        preferencesReady &&
        inventoryReady,
      profiles,
      builds,
      revisions,
      equipment,
      ownedItems,
      planProgress,
      preferences,
      inventory,
      inventoryRows,
    }),
    [
      builds,
      buildsReady,
      equipment,
      equipmentReady,
      ownedItems,
      ownedItemsReady,
      planProgress,
      preferences,
      preferencesReady,
      inventory,
      inventoryReady,
      inventoryRows,
      profiles,
      profilesReady,
      revisions,
      revisionsReady,
      progressReady,
    ],
  );

  return (
    <CloudDataContext.Provider value={value}>
      {children}
    </CloudDataContext.Provider>
  );
}

export function CloudDataProvider({ children }: PropsWithChildren) {
  const { status, idToken } = useAuthSession();
  const builder = useMemo(() => createConnectionBuilder(idToken), [idToken]);
  const isAuthenticated = status === 'authenticated' && Boolean(idToken);

  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      {isAuthenticated ? (
        <PrivateCloudSubscription>{children}</PrivateCloudSubscription>
      ) : (
        <CloudDataContext.Provider value={guestCloudData}>
          {children}
        </CloudDataContext.Provider>
      )}
    </SpacetimeDBProvider>
  );
}
