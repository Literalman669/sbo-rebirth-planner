import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../storage/guestBuildStore';
import { createPendingRevisionQueue } from './pendingRevisionQueue';
import {
  createBuildRepository,
  createCloudBuildSelector,
  type CloudReducers,
} from './buildRepository';

function profile(id = 'build-a'): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: `Build ${id}`,
    level: 20,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    weaponSkill: 18,
    stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
    equipped: { 'main-hand': 'iron-greatsword' },
    ownedItemIds: ['iron-greatsword'],
    datasetVersion: 'bootstrap-0',
  };
}

function adapters(label: string) {
  const databaseName = `${label}-${crypto.randomUUID()}`;
  return {
    guestStore: createGuestBuildStore({ databaseName }),
    pendingQueue: createPendingRevisionQueue({ databaseName }),
  };
}

function reducers(
  implementation: CloudReducers['saveBuildRevision'] = async () => undefined,
) {
  return {
    saveBuildRevision: vi.fn(implementation),
    completeGuestImport: vi.fn<CloudReducers['completeGuestImport']>(
      async () => undefined,
    ),
    restoreBuildRevision: vi.fn<CloudReducers['restoreBuildRevision']>(
      async () => undefined,
    ),
    deleteBuild: vi.fn<CloudReducers['deleteBuild']>(async () => undefined),
  };
}

describe('BuildRepository', () => {
  const subject = 'account-a';
  it('keeps a guest save local', async () => {
    const storage = adapters('repository-guest');
    const repository = createBuildRepository({
      ...storage,
      randomUUID: () => 'unused-revision',
    });

    await expect(repository.save(profile())).resolves.toEqual({
      location: 'local',
    });
    expect(
      (await storage.guestStore.listBuilds()).find((result) => result.ok)
        ?.value.profile.id,
    ).toBe('build-a');
    expect(await storage.pendingQueue.list(subject)).toHaveLength(0);
  });

  it('stores failed revisions only in the authenticated account queue', async () => {
    const storage = adapters('repository-account-scope');
    const repository = createBuildRepository({
      ...storage,
      reducers: reducers(vi.fn(async () => Promise.reject(new Error('offline')))),
      accountSubject: subject,
      randomUUID: () => 'revision-1',
      now: () => '2026-08-29T10:00:00.000Z',
    });

    await repository.save(profile());

    expect(await storage.pendingQueue.list(subject)).toMatchObject([
      { revisionId: 'revision-1', subject },
    ]);
    expect(await storage.pendingQueue.list('account-b')).toHaveLength(0);
  });

  it('writes locally, enqueues, calls the reducer, then acknowledges', async () => {
    const storage = adapters('repository-cloud');
    const saveBuildRevision = vi.fn(async () => {
      expect(await storage.guestStore.listBuilds()).toHaveLength(1);
      expect(await storage.pendingQueue.list(subject)).toMatchObject([
        { revisionId: 'revision-1', attempts: 0 },
      ]);
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: reducers(saveBuildRevision),
      accountSubject: subject,
      randomUUID: () => 'revision-1',
      now: () => '2026-08-29T10:00:00.000Z',
    });

    await expect(repository.save(profile())).resolves.toEqual({
      revisionId: 'revision-1',
      location: 'cloud',
    });
    expect(await storage.pendingQueue.list(subject)).toHaveLength(0);
  });

  it('leaves a failed reducer call pending and increments attempts', async () => {
    const storage = adapters('repository-failure');
    const repository = createBuildRepository({
      ...storage,
      reducers: reducers(vi.fn(async () => Promise.reject(new Error('offline')))),
      accountSubject: subject,
      randomUUID: () => 'revision-1',
      now: () => '2026-08-29T10:00:00.000Z',
    });

    await expect(repository.save(profile())).resolves.toEqual({
      revisionId: 'revision-1',
      location: 'cloud-pending',
    });
    expect(await storage.pendingQueue.list(subject)).toMatchObject([
      { revisionId: 'revision-1', attempts: 1 },
    ]);
  });

  it('imports only selected guest IDs and leaves every guest build intact', async () => {
    const storage = adapters('repository-import');
    await storage.guestStore.saveBuild(profile('selected'));
    await storage.guestStore.saveBuild(profile('local-only'));
    const cloud = reducers();
    let revision = 0;
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => `revision-${++revision}`,
      now: () => '2026-08-29T10:00:00.000Z',
    });

    await repository.importGuestBuilds(['selected']);

    expect(cloud.saveBuildRevision).toHaveBeenCalledOnce();
    const [payload] = cloud.saveBuildRevision.mock.calls[0]!;
    expect(payload.buildId).toBe('selected');
    expect(cloud.completeGuestImport).toHaveBeenCalledOnce();
    expect(
      (await storage.guestStore.listBuilds())
        .filter((result) => result.ok)
        .map((result) => result.value.profile.id),
    ).toEqual(expect.arrayContaining(['selected', 'local-only']));
  });

  it('restores by creating a new revision ID', async () => {
    const storage = adapters('repository-restore');
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'restored-revision',
    });

    await expect(repository.restore('build-a', 'revision-1')).resolves.toBe(
      'restored-revision',
    );
    expect(cloud.restoreBuildRevision).toHaveBeenCalledWith({
      buildId: 'build-a',
      sourceRevisionId: 'revision-1',
      newRevisionId: 'restored-revision',
    });
  });
});

describe('CloudBuildSelector', () => {
  const baseBuild = {
    id: 'build-a',
    name: 'Build A',
    headRevisionId: 'revision-1',
  };
  const baseRevision = {
    id: 'revision-1',
    buildId: 'build-a',
    schemaVersion: 2,
    level: 20,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    weaponSkill: 18,
    str: 20,
    def: 10,
    agi: 12,
    vit: 8,
    luk: 5,
    datasetVersion: 'bootstrap-0',
  };

  it('retains the last validated head when a subscribed replacement is invalid', () => {
    const selector = createCloudBuildSelector();
    expect(
      selector.select({
        builds: [baseBuild],
        revisions: [baseRevision],
        equipment: [],
        ownedItems: [],
      })[0]?.profile.level,
    ).toBe(20);

    expect(
      selector.select({
        builds: [{ ...baseBuild, headRevisionId: 'revision-2' }],
        revisions: [
          baseRevision,
          { ...baseRevision, id: 'revision-2', schemaVersion: 99, level: 99 },
        ],
        equipment: [],
        ownedItems: [],
      })[0]?.profile.level,
    ).toBe(20);
  });

  it('keeps both validated revisions in recoverable history', () => {
    const selector = createCloudBuildSelector();
    const result = selector.select({
      builds: [{ ...baseBuild, headRevisionId: 'revision-2' }],
      revisions: [
        baseRevision,
        { ...baseRevision, id: 'revision-2', level: 21, str: 23 },
      ],
      equipment: [],
      ownedItems: [],
    });

    expect(result[0]?.profile.level).toBe(21);
    expect(result[0]?.history.map((item) => item.revisionId)).toEqual([
      'revision-1',
      'revision-2',
    ]);
  });
});
