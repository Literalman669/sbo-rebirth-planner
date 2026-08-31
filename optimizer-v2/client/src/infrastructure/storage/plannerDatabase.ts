import { openDB } from 'idb';

export const DEFAULT_GUEST_DATABASE_NAME = 'sbo-rebirth-optimizer-v2';
export const GUEST_DATABASE_VERSION = 5;
export const LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE =
  'Close other SBO planner tabs, then reload this page to finish the local data upgrade.';

const PLANNER_STORE_NAMES = [
  'draft',
  'builds',
  'pending-revisions',
  'dataset-releases',
  'planner-preferences',
  'plan-progress',
  'pending-planner-state',
  'quarantine',
  'inventory',
] as const;

export function openPlannerDatabase(
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
) {
  let openedDatabase: Awaited<ReturnType<typeof openDB>> | null = null;
  let upgradeWasBlocked = false;
  let rejectBlocked!: (reason: Error) => void;
  const blocked = new Promise<never>((_, reject) => {
    rejectBlocked = reject;
  });
  const opening = openDB(databaseName, GUEST_DATABASE_VERSION, {
    upgrade(database) {
      for (const storeName of PLANNER_STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      }
    },
    blocked() {
      upgradeWasBlocked = true;
      rejectBlocked(new Error(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE));
    },
    blocking() {
      openedDatabase?.close();
    },
    terminated() {
      openedDatabase = null;
    },
  }).then((database) => {
    openedDatabase = database;
    if (upgradeWasBlocked) {
      database.close();
      throw new Error(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE);
    }
    return database;
  });

  return Promise.race([opening, blocked]);
}
