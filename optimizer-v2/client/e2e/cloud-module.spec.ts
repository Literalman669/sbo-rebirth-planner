import { expect, test } from '@playwright/test';
import {
  DbConnection,
  tables,
  type SubscriptionHandle,
} from '../src/module_bindings';

const uri = 'http://127.0.0.1:3000';
const databaseName = 'sbo-rebirth-optimizer-v2-test';

type TestConnection = {
  connection: DbConnection;
  token: string;
  subscription?: SubscriptionHandle;
};

const firstProfile = {
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
        tables.myProfile,
        tables.myBuilds,
        tables.myBuildRevisions,
        tables.myRevisionEquipment,
        tables.myRevisionOwnedItems,
      ]);
  });
  testConnection.subscription = subscription;
}

function disconnect(testConnection: TestConnection) {
  testConnection.subscription?.unsubscribe();
  testConnection.connection.disconnect();
}

test('enforces identity isolation and immutable revision recovery', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');

  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const owner = await connect(ownerToken);
  const userA = await connect();
  const userB = await connect();
  let userASecond: TestConnection | undefined;

  try {
    await owner.connection.reducers.configureAuth({
      mode: 'locked',
      issuer: '',
      audience: '',
    });
    await expect(
      userA.connection.reducers.saveBuildRevision({
        buildId: 'build-a',
        revisionId: 'revision-a1',
        name: 'Alicization Route',
        profile: firstProfile,
        equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
        ownedItemIds: ['iron-greatsword'],
      }),
    ).rejects.toThrow(/Cloud features are not configured/);

    await owner.connection.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });

    await subscribeToPrivateViews(userA);
    await subscribeToPrivateViews(userB);

    await userA.connection.reducers.saveBuildRevision({
      buildId: 'build-a',
      revisionId: 'revision-a1',
      name: 'Alicization Route',
      profile: firstProfile,
      equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
      ownedItemIds: ['iron-greatsword'],
    });

    await expect.poll(() => [...userA.connection.db.myBuilds.iter()].length).toBe(1);
    expect([...userB.connection.db.myBuilds.iter()]).toHaveLength(0);

    userASecond = await connect(userA.token);
    await subscribeToPrivateViews(userASecond);
    await expect
      .poll(() => [...userASecond!.connection.db.myBuilds.iter()].length)
      .toBe(1);

    await expect(
      userB.connection.reducers.saveBuildRevision({
        buildId: 'build-a',
        revisionId: 'revision-b1',
        name: 'Stolen Route',
        profile: firstProfile,
        equipment: [],
        ownedItemIds: [],
      }),
    ).rejects.toThrow(/owned by another identity/);

    const secondProfile = { ...firstProfile, level: 21, str: 23 };
    await userA.connection.reducers.saveBuildRevision({
      buildId: 'build-a',
      revisionId: 'revision-a2',
      parentRevisionId: 'revision-a1',
      name: 'Alicization Route',
      profile: secondProfile,
      equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
      ownedItemIds: ['iron-greatsword'],
    });

    await expect.poll(() => [...userA.connection.db.myBuildRevisions.iter()].length).toBe(2);
    expect([...userA.connection.db.myBuilds.iter()][0]?.headRevisionId).toBe('revision-a2');
    await expect
      .poll(
        () =>
          [...userASecond!.connection.db.myBuildRevisions.iter()].length,
      )
      .toBe(2);
    expect(
      [...userASecond.connection.db.myBuilds.iter()][0]?.headRevisionId,
    ).toBe('revision-a2');

    await userA.connection.reducers.restoreBuildRevision({
      buildId: 'build-a',
      sourceRevisionId: 'revision-a1',
      newRevisionId: 'revision-a3',
    });

    await expect.poll(() => [...userA.connection.db.myBuildRevisions.iter()].length).toBe(3);
    const restored = [...userA.connection.db.myBuildRevisions.iter()].find(
      (revision) => revision.id === 'revision-a3',
    );
    expect(restored).toMatchObject({ level: 20, str: 20 });
    expect([...userA.connection.db.myBuilds.iter()][0]?.headRevisionId).toBe('revision-a3');

    await userA.connection.reducers.deleteBuild({ buildId: 'build-a' });
    await expect.poll(() => [...userA.connection.db.myBuilds.iter()].length).toBe(0);
    expect([...userA.connection.db.myBuildRevisions.iter()]).toHaveLength(0);
  } finally {
    if (userASecond) disconnect(userASecond);
    disconnect(userB);
    disconnect(userA);
    disconnect(owner);
  }
});
