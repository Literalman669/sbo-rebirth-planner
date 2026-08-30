import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { PlanProgress } from '../../domain/planner/state';
import { DEFAULT_PLANNER_PREFERENCES } from '../../domain/planner/stateSchema';
import { buildStressProfile } from '../../test/stressFixtures';
import {
  createGuestBuildStore,
  GUEST_DATABASE_VERSION,
} from './guestBuildStore';

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
    const progress: PlanProgress = {
      schemaVersion: 1,
      buildId: 'build-1',
      completedActionIds: ['level-2'],
      dismissedRecommendationIds: ['upgrade-1'],
      reconciledThroughLevel: 2,
    };
    await first.savePreferences({
      ...DEFAULT_PLANNER_PREFERENCES,
      mode: 'detailed',
      density: 'compact',
    });
    await first.savePlanProgress(progress);

    const second = createGuestBuildStore({ databaseName: name });
    await expect(second.loadPreferences()).resolves.toMatchObject({
      mode: 'detailed',
      density: 'compact',
    });
    await expect(second.loadPlanProgress('build-1')).resolves.toEqual(progress);

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
    await store.savePlanProgress({
      schemaVersion: 1,
      buildId: 'valid-build',
      completedActionIds: [],
      dismissedRecommendationIds: [],
    });
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
});
