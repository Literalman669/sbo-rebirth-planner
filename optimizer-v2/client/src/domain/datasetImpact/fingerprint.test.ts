import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import {
  buildImpactKeyFingerprint,
  fingerprintBuildInputs,
  fingerprintDatasetSnapshot,
} from './fingerprint';
import type { DatasetReleaseDescriptor } from './releaseIndex';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'impact-build',
  name: 'Impact Route',
  level: 10,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 10,
  stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { armor: 'beginner-armor', 'main-hand': 'iron-greatsword' },
  ownedItemIds: ['steel-greatsword', 'beginner-armor'],
  accessPreferences: {
    activeEvent: true,
    gamepass: false,
    badge: true,
    limited: false,
  },
  datasetVersion: fallbackRelease.version,
};

function descriptor(
  version: string,
  contentFingerprint: string,
): DatasetReleaseDescriptor {
  return {
    version,
    publishedAt: `${version.slice(0, 10).replaceAll('.', '-')}T12:00:00.000Z`,
    lastReviewedAt: version.slice(0, 10).replaceAll('.', '-'),
    formulaSetVersion: 'sbor-stats-v2',
    strategyPolicyVersion: 'sbor-policy-v2',
    contentFingerprint,
    availability: 'cached',
  };
}

describe('dataset impact fingerprints', () => {
  it('keeps build identity and dataset pin out while retaining recommendation inputs', () => {
    const baseline = fingerprintBuildInputs(profile);
    expect(
      fingerprintBuildInputs({
        ...profile,
        id: 'other-id',
        name: 'Renamed route',
        datasetVersion: '2026.09.01.1',
        ownedItemIds: [...profile.ownedItemIds].reverse(),
        equipped: {
          'main-hand': 'iron-greatsword',
          armor: 'beginner-armor',
        },
      }),
    ).toBe(baseline);
    expect(fingerprintBuildInputs({ ...profile, level: 11 })).not.toBe(
      baseline,
    );
    expect(
      fingerprintBuildInputs({
        ...profile,
        accessPreferences: {
          ...profile.accessPreferences!,
          limited: true,
        },
      }),
    ).not.toBe(baseline);
  });

  it('fingerprints snapshot content independently of record ordering', () => {
    const baseline = fingerprintDatasetSnapshot(fallbackRelease);
    const reordered = {
      ...structuredClone(fallbackRelease),
      formulas: [...fallbackRelease.formulas].reverse(),
      mechanics: [...fallbackRelease.mechanics].reverse(),
      catalog: [...fallbackRelease.catalog].reverse(),
      equipment: [...fallbackRelease.equipment].reverse(),
      knownGaps: [...(fallbackRelease.knownGaps ?? [])].reverse(),
    };
    const changed = structuredClone(fallbackRelease);
    changed.catalog[0] = {
      ...changed.catalog[0]!,
      defense: (changed.catalog[0]!.defense ?? 0) + 1,
    };

    expect(fingerprintDatasetSnapshot(reordered)).toBe(baseline);
    expect(fingerprintDatasetSnapshot(changed)).not.toBe(baseline);
  });

  it('changes the cheap impact key for a build or endpoint content change', () => {
    const input = {
      inputFingerprint: fingerprintBuildInputs(profile),
      pinned: descriptor('2026.08.30.1', 'dataset-pinned'),
      target: descriptor('2026.09.01.1', 'dataset-target'),
    };
    const baseline = buildImpactKeyFingerprint(input);

    expect(buildImpactKeyFingerprint(input)).toBe(baseline);
    expect(
      buildImpactKeyFingerprint({
        ...input,
        inputFingerprint: 'build-input-changed',
      }),
    ).not.toBe(baseline);
    expect(
      buildImpactKeyFingerprint({
        ...input,
        target: { ...input.target, contentFingerprint: 'dataset-new-content' },
      }),
    ).not.toBe(baseline);
  });
});
