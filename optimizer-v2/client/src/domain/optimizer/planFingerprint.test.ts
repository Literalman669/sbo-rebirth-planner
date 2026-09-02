import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { fingerprintRecommendationInput } from './planFingerprint';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'fingerprint-build',
  level: 10,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 10,
  stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { armor: 'beginner-armor', 'main-hand': 'iron-greatsword' },
  ownedItemIds: ['steel-greatsword', 'beginner-armor'],
  datasetVersion: fallbackRelease.version,
};

describe('fingerprintRecommendationInput', () => {
  it('is stable for ordering and changes for a recommendation input', () => {
    const reordered = {
      ...profile,
      equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
      ownedItemIds: ['beginner-armor', 'steel-greatsword'],
    };
    expect(fingerprintRecommendationInput(profile, fallbackRelease)).toBe(
      fingerprintRecommendationInput(reordered, fallbackRelease),
    );
    expect(
      fingerprintRecommendationInput({ ...profile, level: 11 }, fallbackRelease),
    ).not.toBe(fingerprintRecommendationInput(profile, fallbackRelease));
    expect(fingerprintRecommendationInput(profile, fallbackRelease)).toBe(
      'plan-21ed5cab',
    );
  });
});
