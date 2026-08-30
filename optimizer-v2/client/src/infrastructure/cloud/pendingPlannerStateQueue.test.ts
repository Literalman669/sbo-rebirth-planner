import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openPlannerDatabase } from '../storage/plannerDatabase';
import { createPendingPlannerStateQueue } from './pendingPlannerStateQueue';

function progress(buildId: string, actionId: string) {
  return {
    schemaVersion: 1 as const,
    buildId,
    completedActionIds: [actionId],
    dismissedRecommendationIds: [],
  };
}

const preferences = {
  schemaVersion: 1 as const,
  mode: 'beginner' as const,
  density: 'comfortable' as const,
  showAllLevels: false,
  compactWeaponPathsAfterFirstUse: false,
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
        progress: { completedActionIds: ['level-3'] },
        attempts: 0,
      },
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
});
