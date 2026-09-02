import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
  GUEST_DATABASE_VERSION,
  LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE,
  openPlannerDatabase,
} from './plannerDatabase';

function profile(): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'v3-draft',
    name: 'Version three draft',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: { 'main-hand': 'iron-greatsword' },
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

describe('planner database', () => {
  it('upgrades a version five database without losing build, inventory, or planner state', async () => {
    const name = `planner-upgrade-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 5, {
      upgrade(database) {
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
          database.createObjectStore(store);
        }
      },
    });
    await legacy.put('draft', profile(), 'active');
    await legacy.put(
      'builds',
      {
        profile: profile(),
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T11:00:00.000Z',
      },
      profile().id,
    );
    await legacy.put(
      'inventory',
      {
        schemaVersion: 1,
        ownedItemIds: ['iron-greatsword'],
        favoriteItemIds: [],
        comparisonItemIds: [],
        notes: {},
      },
      'primary',
    );
    await legacy.put(
      'plan-progress',
      {
        schemaVersion: 1,
        buildId: profile().id,
        completedActionIds: ['level-9'],
        dismissedRecommendationIds: [],
      },
      profile().id,
    );
    legacy.close();

    const database = await openPlannerDatabase(name);

    expect(database.version).toBe(GUEST_DATABASE_VERSION);
    expect(Array.from(database.objectStoreNames)).toEqual([
      'build-revisions',
      'builds',
      'dataset-releases',
      'dataset-review-receipts',
      'draft',
      'inventory',
      'pending-planner-state',
      'pending-revisions',
      'plan-progress',
      'planner-preferences',
      'quarantine',
    ]);
    await expect(database.get('draft', 'active')).resolves.toEqual(profile());
    await expect(database.get('builds', profile().id)).resolves.toMatchObject({
      profile: { id: profile().id },
    });
    await expect(database.get('inventory', 'primary')).resolves.toMatchObject({
      ownedItemIds: ['iron-greatsword'],
    });
    await expect(database.get('plan-progress', profile().id)).resolves.toEqual(
      expect.objectContaining({ completedActionIds: ['level-9'] }),
    );
    database.close();
  });

  it('upgrades a version six database additively for dataset review receipts', async () => {
    const name = `planner-review-upgrade-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 6, {
      upgrade(database) {
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
          'build-revisions',
        ]) database.createObjectStore(store);
      },
    });
    await legacy.put('draft', profile(), 'active');
    await legacy.put('inventory', { schemaVersion: 1 }, 'primary');
    legacy.close();

    const database = await openPlannerDatabase(name);

    expect(database.version).toBe(7);
    expect(Array.from(database.objectStoreNames)).toContain(
      'dataset-review-receipts',
    );
    await expect(database.get('draft', 'active')).resolves.toEqual(profile());
    await expect(database.get('inventory', 'primary')).resolves.toEqual({
      schemaVersion: 1,
    });
    database.close();
  });

  it('rejects a blocked upgrade instead of leaving providers loading forever', async () => {
    expect(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE).toBe(
      'Close other SBO planner tabs, then reload this page to finish the local data upgrade.',
    );
    const name = `planner-blocked-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 5, {
      upgrade(database) {
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
        ]) database.createObjectStore(store);
      },
    });
    const opening = openPlannerDatabase(name);

    try {
      await expect(
        Promise.race([
          opening,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('blocked test timed out')), 250),
          ),
        ]),
      ).rejects.toThrow(LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE);
    } finally {
      legacy.close();
      await opening.then((database) => database.close()).catch(() => undefined);
    }
  });

  it('times out an open queued behind another blocked upgrade request', async () => {
    const name = `planner-queued-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 5, {
      upgrade(database) {
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
        ]) database.createObjectStore(store);
      },
    });
    const firstUpgrade = openDB(name, GUEST_DATABASE_VERSION, {
      upgrade(database) {
        database.createObjectStore('build-revisions');
      },
    });
    const queued = openPlannerDatabase(name, { timeoutMs: 50 });

    try {
      await expect(queued).rejects.toThrow(
        LOCAL_DATABASE_UPGRADE_BLOCKED_MESSAGE,
      );
    } finally {
      legacy.close();
      await firstUpgrade.then((database) => database.close());
      await queued.catch(() => undefined);
    }
  });
});
