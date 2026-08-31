import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
  createInventorySelector,
  createPreferenceSelector,
  createPlanProgressSelector,
  planProgressFromCloudRow,
  profileFromCloudRevision,
  toSaveBuildRevisionArgs,
} from './buildMappers';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'build-a',
  name: 'Alicization Route',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 18,
  stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'steel-armor' },
  ownedItemIds: ['iron-greatsword', 'steel-armor'],
  accessPreferences: {
    activeEvent: true,
    gamepass: false,
    badge: true,
    limited: false,
  },
  datasetVersion: 'bootstrap-0',
};

describe('cloud build mappers', () => {
  it('preserves the last validated inventory row after malformed input', () => {
    const inventory = {
      schemaVersion: 1 as const,
      ownedItemIds: ['iron-greatsword'],
      favoriteItemIds: ['beginner-armor'],
      comparisonItemIds: ['iron-greatsword'],
      notes: { 'iron-greatsword': 'Starter weapon' },
    };
    const selector = createInventorySelector();

    expect(
      selector.select([{ inventoryJson: JSON.stringify(inventory) }]),
    ).toEqual(inventory);
    expect(
      selector.select([{ inventoryJson: '{"schemaVersion":99}' }]),
    ).toEqual(inventory);
  });

  it('maps identity-filtered progress JSON through the shared schema', () => {
    const progress = {
      schemaVersion: 1 as const,
      buildId: 'build-1',
      completedActionIds: ['level-2'],
      dismissedRecommendationIds: [],
    };
    expect(
      planProgressFromCloudRow({
        buildId: 'build-1',
        progressJson: JSON.stringify(progress),
      }),
    ).toEqual(progress);
  });

  it('preserves the last validated preference row after a malformed update', () => {
    const preferences = {
      schemaVersion: 1 as const,
      mode: 'beginner' as const,
      density: 'comfortable' as const,
      showAllLevels: false,
      compactWeaponPathsAfterFirstUse: false,
    };
    const selector = createPreferenceSelector();
    expect(
      selector.select([{ preferencesJson: JSON.stringify(preferences) }]),
    ).toEqual(preferences);
    expect(
      selector.select([{ preferencesJson: '{"schemaVersion":99}' }]),
    ).toEqual(preferences);
  });

  it('preserves validated progress when a replacement row is malformed', () => {
    const progress = {
      schemaVersion: 1 as const,
      buildId: 'build-1',
      completedActionIds: ['level-2'],
      dismissedRecommendationIds: [],
    };
    const selector = createPlanProgressSelector();
    expect(
      selector.select([
        { buildId: 'build-1', progressJson: JSON.stringify(progress) },
      ]),
    ).toEqual([progress]);
    expect(
      selector.select([
        { buildId: 'build-1', progressJson: '{"schemaVersion":99}' },
      ]),
    ).toEqual([progress]);
  });

  it('creates the exact reducer payload without BigInt values', () => {
    const payload = toSaveBuildRevisionArgs(
      profile,
      'revision-2',
      'revision-1',
    );

    expect(payload).toMatchObject({
      buildId: 'build-a',
      revisionId: 'revision-2',
      parentRevisionId: 'revision-1',
      name: 'Alicization Route',
      profile: {
        schemaVersion: 2,
        level: 20,
        str: 20,
        datasetVersion: 'bootstrap-0',
        accessPreferences: 'active-event,badge',
      },
      equipment: [
        { slot: 'main-hand', itemId: 'iron-greatsword' },
        { slot: 'armor', itemId: 'steel-armor' },
      ],
      ownedItemIds: ['iron-greatsword', 'steel-armor'],
    });
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it('reconstructs and validates a profile from subscribed revision rows', () => {
    expect(
      profileFromCloudRevision(
        {
          id: 'build-a',
          name: 'Alicization Route',
          headRevisionId: 'revision-1',
        },
        {
          id: 'revision-1',
          buildId: 'build-a',
          schemaVersion: 2,
          level: 20,
          maxFloor: 3,
          weaponPath: 'two-handed',
          goal: 'balanced',
          weaponSkill: 18,
          str: 20,
          def: 10,
          agi: 12,
          vit: 8,
          luk: 5,
          accessPreferences: 'active-event,badge',
          datasetVersion: 'bootstrap-0',
        },
        [
          {
            revisionId: 'revision-1',
            slot: 'main-hand',
            itemId: 'iron-greatsword',
          },
          {
            revisionId: 'revision-1',
            slot: 'armor',
            itemId: 'steel-armor',
          },
        ],
        [
          { revisionId: 'revision-1', itemId: 'iron-greatsword' },
          { revisionId: 'revision-1', itemId: 'steel-armor' },
        ],
      ),
    ).toEqual({
      ...profile,
    });
  });

  it('keeps the optional weapon-skill field explicit for generated reducers', () => {
    const { weaponSkill: _weaponSkill, ...withoutSkill } = profile;
    const payload = toSaveBuildRevisionArgs(withoutSkill, 'revision-1');

    expect(payload.profile).toHaveProperty('weaponSkill', undefined);
  });

  it('keeps an explicit empty access preference optional for generated reducers', () => {
    const payload = toSaveBuildRevisionArgs(
      { ...profile, accessPreferences: undefined },
      'revision-1',
    );

    expect(payload.profile).toHaveProperty('accessPreferences', undefined);
  });
});
