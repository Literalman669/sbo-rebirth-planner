import { describe, expect, it } from 'vitest';
import { curatedBuildPresets } from '../../data/buildPresets';
import type { CharacterProfile } from './model';
import {
  CURATED_PRESET_POLICY_VERSION,
  createDraftFromCuratedPreset,
  createDraftFromPersonalPreset,
} from './presets';

const personalSource: CharacterProfile = {
  schemaVersion: 2,
  id: 'preset-source',
  name: 'Floor 2 Melee',
  level: 8,
  maxFloor: 2,
  weaponPath: 'melee',
  goal: 'farming',
  weaponSkill: 4,
  stats: { str: 10, def: 4, agi: 3, vit: 4, luk: 3 },
  equipped: { 'main-hand': 'fists', armor: 'fields-warrior' },
  ownedItemIds: ['fists'],
  datasetVersion: '2026.08.29.1',
  accessPreferences: {
    activeEvent: false,
    gamepass: false,
    badge: true,
    limited: false,
  },
};

describe('build presets', () => {
  it('defines one versioned balanced start for every supported weapon path', () => {
    expect(curatedBuildPresets.map((preset) => preset.weaponPath)).toEqual([
      'two-handed',
      'one-handed',
      'rapier',
      'dagger',
      'dual-wield',
      'melee',
    ]);
    expect(
      curatedBuildPresets.every(
        (preset) =>
          preset.policyVersion === CURATED_PRESET_POLICY_VERSION &&
          preset.goal === 'balanced' &&
          !('stats' in preset) &&
          !('equipped' in preset),
      ),
    ).toBe(true);
  });

  it('creates a curated draft at the verified new-character baseline', () => {
    const melee = curatedBuildPresets.find(
      (preset) => preset.weaponPath === 'melee',
    )!;

    expect(
      createDraftFromCuratedPreset(melee, {
        id: 'new-melee',
        datasetVersion: '2026.08.30.1',
      }),
    ).toEqual({
      schemaVersion: 2,
      id: 'new-melee',
      name: 'Balanced Melee Start',
      level: 1,
      maxFloor: 1,
      weaponPath: 'melee',
      goal: 'balanced',
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      equipped: {},
      ownedItemIds: [],
      datasetVersion: '2026.08.30.1',
      accessPreferences: {
        activeEvent: false,
        gamepass: false,
        badge: false,
        limited: false,
      },
    });
  });

  it('copies a complete personal preset to a new identity without mutating its source', () => {
    const before = structuredClone(personalSource);
    const applied = createDraftFromPersonalPreset(
      personalSource,
      'applied-build',
    );

    expect(applied).toEqual({
      ...personalSource,
      id: 'applied-build',
      name: 'Floor 2 Melee copy',
    });
    expect(personalSource).toEqual(before);
    applied.ownedItemIds.push('copy-only');
    expect(personalSource.ownedItemIds).toEqual(['fists']);
  });
});
