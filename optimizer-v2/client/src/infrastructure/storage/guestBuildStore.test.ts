import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from './guestBuildStore';

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

describe('GuestBuildStore', () => {
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

  it('reports a malformed build without discarding valid builds', async () => {
    const name = databaseName('corrupt');
    const store = createGuestBuildStore({ databaseName: name });
    await store.saveBuild(profile('valid'));

    const database = await openDB(name, 1);
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
});
