import { openDB } from 'idb';

export const DEFAULT_GUEST_DATABASE_NAME = 'sbo-rebirth-optimizer-v2';
export const GUEST_DATABASE_VERSION = 4;

const PLANNER_STORE_NAMES = [
  'draft',
  'builds',
  'pending-revisions',
  'dataset-releases',
  'planner-preferences',
  'plan-progress',
  'pending-planner-state',
  'quarantine',
] as const;

export function openPlannerDatabase(
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
) {
  return openDB(databaseName, GUEST_DATABASE_VERSION, {
    upgrade(database) {
      for (const storeName of PLANNER_STORE_NAMES) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      }
    },
  });
}
