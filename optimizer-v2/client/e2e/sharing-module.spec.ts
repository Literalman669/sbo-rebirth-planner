import { expect, test } from '@playwright/test';
import { DbConnection, tables } from '../src/module_bindings';

const uri = 'http://127.0.0.1:3000';
const databaseName = 'sbo-rebirth-optimizer-v2-test';
const shareId = 'A'.repeat(43);

async function connect(token?: string): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(databaseName)
      .onConnect((connection) => resolve(connection))
      .onConnectError((_context, error) => reject(error));
    if (token) builder = builder.withToken(token);
    builder.build();
  });
}

async function subscribeToShares(connection: DbConnection) {
  return new Promise<void>((resolve, reject) => {
    connection
      .subscriptionBuilder()
      .onApplied(() => resolve())
      .onError(() => reject(new Error('Share subscription failed')))
      .subscribe([
        tables.sharedBuild,
        tables.sharedBuildEquipment,
        tables.sharedBuildOwnedItem,
      ]);
  });
}

test('publishes an owner-free snapshot and revokes every public row', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');
  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const owner = await connect(ownerToken);
  const user = await connect();
  const attacker = await connect();
  const viewer = await connect();
  try {
    await owner.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });
    await user.reducers.saveBuildRevision({
      buildId: 'share-build',
      revisionId: 'share-revision',
      name: 'Public Route',
      profile: {
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
        accessPreferences: 'active-event,badge',
      },
      equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
      ownedItemIds: ['iron-greatsword'],
    });

    await expect(
      attacker.reducers.createBuildShare({
        buildId: 'share-build',
        shareId,
      }),
    ).rejects.toThrow();

    await user.reducers.createBuildShare({ buildId: 'share-build', shareId });
    await subscribeToShares(viewer);
    await expect.poll(() => [...viewer.db.sharedBuild.iter()].length).toBe(1);
    const snapshot = [...viewer.db.sharedBuild.iter()][0]!;
    expect(snapshot).toMatchObject({
      shareId,
      schemaVersion: 2,
      level: 20,
      weaponPath: 'two-handed',
      datasetVersion: 'bootstrap-0',
      accessPreferences: 'active-event,badge',
    });
    expect(snapshot).not.toHaveProperty('owner');
    expect(snapshot).not.toHaveProperty('recommendationText');
    expect([...viewer.db.sharedBuildEquipment.iter()]).toHaveLength(1);
    expect([...viewer.db.sharedBuildOwnedItem.iter()]).toHaveLength(1);

    await expect(
      user.reducers.createBuildShare({ buildId: 'share-build', shareId }),
    ).rejects.toThrow();
    await expect(
      attacker.reducers.revokeBuildShare({ shareId }),
    ).rejects.toThrow();

    await user.reducers.revokeBuildShare({ shareId });
    await expect.poll(() => [...viewer.db.sharedBuild.iter()].length).toBe(0);
    expect([...viewer.db.sharedBuildEquipment.iter()]).toHaveLength(0);
    expect([...viewer.db.sharedBuildOwnedItem.iter()]).toHaveLength(0);
  } finally {
    viewer.disconnect();
    attacker.disconnect();
    user.disconnect();
    owner.disconnect();
  }
});
