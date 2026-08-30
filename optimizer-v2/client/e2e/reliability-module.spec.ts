import { expect, test, type TestInfo } from '@playwright/test';
import 'fake-indexeddb/auto';
import { writeFile } from 'node:fs/promises';
import type { CharacterProfile } from '../src/domain/build/model';
import {
  createBuildRepository,
  type CloudReducers,
} from '../src/infrastructure/cloud/buildRepository';
import { createPendingRevisionQueue } from '../src/infrastructure/cloud/pendingRevisionQueue';
import { createGuestBuildStore } from '../src/infrastructure/storage/guestBuildStore';
import {
  DbConnection,
  tables,
  type SubscriptionHandle,
} from '../src/module_bindings';

const uri = 'http://127.0.0.1:3000';
const databaseName = 'sbo-rebirth-optimizer-v2-test';
const buildId = 'cloud-revision-stress-build';
const offlineBuildId = 'cloud-offline-replay-build';
const offlineSubject = 'cloud-offline-owner';

type TestConnection = {
  connection: DbConnection;
  token: string;
  subscription?: SubscriptionHandle;
};

type RevisionInput = {
  buildId: string;
  revisionId: string;
  parentRevisionId?: string;
  name: string;
  profile: {
    schemaVersion: number;
    level: number;
    maxFloor: number;
    weaponPath: string;
    goal: string;
    weaponSkill: number;
    str: number;
    def: number;
    agi: number;
    vit: number;
    luk: number;
    datasetVersion: string;
  };
  equipment: Array<{ slot: string; itemId: string }>;
  ownedItemIds: string[];
};

function revision(index: number, parentRevisionId?: string): RevisionInput {
  return {
    buildId,
    revisionId: `stress-revision-${index}`,
    ...(parentRevisionId ? { parentRevisionId } : {}),
    name: 'Cloud Revision Stress',
    profile: {
      schemaVersion: 2,
      level: index,
      maxFloor: 3,
      weaponPath: 'two-handed',
      goal: 'balanced',
      weaponSkill: 18,
      str: index,
      def: 10,
      agi: 12,
      vit: 8,
      luk: 5,
      datasetVersion: 'bootstrap-0',
    },
    equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
    ownedItemIds: ['iron-greatsword'],
  };
}

function offlineProfile(level: number): CharacterProfile {
  return {
    schemaVersion: 2,
    id: offlineBuildId,
    name: 'Cloud Offline Replay',
    level,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    weaponSkill: 18,
    stats: { str: level, def: 10, agi: 12, vit: 8, luk: 5 },
    equipped: { 'main-hand': 'iron-greatsword' },
    ownedItemIds: ['iron-greatsword'],
    datasetVersion: 'bootstrap-0',
  };
}

async function connect(token?: string): Promise<TestConnection> {
  return new Promise((resolve, reject) => {
    let builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(databaseName)
      .onConnect((connection, _identity, issuedToken) =>
        resolve({ connection, token: issuedToken }),
      )
      .onConnectError((_context, error) => reject(error));

    if (token) builder = builder.withToken(token);
    builder.build();
  });
}

async function subscribeToPrivateViews(testConnection: TestConnection) {
  const subscription = await new Promise<SubscriptionHandle>((resolve, reject) => {
    const handle = testConnection.connection
      .subscriptionBuilder()
      .onApplied(() => resolve(handle))
      .onError(() => reject(new Error('Private view subscription failed')))
      .subscribe([
        tables.myBuilds,
        tables.myBuildRevisions,
        tables.myRevisionEquipment,
        tables.myRevisionOwnedItems,
      ]);
  });
  testConnection.subscription = subscription;
}

function disconnect(testConnection: TestConnection | undefined) {
  testConnection?.subscription?.unsubscribe();
  testConnection?.connection.disconnect();
}

function viewSummary(testConnection: TestConnection) {
  const builds = [...testConnection.connection.db.myBuilds.iter()];
  const revisions = [...testConnection.connection.db.myBuildRevisions.iter()];
  return {
    builds,
    revisions,
    revisionEquipment: [
      ...testConnection.connection.db.myRevisionEquipment.iter(),
    ],
    revisionOwnedItems: [
      ...testConnection.connection.db.myRevisionOwnedItems.iter(),
    ],
    headRevisionId: builds.find((build) => build.id === buildId)?.headRevisionId,
  };
}

function buildSummary(testConnection: TestConnection, targetBuildId: string) {
  const build = [...testConnection.connection.db.myBuilds.iter()].find(
    (candidate) => candidate.id === targetBuildId,
  );
  const revisions = [
    ...testConnection.connection.db.myBuildRevisions.iter(),
  ].filter((candidate) => candidate.buildId === targetBuildId);
  const revisionIds = new Set(revisions.map((candidate) => candidate.id));
  return {
    build,
    revisions,
    revisionEquipment: [
      ...testConnection.connection.db.myRevisionEquipment.iter(),
    ].filter((candidate) => revisionIds.has(candidate.revisionId)),
    revisionOwnedItems: [
      ...testConnection.connection.db.myRevisionOwnedItems.iter(),
    ].filter((candidate) => revisionIds.has(candidate.revisionId)),
  };
}

function liveReducers(testConnection: TestConnection): CloudReducers {
  return {
    saveBuildRevision: (args) =>
      testConnection.connection.reducers.saveBuildRevision(args),
    completeGuestImport: () =>
      testConnection.connection.reducers.completeGuestImport({}),
    restoreBuildRevision: (args) =>
      testConnection.connection.reducers.restoreBuildRevision(args),
    deleteBuild: (args) => testConnection.connection.reducers.deleteBuild(args),
  };
}

async function attachFailureEvidence(
  testInfo: TestInfo,
  reducerInputs: readonly RevisionInput[],
  primary: TestConnection | undefined,
  secondary: TestConnection | undefined,
  foreign: TestConnection | undefined,
  clientQueueState: unknown,
) {
  const evidencePath = testInfo.outputPath('cloud-revision-stress-evidence.json');
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        reducerInputs,
        primarySubscription: primary ? viewSummary(primary) : undefined,
        secondarySubscription: secondary ? viewSummary(secondary) : undefined,
        foreignSubscription: foreign ? viewSummary(foreign) : undefined,
        clientQueueState,
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );
  await testInfo.attach('cloud-revision-stress-evidence', {
    path: evidencePath,
    contentType: 'application/json',
  });
}

test('keeps 100 immutable revisions converged across same-account subscriptions', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');

  const reducerInputs: RevisionInput[] = [];
  let primary: TestConnection | undefined;
  let secondary: TestConnection | undefined;
  let foreign: TestConnection | undefined;
  let reconnected: TestConnection | undefined;
  let clientQueueState: unknown;

  try {
    primary = await connect();
    secondary = await connect(primary.token);
    foreign = await connect();
    await Promise.all([
      subscribeToPrivateViews(primary),
      subscribeToPrivateViews(secondary),
      subscribeToPrivateViews(foreign),
    ]);

    let parentRevisionId: string | undefined;
    for (let index = 1; index <= 100; index += 1) {
      const input = revision(index, parentRevisionId);
      reducerInputs.push(input);
      await primary.connection.reducers.saveBuildRevision(input);
      parentRevisionId = input.revisionId;
    }

    await expect.poll(() => {
      const summary = viewSummary(primary!);
      return {
        builds: summary.builds.length,
        revisions: summary.revisions.length,
        revisionEquipment: summary.revisionEquipment.length,
        revisionOwnedItems: summary.revisionOwnedItems.length,
        headRevisionId: summary.headRevisionId,
      };
    }).toEqual({
      builds: 1,
      revisions: 100,
      revisionEquipment: 100,
      revisionOwnedItems: 100,
      headRevisionId: 'stress-revision-100',
    });

    const identicalRevisionFifty = revision(50, 'stress-revision-49');
    reducerInputs.push(identicalRevisionFifty);
    await expect(
      primary.connection.reducers.saveBuildRevision(identicalRevisionFifty),
    ).resolves.toBeUndefined();
    expect(viewSummary(primary)).toMatchObject({
      headRevisionId: 'stress-revision-100',
      builds: [{ id: buildId, headRevisionId: 'stress-revision-100' }],
    });
    expect(viewSummary(primary).revisions).toHaveLength(100);
    expect(viewSummary(primary).revisionEquipment).toHaveLength(100);
    expect(viewSummary(primary).revisionOwnedItems).toHaveLength(100);

    const conflictingRevisionFifty = {
      ...revision(50, 'stress-revision-49'),
      profile: { ...revision(50, 'stress-revision-49').profile, str: 51 },
    };
    reducerInputs.push(conflictingRevisionFifty);
    await expect(
      primary.connection.reducers.saveBuildRevision(conflictingRevisionFifty),
    ).rejects.toThrow(/Revision ID already exists with different content/);
    expect(viewSummary(primary).headRevisionId).toBe('stress-revision-100');
    expect(viewSummary(primary).revisions).toHaveLength(100);
    expect(viewSummary(primary).revisionEquipment).toHaveLength(100);
    expect(viewSummary(primary).revisionOwnedItems).toHaveLength(100);

    for (let index = 101; index <= 120; index += 1) {
      const input = revision(index, parentRevisionId);
      reducerInputs.push(input);
      const connection = index % 2 === 0 ? secondary : primary;
      await connection.connection.reducers.saveBuildRevision(input);
      parentRevisionId = input.revisionId;
    }

    for (const connection of [primary, secondary]) {
      await expect.poll(() => {
        const summary = viewSummary(connection);
        return {
          builds: summary.builds.length,
          revisions: summary.revisions.length,
          revisionEquipment: summary.revisionEquipment.length,
          revisionOwnedItems: summary.revisionOwnedItems.length,
          headRevisionId: summary.headRevisionId,
        };
      }).toEqual({
        builds: 1,
        revisions: 120,
        revisionEquipment: 120,
        revisionOwnedItems: 120,
        headRevisionId: 'stress-revision-120',
      });
      expect(
        viewSummary(connection)
          .revisions.map((storedRevision) => storedRevision.id)
          .sort(
            (left, right) =>
              Number(left.slice(left.lastIndexOf('-') + 1)) -
              Number(right.slice(right.lastIndexOf('-') + 1)),
          ),
      ).toEqual(
        Array.from({ length: 120 }, (_unused, index) =>
          `stress-revision-${index + 1}`,
        ),
      );
    }

    await expect.poll(() => viewSummary(foreign!).builds.length).toBe(0);
    await expect(
      foreign.connection.reducers.saveBuildRevision({
        ...revision(121),
        name: 'Foreign Revision Attempt',
      }),
    ).rejects.toThrow(/owned by another identity/);
    expect(viewSummary(foreign).revisions).toHaveLength(0);

    await expect.poll(() => {
      const owner = buildSummary(primary!, buildId);
      return {
        headRevisionId: owner.build?.headRevisionId,
        revisions: owner.revisions.length,
        revisionEquipment: owner.revisionEquipment.length,
        revisionOwnedItems: owner.revisionOwnedItems.length,
      };
    }).toEqual({
      headRevisionId: 'stress-revision-120',
      revisions: 120,
      revisionEquipment: 120,
      revisionOwnedItems: 120,
    });

    const localDatabaseName = `cloud-offline-replay-${crypto.randomUUID()}`;
    const guestStore = createGuestBuildStore({ databaseName: localDatabaseName });
    const pendingQueue = createPendingRevisionQueue({
      databaseName: localDatabaseName,
    });
    const replayRevisionIds = [
      'offline-replay-1',
      'offline-replay-2',
      'offline-replay-3',
    ];
    let nextReplayRevision = 0;
    const offlineRepository = createBuildRepository({
      guestStore,
      pendingQueue,
      accountSubject: offlineSubject,
      reducers: {
        ...liveReducers(primary),
        saveBuildRevision: async () => {
          throw new Error('offline');
        },
      },
      randomUUID: () => replayRevisionIds[nextReplayRevision++]!,
      now: () => `2026-08-29T10:00:0${nextReplayRevision}.000Z`,
    });

    for (let level = 121; level <= 123; level += 1) {
      await expect(offlineRepository.save(offlineProfile(level))).resolves.toMatchObject({
        location: 'cloud-pending',
      });
    }
    await pendingQueue.enqueue({
      subject: 'another-account',
      revisionId: 'another-account-pending',
      buildId: 'another-account-build',
      profile: offlineProfile(124),
      enqueuedAt: '2026-08-29T10:00:04.000Z',
      attempts: 0,
    });
    clientQueueState = {
      beforeFlush: {
        owner: await pendingQueue.list(offlineSubject),
        anotherAccount: await pendingQueue.list('another-account'),
      },
    };

    reconnected = await connect(primary.token);
    const reconnectedRepository = createBuildRepository({
      guestStore,
      pendingQueue,
      accountSubject: offlineSubject,
      reducers: liveReducers(reconnected),
    });
    await reconnectedRepository.retryPending();
    clientQueueState = {
      ...(clientQueueState as object),
      afterFlush: {
        owner: await pendingQueue.list(offlineSubject),
        anotherAccount: await pendingQueue.list('another-account'),
      },
    };

    await expect.poll(() => {
      const replayed = buildSummary(primary!, offlineBuildId);
      return {
        headRevisionId: replayed.build?.headRevisionId,
        revisions: replayed.revisions
          .map((storedRevision) => ({
            id: storedRevision.id,
            parentRevisionId: storedRevision.parentRevisionId,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        revisionEquipment: replayed.revisionEquipment.length,
        revisionOwnedItems: replayed.revisionOwnedItems.length,
      };
    }).toEqual({
      headRevisionId: 'offline-replay-3',
      revisions: [
        { id: 'offline-replay-1', parentRevisionId: undefined },
        { id: 'offline-replay-2', parentRevisionId: 'offline-replay-1' },
        { id: 'offline-replay-3', parentRevisionId: 'offline-replay-2' },
      ],
      revisionEquipment: 3,
      revisionOwnedItems: 3,
    });
    expect(await pendingQueue.list(offlineSubject)).toEqual([]);
    expect(await pendingQueue.list('another-account')).toMatchObject([
      {
        subject: 'another-account',
        revisionId: 'another-account-pending',
        buildId: 'another-account-build',
        attempts: 0,
      },
    ]);
  } catch (error) {
    await attachFailureEvidence(
      testInfo,
      reducerInputs,
      primary,
      secondary,
      foreign,
      clientQueueState,
    );
    throw error;
  } finally {
    disconnect(reconnected);
    disconnect(foreign);
    disconnect(secondary);
    disconnect(primary);
  }
});
