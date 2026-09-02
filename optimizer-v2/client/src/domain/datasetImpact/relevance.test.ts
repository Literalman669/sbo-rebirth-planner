import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { optimizeBuild } from '../optimizer/optimizeBuild';
import type { DatasetFactChange } from './factDiff';
import { selectRelevantFactChanges } from './relevance';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'relevance-build',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: ['steel-greatsword'],
  datasetVersion: fallbackRelease.version,
};

function equipmentChange(entityId: string): DatasetFactChange {
  return {
    id: `equipment:${entityId}:attack`,
    entity: 'equipment',
    entityId,
    field: 'attack',
    change: 'changed',
    before: 1,
    after: 2,
  };
}

describe('dataset impact relevance', () => {
  it('keeps equipped, owned, recommended, eligible, mechanics, and path gaps', () => {
    const plan = optimizeBuild(profile, fallbackRelease);
    const changes: DatasetFactChange[] = [
      equipmentChange('beginner-armor'),
      equipmentChange('steel-greatsword'),
      equipmentChange('combat-armor'),
      equipmentChange('basin-buster'),
      equipmentChange('aquatic-guard'),
      {
        id: 'formula:attack-from-str:expression',
        entity: 'formula',
        entityId: 'attack-from-str',
        field: 'expression',
        change: 'changed',
        before: 'old',
        after: 'new',
      },
      {
        id: 'known-gap:two-handed:250-299:reason',
        entity: 'known-gap',
        entityId: 'two-handed:250-299',
        field: 'reason',
        change: 'changed',
        before: 'old',
        after: 'new',
      },
      {
        id: 'known-gap:rapier:250-299:reason',
        entity: 'known-gap',
        entityId: 'rapier:250-299',
        field: 'reason',
        change: 'changed',
        before: 'old',
        after: 'new',
      },
    ];

    const result = selectRelevantFactChanges({
      profile,
      pinned: fallbackRelease,
      target: fallbackRelease,
      pinnedPlan: { status: 'ready', plan },
      targetPlan: { status: 'ready', plan },
      changes,
    });

    expect(result.changes.map(({ entityId }) => entityId)).toEqual([
      'basin-buster',
      'beginner-armor',
      'combat-armor',
      'steel-greatsword',
      'attack-from-str',
      'two-handed:250-299',
    ]);
    expect(result.omittedCount).toBe(2);
  });
});
