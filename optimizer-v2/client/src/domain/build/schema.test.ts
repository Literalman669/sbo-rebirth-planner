import { describe, expect, it } from 'vitest';
import { characterProfileSchema } from './schema';

const validProfile = {
  schemaVersion: 2,
  id: 'guest-build-1',
  name: 'Floor 2 Greatsword',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: [],
  datasetVersion: 'bootstrap-1',
};

describe('characterProfileSchema', () => {
  it('accepts the essential profile without weapon skill', () => {
    expect(characterProfileSchema.parse(validProfile)).toEqual(validProfile);
  });

  it('defaults a missing optimization goal to balanced', () => {
    const { goal: _goal, ...withoutGoal } = validProfile;

    expect(characterProfileSchema.parse(withoutGoal).goal).toBe('balanced');
  });

  it('rejects unknown weapon paths', () => {
    expect(() =>
      characterProfileSchema.parse({
        ...validProfile,
        weaponPath: 'katana',
      }),
    ).toThrow();
  });

  it('rejects negative invested stats', () => {
    expect(() =>
      characterProfileSchema.parse({
        ...validProfile,
        stats: { ...validProfile.stats, str: -1 },
      }),
    ).toThrow();
  });

  it('rejects duplicate owned item identifiers', () => {
    expect(() =>
      characterProfileSchema.parse({
        ...validProfile,
        ownedItemIds: ['steel-greatsword', 'steel-greatsword'],
      }),
    ).toThrow('owned item IDs must be unique');
  });
});
