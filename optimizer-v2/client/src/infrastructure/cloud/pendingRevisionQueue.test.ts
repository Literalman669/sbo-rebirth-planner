import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createPendingRevisionQueue } from './pendingRevisionQueue';

function profile(id: string): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: `Build ${id}`,
    level: 20,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    weaponSkill: 18,
    stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
    equipped: { 'main-hand': 'iron-greatsword' },
    ownedItemIds: ['iron-greatsword'],
    datasetVersion: 'bootstrap-0',
  };
}

describe('PendingRevisionQueue', () => {
  it('lists pending revisions in enqueue order and acknowledges one', async () => {
    const queue = createPendingRevisionQueue({
      databaseName: `pending-order-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      revisionId: 'revision-2',
      buildId: 'build-a',
      profile: profile('build-a'),
      parentRevisionId: 'revision-1',
      enqueuedAt: '2026-08-29T10:00:02.000Z',
      attempts: 0,
    });
    await queue.enqueue({
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });

    expect((await queue.list()).map((item) => item.revisionId)).toEqual([
      'revision-1',
      'revision-2',
    ]);
    await queue.acknowledge('revision-1');
    expect((await queue.list()).map((item) => item.revisionId)).toEqual([
      'revision-2',
    ]);
  });

  it('increments retry attempts and persists through a new adapter', async () => {
    const databaseName = `pending-persist-${crypto.randomUUID()}`;
    const first = createPendingRevisionQueue({ databaseName });
    await first.enqueue({
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });
    await first.incrementAttempts('revision-1');

    const second = createPendingRevisionQueue({ databaseName });
    expect(await second.list()).toMatchObject([
      { revisionId: 'revision-1', attempts: 1 },
    ]);
  });
});
