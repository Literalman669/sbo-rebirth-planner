import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { buildStressDataset } from '../../test/stressFixtures';
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
    await expect(cache.list()).resolves.toEqual([
      expect.objectContaining({ version: '2026.08.29.1' }),
      expect.objectContaining({ version: '2026.08.29.2' }),
    ]);
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

  it('isolates a corrupt release row while retaining valid release neighbors', async () => {
    const name = databaseName('corrupt-neighbors');
    const cache = createDatasetCache({ databaseName: name });
    const earlier = buildStressDataset({
      version: '2026.08.29.10',
      publishedAt: '2026-08-29T10:00:00.000Z',
    });
    const later = buildStressDataset({
      version: '2026.08.29.12',
      publishedAt: '2026-08-29T12:00:00.000Z',
    });
    await cache.put(earlier);
    await cache.put(later);

    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put('dataset-releases', { version: 'corrupt-release' }, '2026.08.29.11');
    database.close();

    await expect(cache.get('2026.08.29.10')).resolves.toEqual(earlier);
    await expect(cache.get('2026.08.29.11')).resolves.toBeNull();
    await expect(cache.get('2026.08.29.12')).resolves.toEqual(later);
    await expect(cache.getLatest()).resolves.toEqual(later);
  });

  it('isolates an arbitrary-HTTPS verified release while retaining canonical neighbors', async () => {
    const name = databaseName('corrupt-provenance');
    const cache = createDatasetCache({ databaseName: name });
    const canonical = buildStressDataset({
      version: '2026.08.29.20',
      publishedAt: '2026-08-29T20:00:00.000Z',
    });
    const corrupt = buildStressDataset({
      version: '2026.08.29.21',
      publishedAt: '2026-08-29T21:00:00.000Z',
      equipment: buildStressDataset().equipment.map((item, index) =>
        index === 0
          ? { ...item, sourceUrl: 'https://example.com/verified-equipment' }
          : item,
      ),
    });
    await cache.put(canonical);

    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put('dataset-releases', corrupt, corrupt.version);
    database.close();

    await expect(cache.get(corrupt.version)).resolves.toBeNull();
    await expect(cache.get(canonical.version)).resolves.toEqual(canonical);
    await expect(cache.getLatest()).resolves.toEqual(canonical);
  });

  it('isolates a canonical-URL release with a provisional revision', async () => {
    const name = databaseName('provisional-revision');
    const cache = createDatasetCache({ databaseName: name });
    const canonical = buildStressDataset({
      version: '2026.08.29.30',
      publishedAt: '2026-08-29T20:00:00.000Z',
    });
    const provisional = buildStressDataset({
      version: '2026.08.29.31',
      publishedAt: '2026-08-29T21:00:00.000Z',
      equipment: buildStressDataset().equipment.map((item, index) =>
        index === 0 ? { ...item, sourceRevision: 'pending-review' } : item,
      ),
    });
    await cache.put(canonical);

    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put('dataset-releases', provisional, provisional.version);
    database.close();

    await expect(cache.get(provisional.version)).resolves.toBeNull();
    await expect(cache.getLatest()).resolves.toEqual(canonical);
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
