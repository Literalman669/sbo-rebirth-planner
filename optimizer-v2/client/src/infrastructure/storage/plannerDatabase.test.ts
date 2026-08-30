import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
  GUEST_DATABASE_VERSION,
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
  it('upgrades a version three database without losing its draft', async () => {
    const name = `planner-upgrade-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 3, {
      upgrade(database) {
        database.createObjectStore('draft');
        database.createObjectStore('builds');
        database.createObjectStore('pending-revisions');
        database.createObjectStore('dataset-releases');
      },
    });
    await legacy.put('draft', profile(), 'active');
    legacy.close();

    const database = await openPlannerDatabase(name);

    expect(database.version).toBe(GUEST_DATABASE_VERSION);
    expect(Array.from(database.objectStoreNames)).toEqual([
      'builds',
      'dataset-releases',
      'draft',
      'pending-planner-state',
      'pending-revisions',
      'plan-progress',
      'planner-preferences',
      'quarantine',
    ]);
    await expect(database.get('draft', 'active')).resolves.toEqual(profile());
    database.close();
  });
});
