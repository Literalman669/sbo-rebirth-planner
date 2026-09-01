import { openDB } from 'idb';

export const DEFAULT_GUEST_DATABASE_NAME = 'sbo-rebirth-optimizer-v2';
export const GUEST_DATABASE_VERSION = 6;
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
  'build-revisions',
] as const;

export function openPlannerDatabase(
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
  { timeoutMs = 5_000 }: { timeoutMs?: number } = {},
) {
  let openedDatabase: Awaited<ReturnType<typeof openDB>> | null = null;
  let openingWasAbandoned = false;
  let rejectBlocked!: (reason: Error) => void;
  const blocked = new Promise<never>((_, reject) => {
    rejectBlocked = reject;
  });
  let timeoutId: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      openingWasAbandoned = true;
      reject(new Error(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE));
    }, Math.max(1, timeoutMs));
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
      openingWasAbandoned = true;
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
    if (openingWasAbandoned) {
      database.close();
      throw new Error(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE);
    }
    return database;
  });

  const result = Promise.race([opening, blocked, timedOut]).finally(() => {
    clearTimeout(timeoutId);
  });
  // Stores are created at module load but may not be read immediately. Mark the
  // rejection handled here while returning the same rejecting promise to the
  // provider that eventually consumes it.
  void result.catch(() => undefined);
  return result;
}
