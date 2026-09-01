import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANNER_PREFERENCES,
  migratePlannerPreferences,
  migratePlanProgress,
} from './stateSchema';

describe('planner state schemas', () => {
  it('migrates missing preferences to version one defaults', () => {
    expect(migratePlannerPreferences(undefined)).toEqual({
      schemaVersion: 1,
      mode: 'beginner',
      density: 'comfortable',
      showAllLevels: false,
      compactWeaponPathsAfterFirstUse: false,
    });
    expect(migratePlannerPreferences(undefined)).not.toBe(
      DEFAULT_PLANNER_PREFERENCES,
    );
  });

  it('rejects malformed progress without deleting neighboring state', () => {
    expect(() =>
      migratePlanProgress({
        schemaVersion: 1,
        buildId: 'build-1',
        completedActionIds: 'bad',
        dismissedRecommendationIds: [],
      }),
    ).toThrow('Stored plan progress is invalid');
  });

  it('rejects duplicate persisted action IDs', () => {
    expect(() =>
      migratePlanProgress({
        schemaVersion: 1,
        buildId: 'build-1',
        completedActionIds: ['level-2', 'level-2'],
        dismissedRecommendationIds: [],
      }),
    ).toThrow('Stored plan progress is invalid');
  });

  it('migrates valid version one progress into lossless version two history', () => {
    expect(
      migratePlanProgress({
        schemaVersion: 1,
        buildId: 'build-1',
        completedActionIds: ['level-2'],
        dismissedRecommendationIds: ['upgrade-iron'],
        reconciledThroughLevel: 10_000,
        acknowledgedDatasetVersion: '2026.08.30.1',
      }),
    ).toEqual({
      schemaVersion: 2,
      buildId: 'build-1',
      objectives: [
        {
          actionKey: 'level-2',
          category: 'manual-objective',
          status: 'completed',
          source: 'legacy',
          planFingerprint: 'legacy',
        },
        {
          actionKey: 'upgrade-iron',
          category: 'manual-objective',
          status: 'skipped',
          source: 'legacy',
          planFingerprint: 'legacy',
        },
      ],
      history: [
        {
          id: 'legacy:completed:level-2',
          actionKey: 'level-2',
          category: 'manual-objective',
          label: 'level-2',
          outcome: 'completed',
          source: 'legacy',
          planFingerprint: 'legacy',
        },
        {
          id: 'legacy:skipped:upgrade-iron',
          actionKey: 'upgrade-iron',
          category: 'manual-objective',
          label: 'upgrade-iron',
          outcome: 'skipped',
          source: 'legacy',
          planFingerprint: 'legacy',
        },
      ],
      reconciledThroughLevel: 10_000,
      acknowledgedDatasetVersion: '2026.08.30.1',
    });
  });

  it('does not invent timestamps while migrating legacy progress', () => {
    const migrated = migratePlanProgress({
      schemaVersion: 1,
      buildId: 'build-1',
      completedActionIds: ['spend-stats:level:2'],
      dismissedRecommendationIds: [],
    });

    expect(migrated.objectives[0]).not.toHaveProperty('updatedAt');
    expect(migrated.history[0]).not.toHaveProperty('occurredAt');
    expect(migrated.objectives[0]?.category).toBe('stat-allocation');
  });
});
