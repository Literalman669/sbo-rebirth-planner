import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import { createVerifiedExampleBuild } from './exampleBuild';

describe('createVerifiedExampleBuild', () => {
  it('uses verified level-one two-handed starter equipment and three unspent points', () => {
    expect(createVerifiedExampleBuild(fallbackRelease)).toMatchObject({
      available: true,
      unspentPoints: 3,
      profile: {
        level: 1,
        maxFloor: 1,
        weaponPath: 'two-handed',
        stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
        equipped: {
          'main-hand': 'iron-greatsword',
          armor: 'beginner-armor',
        },
      },
    });
  });

  it('returns an unavailable reason when a verified starter is missing', () => {
    const withoutArmor = {
      ...fallbackRelease,
      equipment: fallbackRelease.equipment.filter(
        (item) => item.id !== 'beginner-armor',
      ),
    };

    expect(createVerifiedExampleBuild(withoutArmor)).toEqual({
      available: false,
      reason: 'A verified level-one starter armor is unavailable.',
    });
  });
});
