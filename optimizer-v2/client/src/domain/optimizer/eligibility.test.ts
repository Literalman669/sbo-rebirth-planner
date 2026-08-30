import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import type { EquipmentRecord } from '../dataset/model';
import { classifyCandidate } from './eligibility';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'profile-1',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 5,
  stats: { str: 10, def: 4, agi: 4, vit: 4, luk: 2 },
  equipped: {},
  ownedItemIds: [],
  datasetVersion: 'bootstrap-0',
};

const item: EquipmentRecord = {
  id: 'steel-greatsword',
  name: 'Steel Greatsword',
  slot: 'main-hand',
  weaponPaths: ['two-handed'],
  attack: 10,
  defense: 0,
  dexterity: 0,
  levelRequirement: 1,
  skillRequirement: 5,
  floor: 1,
  acquisitionType: 'shop',
  acquisitionDetail: 'Floor 1 Shop',
  availability: 'always',
  sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed',
  sourceRevision: '26187',
  lastReviewedAt: '2026-08-29',
  verificationStatus: 'verified',
};

describe('classifyCandidate', () => {
  it.each([
    ['gamepass', 'gamepass'],
    ['badge', 'badge'],
    ['limited', 'limited'],
    ['active-event', 'activeEvent'],
  ] as const)(
    'requires explicit %s access unless the item is already owned',
    (availability, preference) => {
      const candidate = { ...item, availability };
      expect(classifyCandidate(profile, candidate, new Set())).toEqual({
        eligible: false,
        reason: 'Item requires enabled access or ownership',
      });
      expect(
        classifyCandidate(
          {
            ...profile,
            accessPreferences: {
              activeEvent: false,
              gamepass: false,
              badge: false,
              limited: false,
              [preference]: true,
            },
          },
          candidate,
          new Set(),
        ).eligible,
      ).toBe(true);
      expect(
        classifyCandidate(profile, candidate, new Set([candidate.id])).eligible,
      ).toBe(true);
    },
  );

  it.each(['inactive-event', 'legacy', 'unobtainable', 'unknown'] as const)(
    'never recommends farming %s equipment',
    (availability) => {
      const candidate = { ...item, availability };
      expect(classifyCandidate(profile, candidate, new Set()).eligible).toBe(false);
      expect(
        classifyCandidate(profile, candidate, new Set([candidate.id])).eligible,
      ).toBe(true);
    },
  );
  it('rejects unverified records', () => {
    expect(
      classifyCandidate(
        profile,
        { ...item, verificationStatus: 'candidate' },
        new Set(),
      ),
    ).toEqual({ eligible: false, reason: 'Item is not verified' });
  });

  it('rejects an incompatible weapon path', () => {
    expect(
      classifyCandidate(
        profile,
        { ...item, weaponPaths: ['rapier'] },
        new Set(),
      ),
    ).toEqual({ eligible: false, reason: 'Incompatible weapon path' });
  });

  it('rejects items above the unlocked floor', () => {
    expect(
      classifyCandidate(profile, { ...item, floor: 3 }, new Set()),
    ).toEqual({ eligible: false, reason: 'Requires Floor 3' });
  });

  it('keeps a level requirement inside the horizon as a future target', () => {
    expect(
      classifyCandidate(
        profile,
        { ...item, levelRequirement: 15 },
        new Set(),
      ),
    ).toEqual({ eligible: true, immediate: false, reason: 'Requires Level 15' });
  });

  it('combines an in-horizon level requirement with unknown weapon skill', () => {
    const { weaponSkill: _weaponSkill, ...profileWithoutSkill } = profile;

    expect(
      classifyCandidate(
        profileWithoutSkill,
        { ...item, levelRequirement: 15, skillRequirement: 10 },
        new Set(),
      ),
    ).toEqual({
      eligible: true,
      immediate: false,
      reason: 'Requires Level 15 · Requires Weapon Skill 10; confirm in game',
    });
  });

  it('rejects a level requirement beyond the ten-level horizon', () => {
    expect(
      classifyCandidate(
        profile,
        { ...item, levelRequirement: 19 },
        new Set(),
      ),
    ).toEqual({
      eligible: false,
      reason: 'Requires Level 19 beyond the ten-level plan',
    });
  });

  it('labels unknown weapon skill instead of guessing', () => {
    const { weaponSkill: _weaponSkill, ...profileWithoutSkill } = profile;

    expect(
      classifyCandidate(
        profileWithoutSkill,
        { ...item, skillRequirement: 10 },
        new Set(),
      ),
    ).toEqual({
      eligible: true,
      immediate: false,
      reason: 'Requires Weapon Skill 10; confirm in game',
    });
  });

  it('labels a known unmet weapon skill', () => {
    expect(
      classifyCandidate(
        profile,
        { ...item, skillRequirement: 10 },
        new Set(),
      ),
    ).toEqual({
      eligible: true,
      immediate: false,
      reason: 'Requires Weapon Skill 10',
    });
  });

  it('allows an inactive event item only when already owned', () => {
    const eventItem = { ...item, id: 'old-event-sword', availability: 'inactive-event' as const };

    expect(classifyCandidate(profile, eventItem, new Set())).toEqual({
      eligible: false,
      reason: 'Item is not currently obtainable',
    });
    expect(
      classifyCandidate(profile, eventItem, new Set(['old-event-sword'])),
    ).toEqual({ eligible: true, immediate: true });
  });

  it('enforces the Dual Wield 200-skill gate on one-handed weapons', () => {
    const dualProfile = {
      ...profile,
      weaponPath: 'dual-wield' as const,
      weaponSkill: 199,
    };
    const dualSword: EquipmentRecord = {
      ...item,
      weaponPaths: ['one-handed', 'dual-wield'],
    };

    expect(classifyCandidate(dualProfile, dualSword, new Set())).toEqual({
      eligible: true,
      immediate: false,
      reason: 'Requires Weapon Skill 200 for Dual Wield',
    });
    expect(
      classifyCandidate(
        { ...dualProfile, weaponSkill: 200 },
        dualSword,
        new Set(),
      ),
    ).toEqual({ eligible: true, immediate: true });
  });

  it('combines the Dual Wield gate with a future level without duplicate skill text', () => {
    const { weaponSkill: _weaponSkill, ...profileWithoutSkill } = {
      ...profile,
      weaponPath: 'dual-wield' as const,
    };
    const dualSword: EquipmentRecord = {
      ...item,
      weaponPaths: ['one-handed', 'dual-wield'],
      levelRequirement: 15,
      skillRequirement: 10,
    };

    expect(classifyCandidate(profileWithoutSkill, dualSword, new Set())).toEqual({
      eligible: true,
      immediate: false,
      reason: 'Requires Level 15 · Requires Weapon Skill 200 for Dual Wield; confirm in game',
    });
  });
});
