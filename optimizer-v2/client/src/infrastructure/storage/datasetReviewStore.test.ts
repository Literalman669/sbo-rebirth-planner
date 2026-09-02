import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { DatasetReviewReceipt } from '../../domain/datasetImpact/reviewReceipt';
import { createGuestBuildStore } from './guestBuildStore';
import { createDatasetReviewStore } from './datasetReviewStore';
import { GUEST_DATABASE_VERSION } from './plannerDatabase';

function receipt(
  buildId: string,
  reviewedAt = '2026-09-02T00:00:00.000Z',
): DatasetReviewReceipt {
  return {
    schemaVersion: 1,
    buildId,
    inputFingerprint: `build-input-${buildId}`,
    pinnedDatasetVersion: '2026.08.30.1',
    targetDatasetVersion: '2026.09.01.1',
    impactKeyFingerprint: `impact-${buildId}`,
    reportFingerprint: `impact-report-${buildId}`,
    status: 'reviewed',
    reviewedAt,
  };
}

describe('DatasetReviewStore', () => {
  it('lists, replaces, loads, and deletes one strict receipt per build', async () => {
    const databaseName = `dataset-review-store-${crypto.randomUUID()}`;
    const store = createDatasetReviewStore({ databaseName });
    await store.save(receipt('build-b'));
    await store.save(receipt('build-a'));
    await store.save({
      ...receipt('build-a', '2026-09-02T01:00:00.000Z'),
      status: 'applied',
    });

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ buildId: 'build-a', status: 'applied' }),
      expect.objectContaining({ buildId: 'build-b', status: 'reviewed' }),
    ]);
    await expect(store.load('build-a')).resolves.toMatchObject({
      reviewedAt: '2026-09-02T01:00:00.000Z',
    });
    await store.delete('build-a');
    await expect(store.load('build-a')).resolves.toBeNull();
    await expect(
      store.save({ ...receipt('build-c'), status: 'dismissed' as 'reviewed' }),
    ).rejects.toThrow();
  });

  it('quarantines a corrupt receipt without hiding valid neighbors', async () => {
    const databaseName = `dataset-review-corrupt-${crypto.randomUUID()}`;
    const store = createDatasetReviewStore({ databaseName });
    await store.save(receipt('valid-build'));
    const database = await openDB(databaseName, GUEST_DATABASE_VERSION);
    await database.put(
      'dataset-review-receipts',
      { schemaVersion: 1, buildId: 'broken-build' },
      'broken-build',
    );
    database.close();

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ buildId: 'valid-build' }),
    ]);
    const quarantined = await createGuestBuildStore({
      databaseName,
    }).listQuarantinedRecords();
    expect(quarantined).toEqual([
      expect.objectContaining({ kind: 'dataset-review-receipt' }),
    ]);
  });
});
