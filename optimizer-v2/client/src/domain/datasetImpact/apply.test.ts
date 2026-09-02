import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import {
  assertDatasetPinOnlyUpdate,
  createDatasetPinnedProfile,
} from './apply';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'build-a',
  name: 'Frontline route',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 18,
  stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'steel-armor' },
  ownedItemIds: ['iron-greatsword', 'steel-armor'],
  accessPreferences: {
    activeEvent: false,
    gamepass: true,
    badge: false,
    limited: false,
  },
  datasetVersion: 'bootstrap-0',
};

describe('dataset pin apply invariants', () => {
  it('creates a detached profile with only the dataset pin changed', () => {
    const updated = createDatasetPinnedProfile(profile, '2026.09.01.1');

    expect(updated).toEqual({ ...profile, datasetVersion: '2026.09.01.1' });
    expect(updated).not.toBe(profile);
    expect(updated.stats).not.toBe(profile.stats);
    expect(updated.equipped).not.toBe(profile.equipped);
    expect(updated.ownedItemIds).not.toBe(profile.ownedItemIds);
    expect(() => assertDatasetPinOnlyUpdate(profile, updated)).not.toThrow();
  });

  it.each([
    ['level', { level: 99 }],
    ['stats', { stats: { ...profile.stats, str: 21 } }],
    ['equipment', { equipped: { ...profile.equipped, armor: 'other' } }],
    ['inventory', { ownedItemIds: ['iron-greatsword'] }],
    ['name', { name: 'Changed' }],
  ])('rejects a %s change hidden inside a dataset update', (_label, change) => {
    const pinned = createDatasetPinnedProfile(profile, '2026.09.01.1');

    expect(() => assertDatasetPinOnlyUpdate(profile, {
      ...pinned,
      ...change,
    } as CharacterProfile)).toThrow(/only datasetVersion may change/);
  });

  it('rejects a no-op dataset pin', () => {
    expect(() => assertDatasetPinOnlyUpdate(profile, structuredClone(profile)))
      .toThrow(/datasetVersion must change/);
  });
});
