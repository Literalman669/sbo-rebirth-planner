import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from './model';
import {
  buildRevisionSnapshotSchema,
  legacyRevisionId,
  migrateSavedBuildRecord,
  savedBuildRecordSchema,
} from './recordSchema';

function profile(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'build-a',
    name: 'Floor 2 Route',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: ['iron-greatsword'],
    datasetVersion: '2026.08.30.1',
    ...overrides,
  };
}

describe('saved build record schemas', () => {
  it('migrates the exact deployed v5 row to a normal build with a deterministic head', () => {
    const migrated = migrateSavedBuildRecord({
      profile: profile({ id: 'legacy-build' }),
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T11:00:00.000Z',
      archivedAt: '2026-08-30T12:00:00.000Z',
    });

    expect(migrated).toEqual({
      profile: profile({ id: 'legacy-build' }),
      kind: 'build',
      headRevisionId: 'legacy:legacy-build',
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T11:00:00.000Z',
      archivedAt: '2026-08-30T12:00:00.000Z',
    });
  });

  it('accepts a strict personal-preset record and immutable revision', () => {
    const presetProfile = profile({ id: 'preset-a', name: 'Melee Start' });
    const record = savedBuildRecordSchema.parse({
      profile: presetProfile,
      kind: 'personal-preset',
      headRevisionId: 'revision-1',
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T11:00:00.000Z',
    });
    const revision = buildRevisionSnapshotSchema.parse({
      id: 'revision-1',
      buildId: 'preset-a',
      kind: 'personal-preset',
      profile: presetProfile,
      createdAt: '2026-08-30T10:00:00.000Z',
    });

    expect(record.kind).toBe('personal-preset');
    expect(revision).toMatchObject({
      id: 'revision-1',
      buildId: 'preset-a',
      kind: 'personal-preset',
    });
  });

  it('rejects unsupported kinds, extra keys, and revision/profile ownership mismatch', () => {
    const validRecord = {
      profile: profile(),
      kind: 'build',
      headRevisionId: 'revision-1',
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T11:00:00.000Z',
    };

    expect(() =>
      savedBuildRecordSchema.parse({ ...validRecord, kind: 'marketplace' }),
    ).toThrow();
    expect(() =>
      savedBuildRecordSchema.parse({ ...validRecord, ownerIdentity: 'private' }),
    ).toThrow();
    expect(() =>
      buildRevisionSnapshotSchema.parse({
        id: 'revision-1',
        buildId: 'different-build',
        kind: 'build',
        profile: profile(),
        createdAt: '2026-08-30T10:00:00.000Z',
      }),
    ).toThrow('Revision profile must belong to its build');
  });

  it('rejects malformed legacy rows instead of guessing repairs', () => {
    expect(() =>
      migrateSavedBuildRecord({
        profile: { ...profile(), level: 0 },
        createdAt: 'not-a-date',
        updatedAt: '2026-08-30T11:00:00.000Z',
      }),
    ).toThrow('Stored build is invalid');
    expect(() =>
      migrateSavedBuildRecord({
        profile: profile(),
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T11:00:00.000Z',
        unexpected: true,
      }),
    ).toThrow('Stored build is invalid');
  });

  it('keeps synthetic legacy revision IDs within the cloud-compatible boundary', () => {
    const buildId = 'x'.repeat(100);
    const revisionId = legacyRevisionId(buildId);

    expect(revisionId).toHaveLength(100);
    expect(revisionId).toBe(`legacy:${'x'.repeat(93)}`);
  });
});
