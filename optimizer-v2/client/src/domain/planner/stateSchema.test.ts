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

  it('accepts valid version one progress within the level bounds', () => {
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
      schemaVersion: 1,
      buildId: 'build-1',
      completedActionIds: ['level-2'],
      dismissedRecommendationIds: ['upgrade-iron'],
      reconciledThroughLevel: 10_000,
      acknowledgedDatasetVersion: '2026.08.30.1',
    });
  });
});
