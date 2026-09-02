import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openPlannerDatabase } from '../storage/plannerDatabase';
import { createPendingPlannerStateQueue } from './pendingPlannerStateQueue';
import { progressFixture } from '../../test/progressFixtures';

function progress(buildId: string, actionId: string) {
  return progressFixture(buildId, [actionId]);
}

const preferences = {
  schemaVersion: 1 as const,
  mode: 'beginner' as const,
  density: 'comfortable' as const,
  showAllLevels: false,
  compactWeaponPathsAfterFirstUse: false,
};

const inventory = {
  schemaVersion: 1 as const,
  ownedItemIds: ['iron-greatsword'],
  favoriteItemIds: [],
  comparisonItemIds: [],
  notes: {},
};

describe('PendingPlannerStateQueue', () => {
  it('isolates stable mutation IDs between authenticated accounts', async () => {
    const queue = createPendingPlannerStateQueue({
      databaseName: `planner-queue-accounts-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      kind: 'preferences',
      subject: 'account-a',
      mutationId: 'preferences:primary',
      preferences,
      enqueuedAt: '2026-08-30T10:00:00.000Z',
      attempts: 0,
    });
    await queue.enqueue({
      kind: 'preferences',
      subject: 'account-b',
      mutationId: 'preferences:primary',
      preferences: { ...preferences, density: 'compact' },
      enqueuedAt: '2026-08-30T10:00:01.000Z',
      attempts: 0,
    });

    expect(await queue.list('account-a')).toMatchObject([
      { kind: 'preferences', subject: 'account-a' },
    ]);
    expect(await queue.list('account-b')).toMatchObject([
      { kind: 'preferences', subject: 'account-b' },
    ]);
  });

  it('replaces an older mutation with the latest state for the same stable ID', async () => {
    const queue = createPendingPlannerStateQueue({
      databaseName: `planner-queue-coalesce-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      kind: 'progress',
      subject: 'account-a',
      mutationId: 'progress:build-a',
      progress: progress('build-a', 'level-2'),
      enqueuedAt: '2026-08-30T10:00:00.000Z',
      attempts: 2,
    });
    await queue.enqueue({
      kind: 'progress',
      subject: 'account-a',
      mutationId: 'progress:build-a',
      progress: progress('build-a', 'level-3'),
      enqueuedAt: '2026-08-30T10:00:01.000Z',
      attempts: 0,
    });

    expect(await queue.list('account-a')).toMatchObject([
      {
        kind: 'progress',
        progress: {
          objectives: [{ actionKey: 'level-3', status: 'completed' }],
        },
        attempts: 0,
      },
    ]);
  });

  it('lets a reset replace an older queued progress save', async () => {
    const queue = createPendingPlannerStateQueue({
      databaseName: `planner-queue-reset-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      kind: 'progress',
      subject: 'account-a',
      mutationId: 'progress:build-a',
      progress: progress('build-a', 'level-2'),
      enqueuedAt: '2026-09-01T10:00:00.000Z',
      attempts: 1,
    });
    await queue.enqueue({
      kind: 'progress-reset',
      subject: 'account-a',
      mutationId: 'progress:build-a',
      buildId: 'build-a',
      enqueuedAt: '2026-09-01T10:00:01.000Z',
      attempts: 0,
    });

    expect(await queue.list('account-a')).toEqual([
      expect.objectContaining({
        kind: 'progress-reset',
        buildId: 'build-a',
        attempts: 0,
      }),
    ]);
  });

  it('increments attempts, acknowledges one mutation, and ignores corrupt rows', async () => {
    const databaseName = `planner-queue-retry-${crypto.randomUUID()}`;
    const queue = createPendingPlannerStateQueue({ databaseName });
    await queue.enqueue({
      kind: 'preferences',
      subject: 'account-a',
      mutationId: 'preferences:primary',
      preferences,
      enqueuedAt: '2026-08-30T10:00:00.000Z',
      attempts: 0,
    });
    const database = await openPlannerDatabase(databaseName);
    await database.put(
      'pending-planner-state',
      { subject: 'account-a', kind: 'progress', mutationId: 'broken' },
      'account-a:broken',
    );
    database.close();

    await queue.incrementAttempts('account-a', 'preferences:primary');
    expect(await queue.list('account-a')).toMatchObject([{ attempts: 1 }]);
    await queue.acknowledge('account-a', 'preferences:primary');
    expect(await queue.list('account-a')).toEqual([]);
  });

  it('coalesces inventory changes under one stable account-scoped mutation', async () => {
    const queue = createPendingPlannerStateQueue({
      databaseName: `planner-queue-inventory-${crypto.randomUUID()}`,
    });
    await queue.enqueue({
      kind: 'inventory',
      subject: 'account-a',
      mutationId: 'inventory:primary',
      inventory,
      enqueuedAt: '2026-08-31T10:00:00.000Z',
      attempts: 2,
    });
    await queue.enqueue({
      kind: 'inventory',
      subject: 'account-a',
      mutationId: 'inventory:primary',
      inventory: {
        ...inventory,
        ownedItemIds: ['beginner-armor'],
      },
      enqueuedAt: '2026-08-31T10:00:01.000Z',
      attempts: 0,
    });

    expect(await queue.list('account-a')).toMatchObject([
      {
        kind: 'inventory',
        mutationId: 'inventory:primary',
        inventory: { ownedItemIds: ['beginner-armor'] },
        attempts: 0,
      },
    ]);
    expect(await queue.list('account-b')).toEqual([]);
  });
});
