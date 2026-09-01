import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from './model';
import type { PortableBuildRecord } from './portable';
import {
  MAX_BUILD_BACKUP_BYTES,
  createBuildBackup,
  parseBuildBackup,
  planBuildImport,
  portableRecordFromCloud,
  serializeBuildBackup,
} from './portable';

function profile(id: string, name = `Build ${id}`): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: [],
    datasetVersion: '2026.08.30.1',
  };
}

function record(id: string): PortableBuildRecord {
  const first = profile(id);
  const second = { ...first, level: 9, stats: { ...first.stats, str: 17 } };
  return {
    profile: second,
    kind: 'build',
    headRevisionId: `${id}-revision-2`,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
    planProgress: {
      schemaVersion: 1,
      buildId: id,
      completedActionIds: ['level-9'],
      dismissedRecommendationIds: [],
    },
    revisions: [
      {
        id: `${id}-revision-1`,
        buildId: id,
        kind: 'build',
        profile: first,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        id: `${id}-revision-2`,
        buildId: id,
        parentRevisionId: `${id}-revision-1`,
        kind: 'build',
        profile: second,
        createdAt: '2026-09-01T11:00:00.000Z',
      },
    ],
  };
}

describe('portable build backups', () => {
  it('round-trips deterministic sorted JSON with exactly one trailing newline', () => {
    const envelope = createBuildBackup({
      scope: 'library',
      exportedAt: '2026-09-01T12:00:00.000Z',
      records: [record('z-build'), record('a-build')],
    });
    const serialized = serializeBuildBackup(envelope);

    expect(serialized.endsWith('\n')).toBe(true);
    expect(serialized.endsWith('\n\n')).toBe(false);
    expect(parseBuildBackup(serialized)).toEqual({
      ...envelope,
      records: [record('a-build'), record('z-build')],
    });
  });

  it('rejects private fields, future schemas, invalid heads, and oversized input', () => {
    const envelope = createBuildBackup({
      scope: 'single',
      exportedAt: '2026-09-01T12:00:00.000Z',
      records: [record('build-a')],
    });
    expect(() =>
      parseBuildBackup(
        JSON.stringify({ ...envelope, ownerIdentity: 'private-owner' }),
      ),
    ).toThrow('Build backup is invalid or unsupported');
    expect(() =>
      parseBuildBackup(JSON.stringify({ ...envelope, schemaVersion: 2 })),
    ).toThrow('Build backup is invalid or unsupported');
    expect(() =>
      parseBuildBackup(
        JSON.stringify({
          ...envelope,
          records: [{ ...record('build-a'), headRevisionId: 'missing-head' }],
        }),
      ),
    ).toThrow('Build backup is invalid or unsupported');
    expect(() => parseBuildBackup('x'.repeat(MAX_BUILD_BACKUP_BYTES + 1))).toThrow(
      'Build backup exceeds 10 MiB',
    );
  });

  it('serializes only the strict portable contract', () => {
    const serialized = serializeBuildBackup(
      createBuildBackup({
        scope: 'single',
        exportedAt: '2026-09-01T12:00:00.000Z',
        records: [record('build-a')],
      }),
    );

    for (const privateKey of [
      'ownerIdentity',
      'idToken',
      'shareId',
      'pendingQueue',
      'cloudRowId',
    ]) {
      expect(serialized).not.toContain(privateKey);
    }
  });

  it('duplicates by default and remaps build, revision, parent, and progress IDs', () => {
    const ids = ['new-build', 'new-revision-1', 'new-revision-2'];
    const plan = planBuildImport(
      createBuildBackup({
        scope: 'single',
        exportedAt: '2026-09-01T12:00:00.000Z',
        records: [record('build-a')],
      }),
      new Map([['build-a', { headRevisionId: 'existing-head' }]]),
      { randomUUID: () => ids.shift()! },
    );

    expect(plan.mode).toBe('duplicate');
    expect(plan.records[0]).toMatchObject({
      profile: { id: 'new-build', name: 'Build build-a imported' },
      headRevisionId: 'new-revision-2',
      planProgress: { buildId: 'new-build' },
      revisions: [
        { id: 'new-revision-1', buildId: 'new-build' },
        {
          id: 'new-revision-2',
          buildId: 'new-build',
          parentRevisionId: 'new-revision-1',
        },
      ],
    });
    expect(plan.preview).toEqual([
      expect.objectContaining({
        sourceId: 'build-a',
        targetId: 'new-build',
        conflict: true,
        action: 'duplicate',
      }),
    ]);
  });

  it('attaches overwrite history to the existing head and preserves nonconflicting IDs', () => {
    const revisionIds = ['overwrite-revision-1', 'overwrite-revision-2'];
    const envelope = createBuildBackup({
      scope: 'library',
      exportedAt: '2026-09-01T12:00:00.000Z',
      records: [record('build-a'), record('build-new')],
    });
    const plan = planBuildImport(
      envelope,
      new Map([['build-a', { headRevisionId: 'existing-head' }]]),
      {
        mode: 'overwrite',
        randomUUID: () =>
          revisionIds.shift() ?? `new-${crypto.randomUUID()}`,
      },
    );

    const overwritten = plan.records.find(
      (candidate) => candidate.profile.id === 'build-a',
    )!;
    const created = plan.records.find(
      (candidate) => candidate.profile.id === 'build-new',
    )!;
    expect(overwritten.revisions[0]?.parentRevisionId).toBe('existing-head');
    expect(created.profile.id).toBe('build-new');
    expect(plan.preview.map(({ action }) => action)).toEqual([
      'overwrite',
      'create',
    ]);
  });

  it('converts available cloud history into a portable parent chain', () => {
    const first = profile('cloud-build');
    const second = { ...first, level: 9, stats: { ...first.stats, str: 17 } };

    expect(
      portableRecordFromCloud({
        profile: second,
        kind: 'personal-preset',
        headRevisionId: 'cloud-revision-2',
        archivedAt: '2026-09-01T12:00:00.000Z',
        history: [
          {
            revisionId: 'cloud-revision-1',
            createdAt: '2026-09-01T10:00:00.000Z',
            datasetVersion: first.datasetVersion,
            profile: first,
            kind: 'personal-preset',
          },
          {
            revisionId: 'cloud-revision-2',
            createdAt: '2026-09-01T11:00:00.000Z',
            datasetVersion: second.datasetVersion,
            profile: second,
            kind: 'personal-preset',
          },
        ],
      }),
    ).toMatchObject({
      kind: 'personal-preset',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T11:00:00.000Z',
      archivedAt: '2026-09-01T12:00:00.000Z',
      revisions: [
        { id: 'cloud-revision-1' },
        { id: 'cloud-revision-2', parentRevisionId: 'cloud-revision-1' },
      ],
    });
    expect(
      portableRecordFromCloud({
        profile: second,
        kind: 'personal-preset',
        headRevisionId: 'cloud-revision-2',
        history: [
          {
            revisionId: 'cloud-revision-1',
            createdAt: '2026-09-01T10:00:00.000Z',
            datasetVersion: first.datasetVersion,
            profile: first,
            kind: 'personal-preset',
          },
          {
            revisionId: 'cloud-revision-2',
            createdAt: '2026-09-01T11:00:00.000Z',
            datasetVersion: second.datasetVersion,
            profile: second,
            kind: 'personal-preset',
          },
        ],
      }).revisions[0],
    ).not.toHaveProperty('parentRevisionId');
  });
});
