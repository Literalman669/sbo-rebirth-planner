import { describe, expect, it } from 'vitest';
import {
  validateAccessPreferences,
  validateInventoryJson,
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

  it('accepts exact version-one inventory JSON', () => {
    expect(
      validateInventoryJson(
        JSON.stringify({
          schemaVersion: 1,
          ownedItemIds: ['iron-greatsword'],
          favoriteItemIds: ['beginner-armor'],
          comparisonItemIds: ['iron-greatsword', 'beginner-armor'],
          notes: { 'iron-greatsword': 'Starter weapon' },
        }),
      ),
    ).toEqual([]);
  });

  it('rejects comparison overflow separately from other invalid inventory', () => {
    expect(
      validateInventoryJson(
        JSON.stringify({
          schemaVersion: 1,
          ownedItemIds: [],
          favoriteItemIds: [],
          comparisonItemIds: ['1', '2', '3', '4', '5'],
          notes: {},
        }),
      ),
    ).toEqual(['Inventory comparison list is invalid']);
    expect(
      validateInventoryJson(
        JSON.stringify({
          schemaVersion: 1,
          ownedItemIds: ['same', 'same'],
          favoriteItemIds: [],
          comparisonItemIds: [],
          notes: {},
        }),
      ),
    ).toEqual(['Stored inventory is invalid']);
  });

  it('rejects unknown keys, excessive notes, and invalid note values', () => {
    const notes = Object.fromEntries(
      Array.from({ length: 501 }, (_, index) => [`item-${index}`, 'note']),
    );
    expect(
      validateInventoryJson(
        JSON.stringify({
          schemaVersion: 1,
          ownedItemIds: [],
          favoriteItemIds: [],
          comparisonItemIds: [],
          notes,
        }),
      ),
    ).toEqual(['Stored inventory is invalid']);
    expect(
      validateInventoryJson(
        JSON.stringify({
          schemaVersion: 1,
          ownedItemIds: [],
          favoriteItemIds: [],
          comparisonItemIds: [],
          notes: { item: 'x'.repeat(501) },
          extra: true,
        }),
      ),
    ).toEqual(['Stored inventory is invalid']);
  });
});
