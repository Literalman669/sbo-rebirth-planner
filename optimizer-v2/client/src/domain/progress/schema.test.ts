import { describe, expect, it } from 'vitest';
import {
  MAX_PROGRESS_HISTORY,
  MAX_PROGRESS_OBJECTIVES,
} from './model';
import {
  createEmptyPlanProgress,
  migratePlanProgress,
  planProgressSchema,
} from './schema';

const now = '2026-09-01T12:00:00.000Z';

describe('progress schema', () => {
  it('creates independent empty version two progress', () => {
    const first = createEmptyPlanProgress('build-1');
    const second = createEmptyPlanProgress('build-1');

    expect(first).toEqual({
      schemaVersion: 2,
      buildId: 'build-1',
      objectives: [],
      history: [],
    });
    expect(first.objectives).not.toBe(second.objectives);
    expect(first.history).not.toBe(second.history);
  });

  it('enforces objective, history, timestamp, and wallet boundaries', () => {
    const objective = {
      actionKey: 'manual:quest',
      category: 'manual-objective' as const,
      status: 'pending' as const,
      source: 'manual' as const,
      planFingerprint: 'plan-1',
      updatedAt: now,
    };
    const event = {
      id: 'event-1',
      actionKey: 'manual:quest',
      category: 'manual-objective' as const,
      label: 'Complete quest',
      outcome: 'completed' as const,
      source: 'manual' as const,
      planFingerprint: 'plan-1',
      occurredAt: now,
    };

    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: Array.from(
          { length: MAX_PROGRESS_OBJECTIVES + 1 },
          (_, index) => ({ ...objective, actionKey: `manual:${index}` }),
        ),
        history: [],
      }),
    ).toThrow();
    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: [],
        history: Array.from(
          { length: MAX_PROGRESS_HISTORY + 1 },
          (_, index) => ({ ...event, id: `event-${index}` }),
        ),
      }),
    ).toThrow();
    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        wallet: { balance: Number.MAX_SAFE_INTEGER + 1, updatedAt: now },
        objectives: [],
        history: [],
      }),
    ).toThrow();
    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: [{ ...objective, updatedAt: undefined }],
        history: [],
      }),
    ).toThrow('Current objective states require an update timestamp');
    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: [],
        history: [{ ...event, note: 'unsafe\u0000note' }],
      }),
    ).toThrow('Text contains unsupported control characters');
  });

  it('rejects duplicate objective action keys and history IDs', () => {
    const objective = {
      actionKey: 'manual:quest',
      category: 'manual-objective' as const,
      status: 'pending' as const,
      source: 'manual' as const,
      planFingerprint: 'plan-1',
      updatedAt: now,
    };
    const event = {
      id: 'event-1',
      actionKey: 'manual:quest',
      category: 'manual-objective' as const,
      label: 'Complete quest',
      outcome: 'completed' as const,
      source: 'manual' as const,
      planFingerprint: 'plan-1',
      occurredAt: now,
    };

    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: [objective, objective],
        history: [],
      }),
    ).toThrow('Objective action keys must be unique');
    expect(() =>
      planProgressSchema.parse({
        schemaVersion: 2,
        buildId: 'build-1',
        objectives: [],
        history: [event, event],
      }),
    ).toThrow('History event IDs must be unique');
  });

  it('migrates maximum-length legacy action IDs to bounded stable event IDs', () => {
    const actionKey = 'x'.repeat(255);
    const input = {
      schemaVersion: 1,
      buildId: 'build-1',
      completedActionIds: [actionKey],
      dismissedRecommendationIds: [],
    };

    const first = migratePlanProgress(input);
    const second = migratePlanProgress(input);

    expect(first.history[0]?.id.length).toBeLessThanOrEqual(255);
    expect(first.history[0]?.id).toBe(second.history[0]?.id);
    expect(first.history[0]?.actionKey).toBe(actionKey);
  });
});
