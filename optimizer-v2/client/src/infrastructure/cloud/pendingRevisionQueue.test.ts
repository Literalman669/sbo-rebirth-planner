import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { buildStressProfile } from '../../test/stressFixtures';
import { createPendingRevisionQueue } from './pendingRevisionQueue';
import { GUEST_DATABASE_VERSION } from '../storage/guestBuildStore';

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
    expect((await queue.list('account-a'))[0]?.kind).toBe('build');
    expect((await queue.list('account-b')).map((row) => row.buildId)).toEqual([
      'build-b',
    ]);

    await queue.acknowledge('account-a', 'revision-1');
    expect(await queue.list('account-a')).toHaveLength(0);
    expect(await queue.list('account-b')).toHaveLength(1);
  });

  it('surfaces legacy unscoped revisions for an explicit account claim', async () => {
    const databaseName = `pending-legacy-${crypto.randomUUID()}`;
    const queue = createPendingRevisionQueue({ databaseName });
    await queue.list(subject);
    const database = await openDB(databaseName, GUEST_DATABASE_VERSION);
    await database.put(
      'pending-revisions',
      {
        revisionId: 'legacy-revision',
        buildId: 'legacy-build',
        profile: profile('legacy-build'),
        enqueuedAt: '2026-08-29T10:00:01.000Z',
        attempts: 2,
      },
      'legacy-revision',
    );
    database.close();

    expect(await queue.listLegacyUnscoped()).toMatchObject([
      { revisionId: 'legacy-revision', buildId: 'legacy-build' },
    ]);
    await queue.claimLegacyUnscoped(subject);

    expect(await queue.listLegacyUnscoped()).toHaveLength(0);
    expect(await queue.list(subject)).toMatchObject([
      { subject, revisionId: 'legacy-revision', kind: 'build', attempts: 2 },
    ]);
  });

  it('persists personal-preset kind through a fresh adapter and retry metadata', async () => {
    const databaseName = `pending-kind-${crypto.randomUUID()}`;
    const first = createPendingRevisionQueue({ databaseName });
    await first.enqueue({
      subject,
      revisionId: 'preset-revision',
      buildId: 'preset-build',
      kind: 'personal-preset',
      profile: profile('preset-build'),
      enqueuedAt: '2026-08-29T10:00:01.000Z',
      attempts: 0,
    });
    await first.incrementAttempts(subject, 'preset-revision');

    const second = createPendingRevisionQueue({ databaseName });
    await expect(second.list(subject)).resolves.toMatchObject([
      { revisionId: 'preset-revision', kind: 'personal-preset', attempts: 1 },
    ]);
  });

  it('isolates corrupt scoped and legacy rows while retaining valid pending revisions', async () => {
    const databaseName = `pending-corrupt-${crypto.randomUUID()}`;
    const queue = createPendingRevisionQueue({ databaseName });
    await queue.list(subject);
    const database = await openDB(databaseName, GUEST_DATABASE_VERSION);
    await database.put(
      'pending-revisions',
      {
        subject,
        revisionId: 'scoped-valid',
        buildId: 'scoped-build',
        profile: buildStressProfile({ id: 'scoped-build' }),
        enqueuedAt: '2026-08-29T10:00:00.000Z',
        attempts: 0,
      },
      `${subject}:scoped-valid`,
    );
    await database.put(
      'pending-revisions',
      { subject, revisionId: 'scoped-corrupt' },
      `${subject}:scoped-corrupt`,
    );
    await database.put(
      'pending-revisions',
      {
        revisionId: 'legacy-valid',
        buildId: 'legacy-build',
        profile: buildStressProfile({ id: 'legacy-build' }),
        enqueuedAt: '2026-08-29T10:00:01.000Z',
        attempts: 0,
      },
      'legacy-valid',
    );
    await database.put(
      'pending-revisions',
      { revisionId: 'legacy-corrupt' },
      'legacy-corrupt',
    );
    database.close();

    await expect(queue.list(subject)).resolves.toMatchObject([
      { subject, revisionId: 'scoped-valid', buildId: 'scoped-build' },
    ]);
    await expect(queue.listLegacyUnscoped()).resolves.toMatchObject([
      { revisionId: 'legacy-valid', buildId: 'legacy-build' },
    ]);
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
