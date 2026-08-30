import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
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
  datasetVersion: 'bootstrap-0',
};

describe('cloud build mappers', () => {
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
      accessPreferences: {
        activeEvent: false,
        gamepass: false,
        badge: false,
        limited: false,
      },
    });
  });

  it('keeps the optional weapon-skill field explicit for generated reducers', () => {
    const { weaponSkill: _weaponSkill, ...withoutSkill } = profile;
    const payload = toSaveBuildRevisionArgs(withoutSkill, 'revision-1');

    expect(payload.profile).toHaveProperty('weaponSkill', undefined);
  });
});
