import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mergePlanProgress,
  migrateServerPlanProgress,
  type ServerPlanProgress,
} from './progressMerge';

function progress(
  eventId: string,
  status: 'pending' | 'completed',
  updatedAt: string,
): ServerPlanProgress {
  return {
    schemaVersion: 2,
    buildId: 'build-1',
    wallet: { balance: eventId === 'event-a' ? 10_000 : 9_000, updatedAt },
    objectives: [
      {
        actionKey: 'manual:quest',
        category: 'manual-objective',
        status,
        source: 'manual',
        planFingerprint: 'plan-1',
        updatedAt,
      },
    ],
    history: [
      {
        id: eventId,
        actionKey: 'manual:quest',
        category: 'manual-objective',
        label: 'Complete quest',
        outcome: status === 'completed' ? 'completed' : 'reopened',
        source: 'manual',
        planFingerprint: 'plan-1',
        occurredAt: updatedAt,
      },
    ],
    currentPlanFingerprint: 'plan-1',
  };
}

describe('server progress merge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('unions immutable history and resolves mutable state by timestamp', () => {
    const older = progress('event-a', 'pending', '2026-09-01T10:00:00.000Z');
    const newer = progress('event-b', 'completed', '2026-09-01T11:00:00.000Z');

    const result = mergePlanProgress(older, newer);

    expect(result.history.map((event) => event.id)).toEqual(['event-a', 'event-b']);
    expect(result.objectives[0]?.status).toBe('completed');
    expect(result.wallet).toEqual({
      balance: 9_000,
      updatedAt: '2026-09-01T11:00:00.000Z',
    });
  });

  it('is idempotent and rejects conflicting reuse of an event ID', () => {
    const current = progress('event-a', 'completed', '2026-09-01T11:00:00.000Z');

    expect(mergePlanProgress(current, structuredClone(current))).toEqual(current);
    expect(() =>
      mergePlanProgress(current, {
        ...structuredClone(current),
        history: [{ ...current.history[0]!, label: 'Different event' }],
      }),
    ).toThrow('Progress history event ID conflict');
  });

  it('canonicalizes the first write for stable retries', () => {
    const first = progress('event-b', 'pending', '2026-09-01T11:00:00.000Z');
    first.history.push({
      ...first.history[0]!,
      id: 'event-a',
      occurredAt: '2026-09-01T10:00:00.000Z',
    });
    first.objectives.push({
      ...first.objectives[0]!,
      actionKey: 'a-objective',
    });

    const result = mergePlanProgress(undefined, first);

    expect(result.history.map((event) => event.id)).toEqual(['event-a', 'event-b']);
    expect(result.objectives.map((objective) => objective.actionKey)).toEqual([
      'a-objective',
      'manual:quest',
    ]);
  });

  it('migrates legacy progress without inventing timestamps', () => {
    const migrated = migrateServerPlanProgress({
      schemaVersion: 1,
      buildId: 'build-1',
      completedActionIds: ['level-2'],
      dismissedRecommendationIds: [],
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.objectives[0]).not.toHaveProperty('updatedAt');
    expect(migrated.history[0]).not.toHaveProperty('occurredAt');
  });

  it('runs in the SpacetimeDB sandbox without structuredClone', () => {
    vi.stubGlobal('structuredClone', undefined);
    const incoming = progress(
      'event-a',
      'completed',
      '2026-09-01T11:00:00.000Z',
    );

    expect(mergePlanProgress(undefined, incoming)).toEqual(incoming);
  });
});
