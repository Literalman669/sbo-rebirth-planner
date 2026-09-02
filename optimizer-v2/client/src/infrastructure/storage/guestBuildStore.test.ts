import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { PlanProgress } from '../../domain/planner/state';
import { DEFAULT_PLANNER_PREFERENCES } from '../../domain/planner/stateSchema';
import { buildStressProfile } from '../../test/stressFixtures';
import {
  createBuildBackup,
  planBuildImport,
  type BuildImportPlan,
  type PortableBuildRecord,
} from '../../domain/build/portable';
import {
  createGuestBuildStore,
  GUEST_DATABASE_VERSION,
} from './guestBuildStore';
import { createDatasetReviewStore } from './datasetReviewStore';

function profile(id: string): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: `Build ${id}`,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'beginner-armor',
    },
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

function databaseName(label: string) {
  return `sbo-rebirth-optimizer-v2-${label}-${crypto.randomUUID()}`;
}

function progress(
  buildId: string,
  completedActionIds: readonly string[] = [],
  skippedActionIds: readonly string[] = [],
): PlanProgress {
  return {
    schemaVersion: 2,
    buildId,
    objectives: [
      ...completedActionIds.map((actionKey) => ({
        actionKey,
        category: 'manual-objective' as const,
        status: 'completed' as const,
        source: 'legacy' as const,
        planFingerprint: 'legacy',
      })),
      ...skippedActionIds.map((actionKey) => ({
        actionKey,
        category: 'manual-objective' as const,
        status: 'skipped' as const,
        source: 'legacy' as const,
        planFingerprint: 'legacy',
      })),
    ],
    history: [],
  };
}

async function createVersionThreeFixture(
  name: string,
  storedProfile: CharacterProfile,
) {
  const database = await openDB(name, 3, {
    upgrade(legacyDatabase) {
      legacyDatabase.createObjectStore('draft');
      legacyDatabase.createObjectStore('builds');
      legacyDatabase.createObjectStore('pending-revisions');
      legacyDatabase.createObjectStore('dataset-releases');
    },
  });
  await database.put('draft', storedProfile, 'active');
  return database;
}

async function createVersionFiveFixture(
  name: string,
  storedProfile: CharacterProfile,
) {
  const database = await openDB(name, 5, {
    upgrade(legacyDatabase) {
      for (const store of [
        'draft',
        'builds',
        'pending-revisions',
        'dataset-releases',
        'planner-preferences',
        'plan-progress',
        'pending-planner-state',
        'quarantine',
        'inventory',
      ]) {
        legacyDatabase.createObjectStore(store);
      }
    },
  });
  await database.put(
    'builds',
    {
      profile: storedProfile,
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-30T11:00:00.000Z',
    },
    storedProfile.id,
  );
  return database;
}

describe('GuestBuildStore', () => {
  it('adds preference and plan-progress stores without losing v3 builds', async () => {
    const name = databaseName('v4-upgrade');
    const legacy = await createVersionThreeFixture(name, profile('legacy-draft'));
    legacy.close();

    const store = createGuestBuildStore({ databaseName: name });

    await expect(store.loadDraft()).resolves.toEqual(profile('legacy-draft'));
    await expect(store.loadPreferences()).resolves.toEqual(
      DEFAULT_PLANNER_PREFERENCES,
    );
  });

  it('persists preferences and progress independently from the build profile', async () => {
    const name = databaseName('planner-state');
    const first = createGuestBuildStore({ databaseName: name });
    const storedProgress: PlanProgress = {
      ...progress('build-1', ['level-2'], ['upgrade-1']),
      reconciledThroughLevel: 2,
    };
    await first.savePreferences({
      ...DEFAULT_PLANNER_PREFERENCES,
      mode: 'detailed',
      density: 'compact',
    });
    await first.savePlanProgress(storedProgress);

    const second = createGuestBuildStore({ databaseName: name });
    await expect(second.loadPreferences()).resolves.toMatchObject({
      mode: 'detailed',
      density: 'compact',
    });
    await expect(second.loadPlanProgress('build-1')).resolves.toEqual(
      storedProgress,
    );

    await second.deletePlanProgress('build-1');
    await expect(second.loadPlanProgress('build-1')).resolves.toBeNull();
  });

  it('quarantines malformed preferences before returning a recoverable error', async () => {
    const name = databaseName('quarantine-preferences');
    const store = createGuestBuildStore({
      databaseName: name,
      now: () => '2026-08-30T12:00:00.000Z',
    });
    await store.loadPreferences();
    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put(
      'planner-preferences',
      { schemaVersion: 1, mode: 'impossible' },
      'primary',
    );
    database.close();

    await expect(store.loadPreferences()).rejects.toThrow(
      'Stored planner preferences are invalid',
    );
    const quarantined = await store.listQuarantinedRecords();
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toMatchObject({
      kind: 'planner-preferences',
      quarantinedAt: '2026-08-30T12:00:00.000Z',
    });
    await expect(store.exportQuarantinedRecord(quarantined[0]!.id)).resolves.toBe(
      JSON.stringify({ schemaVersion: 1, mode: 'impossible' }),
    );

    await store.deleteQuarantinedRecord(quarantined[0]!.id);
    await expect(store.listQuarantinedRecords()).resolves.toEqual([]);
  });

  it('quarantines malformed progress without deleting valid neighboring progress', async () => {
    const name = databaseName('quarantine-progress');
    const store = createGuestBuildStore({ databaseName: name });
    await store.savePlanProgress(progress('valid-build'));
    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put(
      'plan-progress',
      { schemaVersion: 1, buildId: 'broken-build', completedActionIds: 'bad' },
      'broken-build',
    );
    database.close();

    await expect(store.loadPlanProgress('broken-build')).rejects.toThrow(
      'Stored plan progress is invalid',
    );
    await expect(store.loadPlanProgress('valid-build')).resolves.toMatchObject({
      buildId: 'valid-build',
    });
    await expect(store.listQuarantinedRecords()).resolves.toHaveLength(1);
  });

  it('restores the active draft through a fresh adapter instance', async () => {
    const name = databaseName('draft');
    await createGuestBuildStore({ databaseName: name }).saveDraft(profile('draft'));

    await expect(
      createGuestBuildStore({ databaseName: name }).loadDraft(),
    ).resolves.toEqual(profile('draft'));
  });

  it('lists named builds by most recent update', async () => {
    const name = databaseName('sort');
    const timestamps = [
      '2026-08-29T10:00:00.000Z',
      '2026-08-29T11:00:00.000Z',
    ];
    const store = createGuestBuildStore({
      databaseName: name,
      now: () => timestamps.shift()!,
    });

    await store.saveBuild(profile('older'));
    await store.saveBuild(profile('newer'));

    const results = await store.listBuilds();
    expect(results.filter((result) => result.ok).map((result) => result.value.profile.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('migrates a deployed v5 build row and synthesizes one immutable revision', async () => {
    const name = databaseName('v6-build-migration');
    const legacyProfile = profile('legacy-build');
    const legacy = await createVersionFiveFixture(name, legacyProfile);
    legacy.close();

    const store = createGuestBuildStore({ databaseName: name });
    const builds = await store.listBuilds();

    expect(builds).toEqual([
      {
        ok: true,
        value: {
          profile: legacyProfile,
          kind: 'build',
          headRevisionId: 'legacy:legacy-build',
          createdAt: '2026-08-30T10:00:00.000Z',
          updatedAt: '2026-08-30T11:00:00.000Z',
        },
      },
    ]);
    await expect(store.listBuildHistory('legacy-build')).resolves.toEqual([
      {
        id: 'legacy:legacy-build',
        buildId: 'legacy-build',
        kind: 'build',
        profile: legacyProfile,
        createdAt: '2026-08-30T10:00:00.000Z',
      },
    ]);
  });

  it('synthesizes the legacy baseline before a direct save without listing first', async () => {
    const name = databaseName('v6-direct-save-migration');
    const legacyProfile = profile('legacy-direct');
    const legacy = await createVersionFiveFixture(name, legacyProfile);
    legacy.close();
    const store = createGuestBuildStore({ databaseName: name });

    await store.saveBuild(
      {
        ...legacyProfile,
        level: 9,
        stats: { ...legacyProfile.stats, str: 17 },
      },
      { revisionId: 'revision-after-migration' },
    );

    expect((await store.listBuildHistory('legacy-direct')).map((row) => row.id))
      .toEqual(['legacy:legacy-direct', 'revision-after-migration']);
  });

  it('synthesizes the legacy baseline before a direct restore without listing first', async () => {
    const name = databaseName('v6-direct-restore-migration');
    const legacyProfile = profile('legacy-restore');
    const legacy = await createVersionFiveFixture(name, legacyProfile);
    legacy.close();
    const store = createGuestBuildStore({ databaseName: name });

    await store.restoreBuildRevision(
      'legacy-restore',
      'legacy:legacy-restore',
      'restored-revision',
    );

    expect((await store.listBuildHistory('legacy-restore')).map((row) => row.id))
      .toEqual(['legacy:legacy-restore', 'restored-revision']);
  });

  it('stores immutable revisions, skips identical saves, and restores through a new head', async () => {
    const timestamps = [
      '2026-08-30T10:00:00.000Z',
      '2026-08-30T11:00:00.000Z',
      '2026-08-30T12:00:00.000Z',
      '2026-08-30T13:00:00.000Z',
    ];
    const store = createGuestBuildStore({
      databaseName: databaseName('revision-history'),
      now: () => timestamps.shift()!,
    });
    const levelEight = profile('history-build');
    const levelNine = {
      ...levelEight,
      level: 9,
      stats: { ...levelEight.stats, str: 17 },
    };

    await store.saveBuild(levelEight, { revisionId: 'revision-1' });
    await store.saveBuild(levelEight, { revisionId: 'ignored-identical' });
    await store.saveBuild(levelNine, { revisionId: 'revision-2' });

    expect((await store.listBuildHistory('history-build')).map((row) => row.id))
      .toEqual(['revision-1', 'revision-2']);
    await store.restoreBuildRevision(
      'history-build',
      'revision-1',
      'revision-3',
    );

    const [current] = await store.listBuilds();
    expect(current).toMatchObject({
      ok: true,
      value: {
        profile: { id: 'history-build', level: 8 },
        kind: 'build',
        headRevisionId: 'revision-3',
      },
    });
    const history = await store.listBuildHistory('history-build');
    expect(history).toMatchObject([
      { id: 'revision-1' },
      { id: 'revision-2', parentRevisionId: 'revision-1' },
      { id: 'revision-3', parentRevisionId: 'revision-2', profile: { level: 8 } },
    ]);
    expect(history[0]).not.toHaveProperty('parentRevisionId');
  });

  it('preserves personal-preset kind through duplicate and deletes history with the build', async () => {
    const name = databaseName('kind-and-delete');
    const store = createGuestBuildStore({ databaseName: name });
    await store.saveBuild(profile('preset'), {
      kind: 'personal-preset',
      revisionId: 'preset-revision',
    });
    await store.savePlanProgress(progress('preset'));
    const reviewStore = createDatasetReviewStore({ databaseName: name });
    await reviewStore.save({
      schemaVersion: 1,
      buildId: 'preset',
      inputFingerprint: 'build-input-preset',
      pinnedDatasetVersion: '2026.08.30.1',
      targetDatasetVersion: '2026.09.01.1',
      impactKeyFingerprint: 'impact-preset',
      reportFingerprint: 'impact-report-preset',
      status: 'reviewed',
      reviewedAt: '2026-09-02T00:00:00.000Z',
    });

    await store.duplicateBuild('preset', 'preset-copy', 'Preset copy');
    const copied = (await store.listBuilds()).find(
      (row) => row.ok && row.value.profile.id === 'preset-copy',
    );
    expect(copied).toMatchObject({
      ok: true,
      value: { kind: 'personal-preset', headRevisionId: expect.any(String) },
    });
    await expect(store.listBuildHistory('preset-copy')).resolves.toHaveLength(1);

    await store.deleteBuild('preset');
    await expect(store.listBuildHistory('preset')).resolves.toEqual([]);
    await expect(store.loadPlanProgress('preset')).resolves.toBeNull();
    await expect(reviewStore.load('preset')).resolves.toBeNull();
  });

  it('renames, duplicates deeply, and archives without changing the original identity', async () => {
    const timestamps = [
      '2026-08-30T10:00:00.000Z',
      '2026-08-30T11:00:00.000Z',
      '2026-08-30T12:00:00.000Z',
      '2026-08-30T13:00:00.000Z',
    ];
    const store = createGuestBuildStore({
      databaseName: databaseName('lifecycle'),
      now: () => timestamps.shift()!,
    });
    await store.saveBuild({
      ...profile('original'),
      name: 'Original',
      ownedItemIds: ['iron-greatsword'],
    });

    await store.renameBuild('original', 'Renamed');
    const duplicate = await store.duplicateBuild(
      'original',
      'duplicate',
      'Renamed copy',
    );
    await store.setBuildArchived('original', true);

    expect(duplicate).toMatchObject({ id: 'duplicate', name: 'Renamed copy' });
    duplicate.ownedItemIds.push('mutated-only-copy');
    const results = await store.listBuilds();
    const original = results.find(
      (result) => result.ok && result.value.profile.id === 'original',
    );
    const copied = results.find(
      (result) => result.ok && result.value.profile.id === 'duplicate',
    );
    expect(original).toMatchObject({
      ok: true,
      value: {
        profile: { id: 'original', name: 'Renamed', ownedItemIds: ['iron-greatsword'] },
        createdAt: '2026-08-30T10:00:00.000Z',
        archivedAt: '2026-08-30T13:00:00.000Z',
      },
    });
    expect(copied).toMatchObject({
      ok: true,
      value: { profile: { id: 'duplicate', name: 'Renamed copy' } },
    });
  });

  it('deletes one named build without affecting another', async () => {
    const store = createGuestBuildStore({ databaseName: databaseName('delete') });
    await store.saveBuild(profile('keep'));
    await store.saveBuild(profile('remove'));

    await store.deleteBuild('remove');

    const results = await store.listBuilds();
    expect(results.filter((result) => result.ok).map((result) => result.value.profile.id)).toEqual([
      'keep',
    ]);
  });

  it('orders 250 controlled builds newest first and deletes only build 127', async () => {
    const timestamps = Array.from({ length: 250 }, (_, index) =>
      new Date(Date.UTC(2026, 7, 29, 0, index)).toISOString(),
    );
    const store = createGuestBuildStore({
      databaseName: databaseName('volume'),
      now: () => timestamps.shift()!,
    });
    const activeDraft = buildStressProfile({ id: 'active-draft' });
    await store.saveDraft(activeDraft);

    for (let index = 0; index < 250; index += 1) {
      await store.saveBuild(
        buildStressProfile({
          id: `build-${index}`,
          weaponPath: index % 2 === 0 ? 'two-handed' : 'one-handed',
        }),
      );
    }

    expect(
      (await store.listBuilds())
        .filter((result) => result.ok)
        .map((result) => result.value.profile.id),
    ).toEqual(Array.from({ length: 250 }, (_, index) => `build-${249 - index}`));

    await store.deleteBuild('build-127');

    expect(
      (await store.listBuilds())
        .filter((result) => result.ok)
        .map((result) => result.value.profile.id),
    ).toEqual(
      Array.from({ length: 250 }, (_, index) => `build-${249 - index}`).filter(
        (id) => id !== 'build-127',
      ),
    );
    await expect(store.loadDraft()).resolves.toEqual(activeDraft);
  });

  it('clears the active draft without deleting named builds', async () => {
    const store = createGuestBuildStore({ databaseName: databaseName('clear') });
    await store.saveDraft(profile('draft'));
    await store.saveBuild(profile('named'));

    await store.clearDraft();

    await expect(store.loadDraft()).resolves.toBeNull();
    const builds = await store.listBuilds();
    expect(builds.find((result) => result.ok)?.value.profile.id).toBe('named');
  });

  it('reports a malformed build without discarding valid builds', async () => {
    const name = databaseName('corrupt');
    const store = createGuestBuildStore({ databaseName: name });
    await store.saveBuild(profile('valid'));

    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put(
      'builds',
      {
        profile: { id: 'broken' },
        createdAt: 'not-a-date',
        updatedAt: 'not-a-date',
      },
      'broken',
    );
    database.close();

    const results = await store.listBuilds();
    expect(
      results.find((result) => result.ok)?.value.profile.id,
    ).toBe('valid');
    expect(results.find((result) => !result.ok)).toEqual({
      ok: false,
      id: 'broken',
      error: 'Stored build is invalid',
    });
  });

  it('isolates corrupt draft and named rows while retaining valid named neighbors', async () => {
    const name = databaseName('corrupt-rows');
    const store = createGuestBuildStore({ databaseName: name });
    await store.saveBuild(buildStressProfile({ id: 'before-corruption' }));
    await store.saveBuild(buildStressProfile({ id: 'after-corruption' }));

    const database = await openDB(name, GUEST_DATABASE_VERSION);
    await database.put('draft', { id: 'broken-draft' }, 'active');
    await database.put(
      'builds',
      { profile: { id: 'broken-build' }, createdAt: 'not-a-date', updatedAt: 'not-a-date' },
      'broken-build',
    );
    database.close();

    await expect(store.loadDraft()).rejects.toThrow('Stored draft is invalid');
    expect(
      (await store.listBuilds())
        .filter((result) => result.ok)
        .map((result) => result.value.profile.id)
        .sort(),
    ).toEqual(['after-corruption', 'before-corruption']);
    expect(await store.listBuilds()).toContainEqual({
      ok: false,
      id: 'broken-build',
      error: 'Stored build is invalid',
    });
  });

  it('exports current profile, progress, kind, and complete local history', async () => {
    const store = createGuestBuildStore({
      databaseName: databaseName('portable-export'),
      now: (() => {
        const values = [
          '2026-09-01T10:00:00.000Z',
          '2026-09-01T11:00:00.000Z',
        ];
        return () => values.shift()!;
      })(),
    });
    await store.saveBuild(profile('portable-build'), {
      kind: 'personal-preset',
      revisionId: 'portable-revision-1',
    });
    await store.saveBuild(
      { ...profile('portable-build'), level: 9, stats: { str: 17, def: 0, agi: 3, vit: 7, luk: 0 } },
      { kind: 'personal-preset', revisionId: 'portable-revision-2' },
    );
    await store.savePlanProgress(progress('portable-build', ['level-9']));

    await expect(store.exportBuildRecords(['portable-build'])).resolves.toMatchObject([
      {
        kind: 'personal-preset',
        profile: { id: 'portable-build', level: 9 },
        headRevisionId: 'portable-revision-2',
        planProgress: {
          buildId: 'portable-build',
          objectives: [{ actionKey: 'level-9', status: 'completed' }],
        },
        revisions: [
          { id: 'portable-revision-1', kind: 'personal-preset' },
          { id: 'portable-revision-2', parentRevisionId: 'portable-revision-1' },
        ],
      },
    ]);
  });

  it('imports a duplicate plan atomically with remapped history and progress', async () => {
    const store = createGuestBuildStore({ databaseName: databaseName('portable-import') });
    await store.saveBuild(profile('source-build'), { revisionId: 'existing-head' });
    const exported = (await store.exportBuildRecords(['source-build']))[0]!;
    const ids = ['duplicate-build', 'duplicate-revision'];
    const plan = planBuildImport(
      createBuildBackup({
        scope: 'single',
        exportedAt: '2026-09-01T12:00:00.000Z',
        records: [exported],
      }),
      new Map([['source-build', { headRevisionId: 'existing-head' }]]),
      { randomUUID: () => ids.shift()! },
    );

    await store.importBuildPlan(plan);

    expect(
      (await store.listBuilds())
        .filter((row) => row.ok)
        .map((row) => row.value.profile.id)
        .sort(),
    ).toEqual(['duplicate-build', 'source-build']);
    await expect(store.listBuildHistory('duplicate-build')).resolves.toMatchObject([
      { id: 'duplicate-revision', buildId: 'duplicate-build' },
    ]);
  });

  it('appends an overwrite plan to existing history without deleting the prior head', async () => {
    const store = createGuestBuildStore({ databaseName: databaseName('portable-overwrite') });
    await store.saveBuild(profile('overwrite-build'), { revisionId: 'existing-head' });
    const incoming: PortableBuildRecord = {
      profile: { ...profile('overwrite-build'), level: 9, stats: { str: 17, def: 0, agi: 3, vit: 7, luk: 0 } },
      kind: 'build',
      headRevisionId: 'incoming-head',
      createdAt: '2026-09-01T11:00:00.000Z',
      updatedAt: '2026-09-01T11:00:00.000Z',
      revisions: [{
        id: 'incoming-head',
        buildId: 'overwrite-build',
        kind: 'build',
        profile: { ...profile('overwrite-build'), level: 9, stats: { str: 17, def: 0, agi: 3, vit: 7, luk: 0 } },
        createdAt: '2026-09-01T11:00:00.000Z',
      }],
    };
    const ids = ['imported-head'];
    const plan = planBuildImport(
      createBuildBackup({
        scope: 'single',
        exportedAt: '2026-09-01T12:00:00.000Z',
        records: [incoming],
      }),
      new Map([['overwrite-build', { headRevisionId: 'existing-head' }]]),
      { mode: 'overwrite', randomUUID: () => ids.shift()! },
    );

    await store.importBuildPlan(plan);

    expect(await store.listBuildHistory('overwrite-build')).toMatchObject([
      { id: 'existing-head' },
      { id: 'imported-head', parentRevisionId: 'existing-head' },
    ]);
    expect(
      (await store.listBuilds()).find(
        (row) => row.ok && row.value.profile.id === 'overwrite-build',
      ),
    ).toMatchObject({ ok: true, value: { profile: { level: 9 } } });
  });

  it('rejects a malformed multi-record import before writing any record', async () => {
    const store = createGuestBuildStore({ databaseName: databaseName('portable-rollback') });
    const valid: PortableBuildRecord = {
      profile: profile('valid-import'),
      kind: 'build',
      headRevisionId: 'valid-revision',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      revisions: [{
        id: 'valid-revision',
        buildId: 'valid-import',
        kind: 'build',
        profile: profile('valid-import'),
        createdAt: '2026-09-01T10:00:00.000Z',
      }],
    };
    const malformed = {
      ...structuredClone(valid),
      profile: { ...valid.profile, id: 'malformed-import', level: 0 },
    } as unknown as PortableBuildRecord;
    const plan = {
      mode: 'duplicate',
      records: [valid, malformed],
      preview: [],
    } satisfies BuildImportPlan;

    await expect(store.importBuildPlan(plan)).rejects.toThrow(
      'Build import plan is invalid',
    );
    await expect(store.listBuilds()).resolves.toEqual([]);
  });
});
