import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import {
  createDatasetCache,
  type DatasetCache,
} from './datasetCache';
import { GUEST_DATABASE_VERSION } from './guestBuildStore';

function databaseName(label: string) {
  return `sbo-rebirth-dataset-${label}-${crypto.randomUUID()}`;
}

function snapshot(version: string, publishedAt: string) {
  return { ...bootstrapRelease, version, publishedAt };
}

describe('DatasetCache', () => {
  it('restores exact releases and chooses the latest valid snapshot', async () => {
    const cache = createDatasetCache({ databaseName: databaseName('latest') });
    await cache.put(snapshot('2026.08.29.1', '2026-08-29T10:00:00.000Z'));
    await cache.put(snapshot('2026.08.29.2', '2026-08-29T11:00:00.000Z'));

    await expect(cache.get('2026.08.29.1')).resolves.toMatchObject({
      version: '2026.08.29.1',
    });
    await expect(cache.getLatest()).resolves.toMatchObject({
      version: '2026.08.29.2',
    });
  });

  it('isolates a corrupt cached row instead of returning partial data', async () => {
    const name = databaseName('corrupt');
    const cache = createDatasetCache({ databaseName: name });
    await cache.put(snapshot('2026.08.29.1', '2026-08-29T10:00:00.000Z'));
    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put('dataset-releases', { version: 'broken' }, 'broken');
    database.close();

    await expect(cache.get('broken')).resolves.toBeNull();
    await expect(cache.getLatest()).resolves.toMatchObject({
      version: '2026.08.29.1',
    });
  });

  it('keeps every referenced historical release while pruning others', async () => {
    const cache: DatasetCache = createDatasetCache({
      databaseName: databaseName('prune'),
    });
    for (const [version, hour] of [
      ['2026.08.29.1', '10'],
      ['2026.08.29.2', '11'],
      ['2026.08.29.3', '12'],
    ]) {
      await cache.put(snapshot(version, `2026-08-29T${hour}:00:00.000Z`));
    }

    await cache.pruneExcept(new Set(['2026.08.29.1', '2026.08.29.3']));

    await expect(cache.get('2026.08.29.1')).resolves.not.toBeNull();
    await expect(cache.get('2026.08.29.2')).resolves.toBeNull();
    await expect(cache.get('2026.08.29.3')).resolves.not.toBeNull();
  });
});
