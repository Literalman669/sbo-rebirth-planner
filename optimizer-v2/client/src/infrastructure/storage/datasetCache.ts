import type { DatasetSnapshot } from '../../domain/dataset/model';
import { datasetSnapshotSchema } from '../../domain/dataset/schema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  openPlannerDatabase,
} from './plannerDatabase';

export interface DatasetCache {
  put(snapshot: DatasetSnapshot): Promise<void>;
  get(version: string): Promise<DatasetSnapshot | null>;
  getLatest(): Promise<DatasetSnapshot | null>;
  pruneExcept(versionsToKeep: ReadonlySet<string>): Promise<void>;
}

type DatasetCacheOptions = { databaseName?: string };

export function createDatasetCache({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
}: DatasetCacheOptions = {}): DatasetCache {
  const databasePromise = openPlannerDatabase(databaseName);

  return {
    async put(snapshot) {
      const valid = datasetSnapshotSchema.parse(snapshot);
      const database = await databasePromise;
      await database.put('dataset-releases', valid, valid.version);
    },

    async get(version) {
      const database = await databasePromise;
      const parsed = datasetSnapshotSchema.safeParse(
        await database.get('dataset-releases', version),
      );
      return parsed.success ? parsed.data : null;
    },

    async getLatest() {
      const database = await databasePromise;
      const snapshots = (await database.getAll('dataset-releases'))
        .map((row) => datasetSnapshotSchema.safeParse(row))
        .filter((result) => result.success)
        .map((result) => result.data)
        .sort(
          (left, right) =>
            right.publishedAt.localeCompare(left.publishedAt) ||
            right.version.localeCompare(left.version),
        );
      return snapshots[0] ?? null;
    },

    async pruneExcept(versionsToKeep) {
      const database = await databasePromise;
      const transaction = database.transaction('dataset-releases', 'readwrite');
      for (const key of await transaction.store.getAllKeys()) {
        if (!versionsToKeep.has(String(key))) await transaction.store.delete(key);
      }
      await transaction.done;
    },
  };
}
