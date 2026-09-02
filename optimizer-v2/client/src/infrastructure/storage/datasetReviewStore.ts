import { z } from 'zod';
import {
  datasetReviewReceiptSchema,
  type DatasetReviewReceipt,
} from '../../domain/datasetImpact/reviewReceipt';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  openPlannerDatabase,
} from './plannerDatabase';

export interface DatasetReviewStore {
  list(): Promise<DatasetReviewReceipt[]>;
  load(buildId: string): Promise<DatasetReviewReceipt | null>;
  save(receipt: DatasetReviewReceipt): Promise<void>;
  delete(buildId: string): Promise<void>;
}

type DatasetReviewStoreOptions = {
  databaseName?: string;
  now?: () => string;
};

const buildIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));

export function createDatasetReviewStore({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
  now = () => new Date().toISOString(),
}: DatasetReviewStoreOptions = {}): DatasetReviewStore {
  const databasePromise = openPlannerDatabase(databaseName);

  async function quarantineAndDelete(key: IDBValidKey, raw: unknown) {
    const database = await databasePromise;
    const transaction = database.transaction(
      ['dataset-review-receipts', 'quarantine'],
      'readwrite',
    );
    const id = `dataset-review-receipt:${crypto.randomUUID()}`;
    await transaction.objectStore('quarantine').put(
      {
        id,
        kind: 'dataset-review-receipt',
        rawJson: JSON.stringify(raw),
        quarantinedAt: now(),
      },
      id,
    );
    await transaction.objectStore('dataset-review-receipts').delete(key);
    await transaction.done;
  }

  return {
    async list() {
      const database = await databasePromise;
      const transaction = database.transaction(
        'dataset-review-receipts',
        'readonly',
      );
      const [rows, keys] = await Promise.all([
        transaction.store.getAll(),
        transaction.store.getAllKeys(),
      ]);
      await transaction.done;
      const valid: DatasetReviewReceipt[] = [];
      for (const [index, row] of rows.entries()) {
        const parsed = datasetReviewReceiptSchema.safeParse(row);
        if (parsed.success) valid.push(parsed.data);
        else await quarantineAndDelete(keys[index]!, row);
      }
      return valid.sort((left, right) =>
        left.buildId.localeCompare(right.buildId),
      );
    },

    async load(buildId) {
      const validBuildId = buildIdSchema.parse(buildId);
      const database = await databasePromise;
      const raw = await database.get('dataset-review-receipts', validBuildId);
      if (raw === undefined) return null;
      const parsed = datasetReviewReceiptSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      await quarantineAndDelete(validBuildId, raw);
      return null;
    },

    async save(receipt) {
      const valid = datasetReviewReceiptSchema.parse(receipt);
      const database = await databasePromise;
      await database.put('dataset-review-receipts', valid, valid.buildId);
    },

    async delete(buildId) {
      const validBuildId = buildIdSchema.parse(buildId);
      const database = await databasePromise;
      await database.delete('dataset-review-receipts', validBuildId);
    },
  };
}
