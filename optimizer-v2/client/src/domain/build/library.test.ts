import { describe, expect, it } from 'vitest';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';
import type { CharacterProfile } from './model';
import { findBuildLibraryEntry, mergeBuildLibrary } from './library';

function profile(
  id: string,
  level: number,
  name = `Build ${id}`,
): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: '2026.08.30.1',
  };
}

function local(
  id: string,
  level: number,
  overrides: Partial<Extract<GuestBuildListResult, { ok: true }>['value']> = {},
): GuestBuildListResult {
  return {
    ok: true,
    value: {
      profile: profile(id, level),
      kind: 'build',
      headRevisionId: `${id}-local-head`,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      ...overrides,
    },
  };
}

function cloud(id: string, level: number): CloudBuildRecord {
  const cloudProfile = profile(id, level);
  return {
    profile: cloudProfile,
    kind: 'build',
    headRevisionId: `${id}-cloud-head`,
    history: [
      {
        revisionId: `${id}-cloud-head`,
        createdAt: '2026-09-01T11:00:00.000Z',
        datasetVersion: cloudProfile.datasetVersion,
        profile: cloudProfile,
        kind: 'build',
      },
    ],
  };
}

describe('build library merge', () => {
  it('deduplicates a local/cloud mirror and keeps local current state', () => {
    const entries = mergeBuildLibrary([local('route-a', 21)], [cloud('route-a', 20)]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'route-a',
      source: 'local+cloud',
      profile: { level: 21 },
      kind: 'build',
      headRevisionId: 'route-a-local-head',
      updatedAt: '2026-09-01T12:00:00.000Z',
    });
    expect(entries[0]?.history.map((revision) => revision.id)).toEqual([
      'route-a-cloud-head',
      'route-a-local-head',
    ]);
  });

  it('keeps local-only and cloud-only records with explicit sources', () => {
    const entries = mergeBuildLibrary(
      [local('local-only', 8)],
      [cloud('cloud-only', 12)],
    );

    expect(entries.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: 'cloud-only', source: 'cloud' },
      { id: 'local-only', source: 'local' },
    ]);
  });

  it('preserves local kind/archive state and ignores unavailable local rows', () => {
    const entries = mergeBuildLibrary(
      [
        local('preset-a', 8, {
          kind: 'personal-preset',
          archivedAt: '2026-09-01T12:30:00.000Z',
        }),
        { ok: false, id: 'broken', error: 'Stored build is invalid' },
      ],
      [],
    );

    expect(entries).toMatchObject([
      {
        id: 'preset-a',
        kind: 'personal-preset',
        source: 'local',
        archivedAt: '2026-09-01T12:30:00.000Z',
      },
    ]);
    expect(findBuildLibraryEntry(entries, 'broken')).toBeNull();
    expect(findBuildLibraryEntry(entries, 'preset-a')?.profile.id).toBe(
      'preset-a',
    );
  });

  it('uses the validated cloud head when no local copy exists', () => {
    const preset = cloud('cloud-preset', 18);
    preset.kind = 'personal-preset';
    preset.history[0] = { ...preset.history[0]!, kind: 'personal-preset' };

    expect(mergeBuildLibrary([], [preset])).toMatchObject([
      {
        id: 'cloud-preset',
        source: 'cloud',
        kind: 'personal-preset',
        profile: { level: 18 },
      },
    ]);
  });
});
