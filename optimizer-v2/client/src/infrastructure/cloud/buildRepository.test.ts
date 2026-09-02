import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { InventoryState } from '../../domain/inventory/state';
import type { PortableBuildRecord } from '../../domain/build/portable';
import { createGuestBuildStore } from '../storage/guestBuildStore';
import { createInventoryStore } from '../storage/inventoryStore';
import { createDatasetReviewStore } from '../storage/datasetReviewStore';
import { createPendingRevisionQueue } from './pendingRevisionQueue';
import { createPendingPlannerStateQueue } from './pendingPlannerStateQueue';
import {
  createBuildRepository,
  createCloudBuildSelector,
  type CloudReducers,
} from './buildRepository';
import { progressFixture } from '../../test/progressFixtures';
import { fingerprintBuildInputs } from '../../domain/datasetImpact/fingerprint';
import type { ApplyDatasetUpdateRequest } from '../storage/guestBuildStore';

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
    datasetReviewStore: createDatasetReviewStore({ databaseName }),
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
    deletePlanProgress: vi.fn<CloudReducers['deletePlanProgress']>(
      async () => undefined,
    ),
    upsertPlanProgress: vi.fn(async () => undefined),
    upsertUserPreferences: vi.fn(async () => undefined),
    upsertUserInventory: vi.fn(async () => undefined),
    renameBuild: vi.fn(async () => undefined),
    setBuildArchived: vi.fn(async () => undefined),
    upsertDatasetReview: vi.fn(async () => undefined),
    deleteDatasetReview: vi.fn(async () => undefined),
    applyDatasetVersionUpdate: vi.fn(async () => undefined),
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
  const datasetReceipt = {
    schemaVersion: 1 as const,
    buildId: 'build-a',
    inputFingerprint: 'input-a',
    pinnedDatasetVersion: 'bootstrap-0',
    targetDatasetVersion: '2026.09.01.1',
    impactKeyFingerprint: 'impact-a',
    reportFingerprint: 'report-a',
    status: 'reviewed' as const,
    reviewedAt: '2026-09-01T12:00:00.000Z',
  };
  const applyRequest = (
    source: CharacterProfile,
    overrides: Partial<ApplyDatasetUpdateRequest> = {},
  ): ApplyDatasetUpdateRequest => ({
    profile: source,
    kind: 'build',
    active: false,
    expectedInputFingerprint: fingerprintBuildInputs(source),
    targetDatasetVersion: '2026.09.01.1',
    recoveryRevisionId: 'recovery-revision',
    updateRevisionId: 'dataset-update-revision',
    receipt: {
      ...datasetReceipt,
      buildId: source.id,
      inputFingerprint: fingerprintBuildInputs(source),
      pinnedDatasetVersion: source.datasetVersion,
      status: 'applied',
    },
    ...overrides,
  });
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

  it('saves a review locally before queueing a failed private cloud write', async () => {
    const storage = adapters('repository-dataset-review');
    const cloud = reducers();
    cloud.upsertDatasetReview.mockImplementationOnce(async () => {
      expect(await storage.datasetReviewStore.load('build-a')).toEqual(
        datasetReceipt,
      );
      throw new Error('offline');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      now: () => '2026-09-01T12:00:00.000Z',
    });

    await expect(repository.saveDatasetReview(datasetReceipt)).resolves.toBe(
      'cloud-pending',
    );
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      {
        kind: 'dataset-review',
        mutationId: 'dataset-review:build-a',
        attempts: 1,
      },
    ]);

    await repository.retryPendingPlannerState();
    expect(cloud.upsertDatasetReview).toHaveBeenLastCalledWith({
      buildId: 'build-a',
      receiptJson: JSON.stringify(datasetReceipt),
    });
    expect(await storage.pendingPlannerStateQueue.list(subject)).toEqual([]);
  });

  it('deletes a review locally before queueing a protected cloud delete', async () => {
    const storage = adapters('repository-dataset-review-delete');
    await storage.datasetReviewStore.save(datasetReceipt);
    const cloud = reducers();
    cloud.deleteDatasetReview.mockRejectedValueOnce(new Error('offline'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      now: () => '2026-09-01T12:01:00.000Z',
    });

    await expect(repository.deleteDatasetReview('build-a')).resolves.toBe(
      'cloud-pending',
    );
    await expect(storage.datasetReviewStore.load('build-a')).resolves.toBeNull();
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      {
        kind: 'dataset-review-delete',
        mutationId: 'dataset-review:build-a',
        attempts: 1,
      },
    ]);
  });

  it('queues a stable dataset-version apply and retains a stale-head conflict', async () => {
    const storage = adapters('repository-dataset-update');
    const cloud = reducers();
    cloud.applyDatasetVersionUpdate.mockRejectedValue(new Error('Build changed'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'revision-dataset-update',
      now: () => '2026-09-01T12:02:00.000Z',
    });

    await expect(repository.applyDatasetVersionUpdate({
      buildId: 'build-a',
      expectedHeadRevisionId: 'revision-1',
      targetDatasetVersion: '2026.09.01.1',
    })).resolves.toEqual({
      revisionId: 'revision-dataset-update',
      location: 'cloud-pending',
    });
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      {
        kind: 'dataset-version-update',
        mutationId: 'dataset-update:build-a',
        attempts: 1,
      },
    ]);

    await repository.retryPendingPlannerState();
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      { kind: 'dataset-version-update', attempts: 2 },
    ]);
  });

  it('applies a local dataset update through one atomic guest-store transaction', async () => {
    const storage = adapters('repository-local-dataset-apply');
    const source = profile();
    await storage.guestStore.saveBuild(source, { revisionId: 'revision-1' });
    await storage.guestStore.saveDraft(source);
    const repository = createBuildRepository({ ...storage });

    await expect(repository.applyDatasetUpdate(applyRequest(source, {
      active: true,
      expectedHeadRevisionId: 'revision-1',
    }), { source: 'local' })).resolves.toEqual({
      profile: { ...source, datasetVersion: '2026.09.01.1' },
      revisionId: 'dataset-update-revision',
      location: 'local',
    });
    expect((await storage.guestStore.listBuildHistory(source.id)).map(
      (revision) => revision.id,
    )).toEqual(['revision-1', 'dataset-update-revision']);
  });

  it('applies a cloud-only dataset update before writing its applied receipt', async () => {
    const storage = adapters('repository-cloud-dataset-apply');
    const source = profile();
    const order: string[] = [];
    const cloud = reducers();
    cloud.applyDatasetVersionUpdate.mockImplementation(async () => {
      order.push('dataset-update');
    });
    cloud.upsertDatasetReview.mockImplementation(async () => {
      order.push('dataset-review');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      getCloudSnapshot: () => ({
        builds: [{
          id: source.id,
          name: source.name!,
          headRevisionId: 'cloud-revision-1',
          kind: 'build',
        }],
        revisions: [{
          id: 'cloud-revision-1',
          buildId: source.id,
          schemaVersion: 2,
          level: source.level,
          maxFloor: source.maxFloor,
          weaponPath: source.weaponPath,
          goal: source.goal,
          weaponSkill: source.weaponSkill,
          ...source.stats,
          datasetVersion: source.datasetVersion,
          kind: 'build',
        }],
        equipment: [{
          revisionId: 'cloud-revision-1',
          slot: 'main-hand',
          itemId: 'iron-greatsword',
        }],
        ownedItems: [{
          revisionId: 'cloud-revision-1',
          itemId: 'iron-greatsword',
        }],
      }),
    });

    await expect(repository.applyDatasetUpdate(applyRequest(source, {
      expectedHeadRevisionId: 'cloud-revision-1',
    }), { source: 'cloud' })).resolves.toEqual({
      profile: { ...source, datasetVersion: '2026.09.01.1' },
      revisionId: 'dataset-update-revision',
      location: 'cloud',
    });

    expect(order).toEqual(['dataset-update', 'dataset-review']);
    expect(cloud.applyDatasetVersionUpdate).toHaveBeenCalledWith({
      buildId: source.id,
      expectedHeadRevisionId: 'cloud-revision-1',
      revisionId: 'dataset-update-revision',
      targetDatasetVersion: '2026.09.01.1',
    });
    await expect(storage.datasetReviewStore.load(source.id)).resolves.toEqual(
      applyRequest(source).receipt,
    );
  });

  it('does not write an applied receipt when the cloud revision is pending', async () => {
    const storage = adapters('repository-cloud-dataset-pending');
    const source = profile();
    const cloud = reducers();
    cloud.applyDatasetVersionUpdate.mockRejectedValueOnce(new Error('offline'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'cloud-recovery-revision',
    });

    await expect(repository.applyDatasetUpdate(applyRequest(source), {
      source: 'cloud',
    })).resolves.toMatchObject({ location: 'cloud-pending' });

    expect(cloud.saveBuildRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionId: 'cloud-recovery-revision',
        profile: expect.objectContaining({ datasetVersion: 'bootstrap-0' }),
      }),
    );
    expect(cloud.upsertDatasetReview).not.toHaveBeenCalled();
    await expect(storage.datasetReviewStore.load(source.id)).resolves.toBeNull();
  });

  it('establishes distinct local and cloud recovery heads before a first cloud update', async () => {
    const storage = adapters('repository-cloud-dataset-recovery');
    const source = profile();
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      randomUUID: () => 'cloud-recovery-revision',
    });

    await expect(repository.applyDatasetUpdate(applyRequest(source), {
      source: 'cloud',
    })).resolves.toMatchObject({
      location: 'cloud',
      profile: { datasetVersion: '2026.09.01.1' },
    });

    expect(cloud.saveBuildRevision).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: 'cloud-recovery-revision' }),
    );
    expect(cloud.applyDatasetVersionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHeadRevisionId: 'cloud-recovery-revision',
        revisionId: 'dataset-update-revision',
      }),
    );
    expect((await storage.guestStore.listBuildHistory(source.id)).map(
      (revision) => revision.id,
    )).toEqual(['recovery-revision', 'dataset-update-revision']);
  });

  it('updates both sides of a mirrored preset while preserving its kind', async () => {
    const storage = adapters('repository-mirrored-dataset-apply');
    const source = profile();
    await storage.guestStore.saveBuild(source, {
      kind: 'personal-preset',
      revisionId: 'local-revision-1',
    });
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      getCloudSnapshot: () => ({
        builds: [{
          id: source.id,
          name: source.name!,
          headRevisionId: 'cloud-revision-1',
          kind: 'personal-preset',
        }],
        revisions: [{
          id: 'cloud-revision-1',
          buildId: source.id,
          schemaVersion: 2,
          level: source.level,
          maxFloor: source.maxFloor,
          weaponPath: source.weaponPath,
          goal: source.goal,
          weaponSkill: source.weaponSkill,
          ...source.stats,
          datasetVersion: source.datasetVersion,
          kind: 'personal-preset',
        }],
        equipment: [{
          revisionId: 'cloud-revision-1',
          slot: 'main-hand',
          itemId: 'iron-greatsword',
        }],
        ownedItems: [{
          revisionId: 'cloud-revision-1',
          itemId: 'iron-greatsword',
        }],
      }),
    });

    await expect(repository.applyDatasetUpdate(applyRequest(source, {
      kind: 'personal-preset',
      expectedHeadRevisionId: 'local-revision-1',
    }), { source: 'local+cloud' })).resolves.toMatchObject({
      location: 'cloud',
      profile: { datasetVersion: '2026.09.01.1' },
    });

    expect(cloud.applyDatasetVersionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHeadRevisionId: 'cloud-revision-1',
        revisionId: 'dataset-update-revision',
      }),
    );
    expect((await storage.guestStore.listBuilds())[0]).toMatchObject({
      ok: true,
      value: {
        kind: 'personal-preset',
        headRevisionId: 'dataset-update-revision',
        profile: { datasetVersion: '2026.09.01.1' },
      },
    });
  });

  it('rejects a cloud head edited after preview before any dataset write', async () => {
    const storage = adapters('repository-cloud-dataset-stale');
    const source = profile();
    const cloud = reducers();
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      getCloudSnapshot: () => ({
        builds: [{
          id: source.id,
          name: source.name!,
          headRevisionId: 'cloud-revision-2',
          kind: 'build',
        }],
        revisions: [{
          id: 'cloud-revision-2',
          buildId: source.id,
          schemaVersion: 2,
          level: source.level + 1,
          maxFloor: source.maxFloor,
          weaponPath: source.weaponPath,
          goal: source.goal,
          weaponSkill: source.weaponSkill,
          str: source.stats.str + 3,
          def: source.stats.def,
          agi: source.stats.agi,
          vit: source.stats.vit,
          luk: source.stats.luk,
          datasetVersion: source.datasetVersion,
          kind: 'build',
        }],
        equipment: [{
          revisionId: 'cloud-revision-2',
          slot: 'main-hand',
          itemId: 'iron-greatsword',
        }],
        ownedItems: [{
          revisionId: 'cloud-revision-2',
          itemId: 'iron-greatsword',
        }],
      }),
    });

    await expect(repository.applyDatasetUpdate(applyRequest(source, {
      expectedHeadRevisionId: 'cloud-revision-1',
    }), { source: 'cloud' })).rejects.toThrow(/Build changed/);

    expect(cloud.applyDatasetVersionUpdate).not.toHaveBeenCalled();
    expect(cloud.upsertDatasetReview).not.toHaveBeenCalled();
  });

  it('replays dataset updates before review receipts regardless of enqueue time', async () => {
    const storage = adapters('repository-dataset-replay-order');
    await storage.pendingQueue.enqueue({
      subject,
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile(),
      enqueuedAt: '2026-09-01T11:59:00.000Z',
      attempts: 0,
    });
    await storage.pendingPlannerStateQueue.enqueue({
      kind: 'dataset-review',
      subject,
      mutationId: 'dataset-review:build-a',
      receipt: datasetReceipt,
      enqueuedAt: '2026-09-01T12:00:00.000Z',
      attempts: 0,
    });
    await storage.pendingPlannerStateQueue.enqueue({
      kind: 'dataset-version-update',
      subject,
      mutationId: 'dataset-update:build-a',
      buildId: 'build-a',
      expectedHeadRevisionId: 'revision-1',
      revisionId: 'revision-dataset-update',
      targetDatasetVersion: '2026.09.01.1',
      enqueuedAt: '2026-09-01T12:01:00.000Z',
      attempts: 0,
    });
    const order: string[] = [];
    const cloud = reducers();
    cloud.saveBuildRevision.mockImplementation(async () => {
      order.push('build-revision');
    });
    cloud.applyDatasetVersionUpdate.mockImplementation(async () => {
      order.push('dataset-update');
    });
    cloud.upsertDatasetReview.mockImplementation(async () => {
      order.push('dataset-review');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
    });

    await repository.retryAllPending();

    expect(order).toEqual([
      'build-revision',
      'dataset-update',
      'dataset-review',
    ]);
  });

  it('does not apply a dataset update while an earlier build revision is still failing', async () => {
    const storage = adapters('repository-dataset-replay-blocked');
    await storage.pendingQueue.enqueue({
      subject,
      revisionId: 'revision-1',
      buildId: 'build-a',
      profile: profile(),
      enqueuedAt: '2026-09-01T11:59:00.000Z',
      attempts: 0,
    });
    await storage.pendingPlannerStateQueue.enqueue({
      kind: 'dataset-version-update',
      subject,
      mutationId: 'dataset-update:build-a',
      buildId: 'build-a',
      expectedHeadRevisionId: 'revision-1',
      revisionId: 'revision-dataset-update',
      targetDatasetVersion: '2026.09.01.1',
      enqueuedAt: '2026-09-01T12:00:00.000Z',
      attempts: 0,
    });
    const cloud = reducers(async () => {
      throw new Error('offline');
    });
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
    });

    await repository.retryAllPending();

    expect(cloud.applyDatasetVersionUpdate).not.toHaveBeenCalled();
    expect(await storage.pendingQueue.list(subject)).toMatchObject([
      { revisionId: 'revision-1', attempts: 1 },
    ]);
    expect(await storage.pendingPlannerStateQueue.list(subject)).toMatchObject([
      { kind: 'dataset-version-update', attempts: 0 },
    ]);
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

  it('deletes progress locally and queues a protected cloud reset for retry', async () => {
    const storage = adapters('repository-progress-reset');
    const cloud = reducers();
    cloud.deletePlanProgress.mockRejectedValueOnce(new Error('offline'));
    const repository = createBuildRepository({
      ...storage,
      reducers: cloud,
      accountSubject: subject,
      now: () => '2026-09-01T10:00:00.000Z',
    });
    await storage.guestStore.savePlanProgress(
      progressFixture('build-a', ['level-21']),
    );

    await expect(repository.resetPlanProgress('build-a')).resolves.toBe(
      'cloud-pending',
    );
    await expect(storage.guestStore.loadPlanProgress('build-a')).resolves.toBeNull();
    await expect(storage.pendingPlannerStateQueue.list(subject)).resolves.toMatchObject([
      {
        kind: 'progress-reset',
        mutationId: 'progress:build-a',
        buildId: 'build-a',
        attempts: 1,
      },
    ]);

    await repository.retryPendingPlannerState();
    expect(cloud.deletePlanProgress).toHaveBeenLastCalledWith({ buildId: 'build-a' });
    await expect(storage.pendingPlannerStateQueue.list(subject)).resolves.toEqual([]);
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
