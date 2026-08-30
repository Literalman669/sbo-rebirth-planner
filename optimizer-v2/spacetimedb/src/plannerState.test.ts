import { describe, expect, it } from 'vitest';
import {
  validateAccessPreferences,
  validatePlanProgressJson,
  validatePlanProgressOwnership,
  validatePreferenceJson,
} from './validation';

const sender = { id: 'sender' };

describe('planner state validation', () => {
  it('rejects plan progress for another identity build', () => {
    const otherOwnerBuild = {
      owner: { equals: (identity: unknown) => identity !== sender },
    };
    expect(
      validatePlanProgressOwnership(otherOwnerBuild, sender),
    ).toEqual(['Build not found for this identity']);
  });

  it('accepts version one preference JSON only', () => {
    expect(
      validatePreferenceJson(
        '{"schemaVersion":1,"mode":"beginner","density":"comfortable","showAllLevels":false,"compactWeaponPathsAfterFirstUse":false}',
      ),
    ).toEqual([]);
    expect(
      validatePreferenceJson(
        '{"schemaVersion":2,"mode":"beginner","density":"comfortable","showAllLevels":false,"compactWeaponPathsAfterFirstUse":false}',
      ),
    ).toEqual(['Stored planner preferences are invalid']);
  });

  it('rejects duplicate progress action IDs and a mismatched build', () => {
    expect(
      validatePlanProgressJson(
        '{"schemaVersion":1,"buildId":"build-2","completedActionIds":["level-2","level-2"],"dismissedRecommendationIds":[]}',
        'build-1',
      ),
    ).toEqual(['Stored plan progress is invalid']);
  });

  it('accepts only unique known access-preference tokens', () => {
    expect(
      validateAccessPreferences('active-event,gamepass,badge,limited'),
    ).toEqual([]);
    expect(validateAccessPreferences('gamepass,gamepass,unknown')).toEqual([
      'Access preferences are invalid',
    ]);
  });
});
