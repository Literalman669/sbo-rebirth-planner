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
  const subject = 'account-a';
  it('isolates identical revision IDs between authenticated accounts', async () => {
    const queue = createPendingRevisionQueue({
      databaseName: `pending-accounts-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      subject: 'account-a',
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });
    await queue.enqueue({
      subject: 'account-b',
      revisionId: 'revision-1',
      buildId: 'build-b',
      profile: profile('build-b'),
      enqueuedAt: '2026-08-29T10:00:02.000Z',
      attempts: 0,
    });

    expect((await queue.list('account-a')).map((row) => row.buildId)).toEqual([
      'build-a',
    ]);
    expect((await queue.list('account-b')).map((row) => row.buildId)).toEqual([
      'build-b',
    ]);

    await queue.acknowledge('account-a', 'revision-1');
    expect(await queue.list('account-a')).toHaveLength(0);
    expect(await queue.list('account-b')).toHaveLength(1);
  });

  it('lists pending revisions in enqueue order and acknowledges one', async () => {
    const queue = createPendingRevisionQueue({
      databaseName: `pending-order-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      subject,
      revisionId: 'revision-2',
      buildId: 'build-a',
      profile: profile('build-a'),
      parentRevisionId: 'revision-1',
      enqueuedAt: '2026-08-29T10:00:02.000Z',
      attempts: 0,
    });
    await queue.enqueue({
      subject,
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });

    expect((await queue.list(subject)).map((item) => item.revisionId)).toEqual([
      'revision-1',
      'revision-2',
    ]);
    await queue.acknowledge(subject, 'revision-1');
    expect((await queue.list(subject)).map((item) => item.revisionId)).toEqual([
      'revision-2',
    ]);
  });

  it('increments retry attempts and persists through a new adapter', async () => {
    const databaseName = `pending-persist-${crypto.randomUUID()}`;
    const first = createPendingRevisionQueue({ databaseName });
    await first.enqueue({
      subject,
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });
    await first.incrementAttempts(subject, 'revision-1');

    const second = createPendingRevisionQueue({ databaseName });
    expect(await second.list(subject)).toMatchObject([
      { revisionId: 'revision-1', attempts: 1 },
    ]);
  });

  it('treats a concurrently acknowledged retry as already resolved', async () => {
    const queue = createPendingRevisionQueue({
      databaseName: `pending-race-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      subject,
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile('build-a'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });
    await queue.acknowledge(subject, 'revision-1');

    await expect(
      queue.incrementAttempts(subject, 'revision-1'),
    ).resolves.toBeUndefined();
    expect(await queue.list(subject)).toHaveLength(0);
  });
});
