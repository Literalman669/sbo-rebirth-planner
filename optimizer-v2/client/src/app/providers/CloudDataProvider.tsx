import { useMemo, type PropsWithChildren } from 'react';
import { SpacetimeDBProvider, useTable } from 'spacetimedb/react';
import { tables } from '../../module_bindings';
import { createConnectionBuilder } from '../../infrastructure/spacetime/connection';
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
};

function PrivateCloudSubscription({ children }: PropsWithChildren) {
  const [profiles, profilesReady] = useTable(tables.myProfile);
  const [builds, buildsReady] = useTable(tables.myBuilds);
  const [revisions, revisionsReady] = useTable(tables.myBuildRevisions);
  const [equipment, equipmentReady] = useTable(tables.myRevisionEquipment);
  const [ownedItems, ownedItemsReady] = useTable(tables.myRevisionOwnedItems);
  const value = useMemo<CloudDataState>(
    () => ({
      isAuthenticated: true,
      isReady:
        profilesReady &&
        buildsReady &&
        revisionsReady &&
        equipmentReady &&
        ownedItemsReady,
      profiles,
      builds,
      revisions,
      equipment,
      ownedItems,
    }),
    [
      builds,
      buildsReady,
      equipment,
      equipmentReady,
      ownedItems,
      ownedItemsReady,
      profiles,
      profilesReady,
      revisions,
      revisionsReady,
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
