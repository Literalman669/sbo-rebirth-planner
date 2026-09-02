import { describe, expect, it } from 'vitest';
import type { BuildLibraryEntry } from '../build/library';
import type { CharacterProfile } from '../build/model';
import type { DatasetReviewReceipt } from './reviewReceipt';
import {
  buildImpactKeyFingerprint,
  fingerprintBuildInputs,
} from './fingerprint';
import type { DatasetReleaseDescriptor } from './releaseIndex';
import { selectDatasetImpactCandidates } from './candidates';

function profile(
  id: string,
  datasetVersion = '2026.08.30.1',
  name = `Build ${id}`,
): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion,
  };
}

function release(
  version: string,
  publishedAt: string,
): DatasetReleaseDescriptor {
  return {
    version,
    publishedAt,
    lastReviewedAt: publishedAt.slice(0, 10),
    formulaSetVersion: 'sbor-stats-v2',
    strategyPolicyVersion: 'sbor-policy-v2',
    contentFingerprint: `dataset-${version}`,
    availability: 'cached',
  };
}

function entry(
  build: CharacterProfile,
  overrides: Partial<BuildLibraryEntry> = {},
): BuildLibraryEntry {
  return {
    id: build.id,
    profile: build,
    kind: 'build',
    source: 'local',
    headRevisionId: `${build.id}-head`,
    updatedAt: '2026-09-02T00:00:00.000Z',
    history: [],
    ...overrides,
  };
}

function reviewedReceipt(
  build: CharacterProfile,
  pinned: DatasetReleaseDescriptor,
  target: DatasetReleaseDescriptor,
): DatasetReviewReceipt {
  const inputFingerprint = fingerprintBuildInputs(build);
  return {
    schemaVersion: 1,
    buildId: build.id,
    inputFingerprint,
    pinnedDatasetVersion: pinned.version,
    targetDatasetVersion: target.version,
    impactKeyFingerprint: buildImpactKeyFingerprint({
      inputFingerprint,
      pinned,
      target,
    }),
    reportFingerprint: `impact-report-${build.id}`,
    status: 'reviewed',
    reviewedAt: '2026-09-02T00:00:00.000Z',
  };
}

describe('dataset impact candidates', () => {
  const pinned = release('2026.08.30.1', '2026-08-30T12:00:00.000Z');
  const target = release('2026.09.01.1', '2026-09-01T12:00:00.000Z');

  it('deduplicates the active saved mirror and labels every player-owned kind', () => {
    const active = profile('active', pinned.version, 'Active Route');
    const preset = profile('preset', pinned.version, 'Preset Route');
    const archived = profile('archived', pinned.version, 'Archived Route');
    const candidates = selectDatasetImpactCandidates({
      active: { profile: active, hasActiveDraft: true },
      entries: [
        entry(active, { source: 'local+cloud', headRevisionId: 'active-head' }),
        entry(preset, { kind: 'personal-preset' }),
        entry(archived, { archivedAt: '2026-09-01T00:00:00.000Z' }),
        entry(profile('current', target.version)),
      ],
      releases: [pinned, target],
      targetVersion: target.version,
      receipts: [reviewedReceipt(preset, pinned, target)],
    });

    expect(candidates.map(({ id }) => id)).toEqual([
      'active',
      'archived',
      'preset',
    ]);
    expect(candidates[0]).toMatchObject({
      source: 'active',
      backingSource: 'local+cloud',
      headRevisionId: 'active-head',
      kind: 'active-draft',
      savedKind: 'build',
      status: 'unreviewed',
    });
    expect(candidates.find(({ id }) => id === 'preset')).toMatchObject({
      kind: 'personal-preset',
      status: 'reviewed-pinned',
    });
    expect(candidates.find(({ id }) => id === 'archived')?.archivedAt)
      .toBe('2026-09-01T00:00:00.000Z');
  });

  it('keeps missing pinned releases blocked and invalidates receipts after edits or releases', () => {
    const build = profile('reviewed', pinned.version);
    const missing = profile('missing', '2026.01.01.1');
    const receipt = reviewedReceipt(build, pinned, target);
    const candidates = selectDatasetImpactCandidates({
      active: { profile: profile('empty'), hasActiveDraft: false },
      entries: [entry({ ...build, level: 9 }), entry(missing)],
      releases: [pinned, target],
      targetVersion: target.version,
      receipts: [receipt],
    });

    expect(candidates.find(({ id }) => id === 'reviewed')?.status).toBe(
      'unreviewed',
    );
    expect(candidates.find(({ id }) => id === 'missing')).toMatchObject({
      status: 'blocked',
      pinned: undefined,
      impactKeyFingerprint: undefined,
    });
  });
});
