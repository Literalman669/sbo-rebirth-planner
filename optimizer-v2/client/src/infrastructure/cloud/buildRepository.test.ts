import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { InventoryState } from '../../domain/inventory/state';
import type { PortableBuildRecord } from '../../domain/build/portable';
import { createGuestBuildStore } from '../storage/guestBuildStore';
import { createInventoryStore } from '../storage/inventoryStore';
import { createPendingRevisionQueue } from './pendingRevisionQueue';
import { createPendingPlannerStateQueue } from './pendingPlannerStateQueue';
import {
  createBuildRepository,
  createCloudBuildSelector,
  type CloudReducers,
} from './buildRepository';
import { progressFixture } from '../../test/progressFixtures';

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
    pendingPlannerStateQueue: createPendingPlannerStateQueue({ databaseName }),
    inventoryStore: createInventoryStore({ databaseName }),
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
    upsertPlanProgress: vi.fn(async () => undefined),
    upsertUserPreferences: vi.fn(async () => undefined),
    upsertUserInventory: vi.fn(async () => undefined),
    renameBuild: vi.fn(async () => undefined),
    setBuildArchived: vi.fn(async () => undefined),
  };
}

describe('BuildRepository', () => {
  const subject = 'account-a';
  const inventory: InventoryState = {
    schemaVersion: 1,
    ownedItemIds: ['iron-greatsword'],
    favoriteItemIds: ['beginner-armor'],
    comparisonItemIds: [],
    notes: {},
  };
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

  it('persists a guest personal preset locally with its record kind', async () => {
    const storage = adapters('repository-guest-preset');
    const repository = createBuildRepository({ ...storage });

    await expect(
      repository.save(profile('preset-a'), { kind: 'personal-preset' }),
    ).resolves.toEqual({ location: 'local' });
    expect(
      (await storage.guestStore.listBuilds()).find((result) => result.ok),
    ).toMatchObject({
      ok: true,
      value: { kind: 'personal-preset' },
    });
  });

  it('queues failed inventory after local save and acknowledges it on retry', async () => {
    const storage = adapters('repository-inventory');
    let offline = true;
    const cloud = reducers();
    cloud.upsertUserInventory = vi.fn(async () => {
      if (offline) throw new Error('offline');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      now: () => '2026-08-31T10:00:00.000Z',
    });

    await expect(repository.saveInventory(inventory)).resolves.toBe(
      'cloud-pending',
    );
    await expect(storage.inventoryStore.load()).resolves.toEqual(inventory);
    await expect(storage.pendingPlannerStateQueue.list(subject)).resolves.toMatchObject([
      { kind: 'inventory', mutationId: 'inventory:primary', attempts: 1 },
    ]);

    offline = false;
    await repository.retryPendingPlannerState();

    expect(cloud.upsertUserInventory).toHaveBeenCalledTimes(2);
    await expect(storage.pendingPlannerStateQueue.list(subject)).resolves.toEqual([]);
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
      { revisionId: 'revision-1', kind: 'build', subject },
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
    expect(saveBuildRevision).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'build' }),
    );
  });

  it('does not create another revision for identical cloud profile content', async () => {
    const storage = adapters('repository-deduplicate-cloud');
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'duplicate-revision',
      getCloudSnapshot: () => ({
        builds: [
          {
            id: 'build-a',
            name: 'Build build-a',
            headRevisionId: 'revision-1',
          },
        ],
        revisions: [
          {
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
          },
        ],
        equipment: [
          {
            revisionId: 'revision-1',
            slot: 'main-hand',
            itemId: 'iron-greatsword',
          },
        ],
        ownedItems: [
          { revisionId: 'revision-1', itemId: 'iron-greatsword' },
        ],
      }),
    });

    await expect(repository.save(profile())).resolves.toEqual({
      revisionId: 'revision-1',
      location: 'cloud',
    });
    expect(cloud.saveBuildRevision).not.toHaveBeenCalled();
    expect(await storage.pendingQueue.list(subject)).toEqual([]);
  });

  it('does not deduplicate a personal preset against identical normal-build content', async () => {
    const storage = adapters('repository-kind-deduplicate');
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'preset-revision',
      getCloudSnapshot: () => ({
        builds: [{
          id: 'build-a',
          name: 'Build build-a',
          headRevisionId: 'revision-1',
          kind: 'build',
        }],
        revisions: [{
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
          kind: 'build',
        }],
        equipment: [{
          revisionId: 'revision-1',
          slot: 'main-hand',
          itemId: 'iron-greatsword',
        }],
        ownedItems: [{ revisionId: 'revision-1', itemId: 'iron-greatsword' }],
      }),
    });

    await expect(
      repository.save(profile(), { kind: 'personal-preset' }),
    ).resolves.toMatchObject({ revisionId: 'preset-revision' });
    expect(cloud.saveBuildRevision).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'personal-preset' }),
    );
  });

  it('does not create another revision while identical content is already pending', async () => {
    const storage = adapters('repository-deduplicate-pending');
    await storage.pendingQueue.enqueue({
      subject,
      revisionId: 'pending-revision',
      buildId: 'build-a',
      profile: profile(),
      enqueuedAt: '2026-08-30T10:00:00.000Z',
      attempts: 1,
    });
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'duplicate-revision',
    });

    await expect(repository.save(profile())).resolves.toEqual({
      revisionId: 'pending-revision',
      location: 'cloud-pending',
    });
    expect(cloud.saveBuildRevision).not.toHaveBeenCalled();
    expect(await storage.pendingQueue.list(subject)).toHaveLength(1);
  });

  it('queues failed progress and preferences with stable IDs, then replays in order', async () => {
    const storage = adapters('repository-planner-state');
    const cloud = reducers();
    cloud.upsertPlanProgress.mockRejectedValueOnce(new Error('offline'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      now: () => '2026-08-30T10:00:00.000Z',
    });
    const planProgress = progressFixture('build-a', ['level-21']);
    const plannerPreferences = {
      schemaVersion: 1 as const,
      mode: 'beginner' as const,
      density: 'comfortable' as const,
      showAllLevels: false,
      compactWeaponPathsAfterFirstUse: false,
    };

    await expect(repository.savePlanProgress(planProgress)).resolves.toBe(
      'cloud-pending',
    );
    await expect(repository.savePreferences(plannerPreferences)).resolves.toBe(
      'cloud',
    );
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      {
        mutationId: 'progress:build-a',
        kind: 'progress',
        attempts: 1,
      },
    ]);

    await repository.retryPendingPlannerState();
    expect(await storage.pendingPlannerStateQueue.list(subject)).toEqual([]);
    expect(cloud.upsertPlanProgress).toHaveBeenLastCalledWith({
      buildId: 'build-a',
      progressJson: JSON.stringify(planProgress),
    });
  });

  it('renames and archives through protected reducers', async () => {
    const storage = adapters('repository-build-metadata');
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
    });

    await repository.rename('build-a', 'Renamed build');
    await repository.archive('build-a', true);

    expect(cloud.renameBuild).toHaveBeenCalledWith({
      buildId: 'build-a',
      name: 'Renamed build',
    });
    expect(cloud.setBuildArchived).toHaveBeenCalledWith({
      buildId: 'build-a',
      archived: true,
    });
  });

  it('stops planner-state replay after the first failed mutation', async () => {
    const storage = adapters('repository-planner-replay-stop');
    await storage.pendingPlannerStateQueue.enqueue({
      kind: 'progress',
      subject,
      mutationId: 'progress:build-a',
      progress: progressFixture('build-a', ['level-21']),
      enqueuedAt: '2026-08-30T10:00:00.000Z',
      attempts: 0,
    });
    await storage.pendingPlannerStateQueue.enqueue({
      kind: 'preferences',
      subject,
      mutationId: 'preferences:primary',
      preferences: {
        schemaVersion: 1,
        mode: 'beginner',
        density: 'comfortable',
        showAllLevels: false,
        compactWeaponPathsAfterFirstUse: false,
      },
      enqueuedAt: '2026-08-30T10:00:01.000Z',
      attempts: 0,
    });
    const cloud = reducers();
    cloud.upsertPlanProgress.mockRejectedValue(new Error('still offline'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
    });

    await repository.retryPendingPlannerState();

    expect(cloud.upsertUserPreferences).not.toHaveBeenCalled();
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      { mutationId: 'progress:build-a', attempts: 1 },
      { mutationId: 'preferences:primary', attempts: 0 },
    ]);
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

  it('replays one account\'s offline revisions in order without touching another account queue', async () => {
    const storage = adapters('repository-offline-replay');
    const queuedRevisionIds = [
      'offline-revision-1',
      'offline-revision-2',
      'offline-revision-3',
    ];
    let nextRevision = 0;
    const offlineRepository = createBuildRepository({
      ...storage,
      reducers: reducers(async () => {
        throw new Error('offline');
      }),
      accountSubject: subject,
      randomUUID: () => queuedRevisionIds[nextRevision++]!,
      now: () =>
        `2026-08-29T10:00:0${nextRevision}.000Z`,
    });

    for (let level = 21; level <= 23; level += 1) {
      await expect(
        offlineRepository.save({ ...profile(), level }),
      ).resolves.toMatchObject({ location: 'cloud-pending' });
    }
    await storage.pendingQueue.enqueue({
      subject: 'account-b',
      revisionId: 'account-b-pending',
      buildId: 'build-b',
      profile: profile('build-b'),
      enqueuedAt: '2026-08-29T10:00:04.000Z',
      attempts: 0,
    });

    const replayed: Parameters<CloudReducers['saveBuildRevision']>[0][] = [];
    const reconnectedRepository = createBuildRepository({
      ...storage,
      reducers: reducers(async (args) => {
        replayed.push(args);
      }),
      accountSubject: subject,
    });

    await reconnectedRepository.retryPending();

    expect(replayed.map((args) => args.revisionId)).toEqual(queuedRevisionIds);
    expect(replayed.map((args) => args.parentRevisionId)).toEqual([
      undefined,
      'offline-revision-1',
      'offline-revision-2',
    ]);
    expect(await storage.pendingQueue.list(subject)).toHaveLength(0);
    expect(await storage.pendingQueue.list('account-b')).toMatchObject([
      {
        subject: 'account-b',
        revisionId: 'account-b-pending',
        buildId: 'build-b',
        attempts: 0,
      },
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

  it('queues an imported revision chain in parent order and resumes after failure', async () => {
    const storage = adapters('repository-portable-import');
    const importedProfile = profile('imported-build');
    const record: PortableBuildRecord = {
      profile: { ...importedProfile, level: 22 },
      kind: 'personal-preset',
      headRevisionId: 'import-revision-3',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      revisions: [20, 21, 22].map((level, index) => ({
        id: `import-revision-${index + 1}`,
        buildId: 'imported-build',
        ...(index > 0
          ? { parentRevisionId: `import-revision-${index}` }
          : {}),
        kind: 'personal-preset' as const,
        profile: { ...importedProfile, level },
        createdAt: `2026-09-01T1${index}:00:00.000Z`,
      })),
    };
    let offline = true;
    const replayed: string[] = [];
    const cloud = reducers(async (args) => {
      replayed.push(args.revisionId);
      if (offline) throw new Error('offline');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
    });

    await expect(repository.importBuildRecords([record])).resolves.toBe(
      'cloud-pending',
    );
    const pending = await storage.pendingQueue.list(subject);
    expect(pending).toMatchObject([
      { revisionId: 'import-revision-1', attempts: 1, kind: 'personal-preset' },
      { revisionId: 'import-revision-2', parentRevisionId: 'import-revision-1', attempts: 0, kind: 'personal-preset' },
      { revisionId: 'import-revision-3', parentRevisionId: 'import-revision-2', attempts: 0, kind: 'personal-preset' },
    ]);
    expect(pending[0]).not.toHaveProperty('parentRevisionId');

    offline = false;
    await repository.retryPending();

    expect(replayed).toEqual([
      'import-revision-1',
      'import-revision-1',
      'import-revision-2',
      'import-revision-3',
    ]);
    await expect(storage.pendingQueue.list(subject)).resolves.toEqual([]);
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

  it('preserves personal-preset kind on the current record and every history row', () => {
    const selector = createCloudBuildSelector();
    const result = selector.select({
      builds: [{ ...baseBuild, kind: 'personal-preset' }],
      revisions: [{ ...baseRevision, kind: 'personal-preset' }],
      equipment: [],
      ownedItems: [],
    });

    expect(result[0]).toMatchObject({
      kind: 'personal-preset',
      history: [{ kind: 'personal-preset' }],
    });
  });

  it('retains the prior validated record when current and head kinds disagree', () => {
    const selector = createCloudBuildSelector();
    expect(selector.select({
      builds: [{ ...baseBuild, kind: 'build' }],
      revisions: [{ ...baseRevision, kind: 'build' }],
      equipment: [],
      ownedItems: [],
    })[0]?.kind).toBe('build');

    expect(selector.select({
      builds: [{ ...baseBuild, kind: 'personal-preset' }],
      revisions: [{ ...baseRevision, kind: 'build' }],
      equipment: [],
      ownedItems: [],
    })[0]?.kind).toBe('build');
  });

  it('keeps archived rows out of the active list and available to the archived filter', () => {
    const selector = createCloudBuildSelector();
    const snapshot = {
      builds: [
        {
          ...baseBuild,
          archivedAt: '2026-08-30T10:00:00.000Z',
        },
      ],
      revisions: [baseRevision],
      equipment: [],
      ownedItems: [],
    };

    expect(selector.select(snapshot)).toEqual([]);
    expect(selector.select(snapshot, { archived: true })).toMatchObject([
      { archivedAt: '2026-08-30T10:00:00.000Z' },
    ]);
  });
});
