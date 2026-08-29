import { expect, test } from '@playwright/test';
import { DbConnection, tables, type SubscriptionHandle } from '../src/module_bindings';
import type { Identity } from 'spacetimedb';

const uri = 'http://127.0.0.1:3000';
const databaseName = 'sbo-rebirth-optimizer-v2-test';

type TestConnection = {
  connection: DbConnection;
  identity: Identity;
  subscription?: SubscriptionHandle;
};

async function connect(token?: string): Promise<TestConnection> {
  return new Promise((resolve, reject) => {
    let builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(databaseName)
      .onConnect((connection, identity) => resolve({ connection, identity }))
      .onConnectError((_context, error) => reject(error));
    if (token) builder = builder.withToken(token);
    builder.build();
  });
}

async function subscribeToCurationViews(testConnection: TestConnection) {
  testConnection.subscription = await new Promise<SubscriptionHandle>(
    (resolve, reject) => {
      const handle = testConnection.connection
        .subscriptionBuilder()
        .onApplied(() => resolve(handle))
        .onError(() => reject(new Error('Curation subscription failed')))
        .subscribe([
          tables.datasetRelease,
          tables.equipment,
          tables.formula,
          tables.sourceReference,
          tables.myCuratorAccess,
          tables.myWikiCandidates,
          tables.myReviewDecisions,
          tables.myReleaseDrafts,
          tables.myDraftEquipment,
          tables.myDraftFormulas,
          tables.myDraftSourceReferences,
        ]);
    },
  );
}

async function seedPublishableDraft(
  owner: TestConnection,
  curator: TestConnection,
  version: string,
) {
  const candidateId = 'stats:23125';
  const candidate = [...curator.connection.db.myWikiCandidates.iter()].find(
    (row) => row.id === candidateId,
  );
  if (!candidate) {
    await owner.connection.reducers.stageWikiFixtureForLocalTest({
      pageTitle: 'Stats',
      responseBody: JSON.stringify({
        query: {
          pages: [
            {
              title: 'Stats',
              revisions: [
                {
                  revid: 23125,
                  timestamp: '2025-11-03T13:14:55Z',
                  slots: { main: { content: 'Stats fixture fragment' } },
                },
              ],
            },
          ],
        },
      }),
    });
  }
  await expect
    .poll(
      () =>
        [...curator.connection.db.myWikiCandidates.iter()].find(
          (row) => row.id === candidateId,
        )?.status,
    )
    .toBe('pending');
  await curator.connection.reducers.recordReviewDecision({
    id: `${version}:review`,
    candidateId,
    decision: 'accept',
    note: 'Verified against the captured revision.',
  });
  await curator.connection.reducers.createReleaseDraft({
    version,
    formulaSetVersion: 'sbor-stats-v1',
    sourceSummary: 'Integration release with canonical provenance',
    lastReviewedAt: '2026-08-29',
  });

  const equipment = [
    { itemId: 'iron-greatsword', name: 'Iron Greatsword', slot: 'main-hand', weaponPaths: 'two-handed', attack: 3, defense: 0, dexterity: 0, skillRequirement: 1, acquisitionType: 'starter' },
    { itemId: 'steel-greatsword', name: 'Steel Greatsword', slot: 'main-hand', weaponPaths: 'two-handed', attack: 10, defense: 0, dexterity: 0, skillRequirement: 5, acquisitionType: 'shop' },
    { itemId: 'beginner-sword', name: 'Beginner Sword', slot: 'main-hand', weaponPaths: 'one-handed,dual-wield', attack: 3.4, defense: 0, dexterity: 0, skillRequirement: 1, acquisitionType: 'starter' },
    { itemId: 'iron-rapier', name: 'Iron Rapier', slot: 'main-hand', weaponPaths: 'rapier', attack: 2.6, defense: 0, dexterity: 0, skillRequirement: 1, acquisitionType: 'starter' },
    { itemId: 'iron-dagger', name: 'Iron Dagger', slot: 'main-hand', weaponPaths: 'dagger', attack: 2.5, defense: 0, dexterity: 0, skillRequirement: 1, acquisitionType: 'starter' },
    { itemId: 'fists', name: 'Fists', slot: 'main-hand', weaponPaths: 'melee', attack: 2.5, defense: 0, dexterity: 0, skillRequirement: 1, acquisitionType: 'starter' },
    { itemId: 'beginner-armor', name: 'Beginner Armor', slot: 'armor', weaponPaths: '', attack: 0, defense: 0.5, dexterity: 3, skillRequirement: undefined, acquisitionType: 'starter' },
    { itemId: 'wooden-shield', name: 'Wooden Shield', slot: 'shield', weaponPaths: 'one-handed,rapier,dagger', attack: 0, defense: 0.6, dexterity: 0, skillRequirement: undefined, acquisitionType: 'starter' },
  ] as const;
  for (const item of equipment) {
    const { itemId } = item;
    const sourceRefId = `${version}:source:equipment:${itemId}`;
    await curator.connection.reducers.upsertDraftSourceReference({
      id: sourceRefId,
      releaseVersion: version,
      entityKind: 'equipment',
      entityId: itemId,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      sourceRevision: '23125',
      capturedAt: '2025-11-03T13:14:55Z',
      lastReviewedAt: '2026-08-29',
      candidateId,
    });
    await curator.connection.reducers.upsertDraftEquipment({
      id: `${version}:equipment:${itemId}`,
      releaseVersion: version,
      itemId,
      name: item.name,
      slot: item.slot,
      weaponPaths: item.weaponPaths,
      attack: item.attack,
      defense: item.defense,
      dexterity: item.dexterity,
      levelRequirement: 1,
      skillRequirement: item.skillRequirement,
      floor: 1,
      acquisitionType: item.acquisitionType,
      acquisitionDetail: 'Integration fixture',
      availability: 'always',
      sourceRefId,
      lastReviewedAt: '2026-08-29',
      candidateId,
    });
  }

  const formulaIds = [
    'points-per-level',
    'attack-from-str',
    'damage-reduction-from-def',
    'bonus-hp-from-vit',
    'stamina',
    'walk-speed-from-agi',
    'sprint-speed-from-agi',
    'crit-bonus-from-luk',
    'drop-bonus-from-luk',
  ] as const;
  for (const formulaId of formulaIds) {
    const sourceRefId = `${version}:source:formula:${formulaId}`;
    await curator.connection.reducers.upsertDraftSourceReference({
      id: sourceRefId,
      releaseVersion: version,
      entityKind: 'formula',
      entityId: formulaId,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      sourceRevision: '23125',
      capturedAt: '2025-11-03T13:14:55Z',
      lastReviewedAt: '2026-08-29',
      candidateId,
    });
    await curator.connection.reducers.upsertDraftFormula({
      id: `${version}:formula:${formulaId}`,
      releaseVersion: version,
      formulaId,
      expression: `${formulaId} expression`,
      units: 'verified units',
      applicability: 'all players',
      boundaryBehavior: 'verified boundary',
      sourceRefId,
      lastReviewedAt: '2026-08-29',
      candidateId,
    });
  }
}

function disconnect(testConnection: TestConnection) {
  testConnection.subscription?.unsubscribe();
  testConnection.connection.disconnect();
}

test('owner controls curator access and private draft mutations', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');
  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const owner = await connect(ownerToken);
  const curator = await connect();
  const ordinary = await connect();
  try {
    await owner.connection.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });
    await expect(
      ordinary.connection.reducers.grantCurator({ identity: curator.identity }),
    ).rejects.toThrow(/Owner authorization required/);
    await expect(
      curator.connection.reducers.createReleaseDraft({
        version: '2026.08.29.1',
        formulaSetVersion: 'sbor-stats-v1',
        sourceSummary: 'Initial verified release',
        lastReviewedAt: '2026-08-29',
      }),
    ).rejects.toThrow(/Curator authorization required/);

    await owner.connection.reducers.grantCurator({ identity: curator.identity });
    await subscribeToCurationViews(curator);
    await subscribeToCurationViews(ordinary);
    await expect
      .poll(() => [...curator.connection.db.myCuratorAccess.iter()][0]?.access)
      .toBe('curator');
    expect([...ordinary.connection.db.myCuratorAccess.iter()]).toHaveLength(0);

    await curator.connection.reducers.createReleaseDraft({
      version: '2026.08.29.1',
      formulaSetVersion: 'sbor-stats-v1',
      sourceSummary: 'Initial verified release',
      lastReviewedAt: '2026-08-29',
    });
    await expect
      .poll(() => [...curator.connection.db.myReleaseDrafts.iter()].length)
      .toBe(1);
    expect([...ordinary.connection.db.myReleaseDrafts.iter()]).toHaveLength(0);

    await curator.connection.reducers.upsertDraftSourceReference({
      id: '2026.08.29.1:stats',
      releaseVersion: '2026.08.29.1',
      entityKind: 'formula',
      entityId: 'points-per-level',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      sourceRevision: '123',
      capturedAt: '2026-08-29T00:00:00.000Z',
      lastReviewedAt: '2026-08-29',
      candidateId: 'manual-bootstrap',
    });
    await expect
      .poll(
        () =>
          [...curator.connection.db.myDraftSourceReferences.iter()].length,
      )
      .toBe(1);

    await owner.connection.reducers.revokeCurator({ identity: curator.identity });
    await expect(
      curator.connection.reducers.upsertDraftFormula({
        id: '2026.08.29.1:points-per-level',
        releaseVersion: '2026.08.29.1',
        formulaId: 'points-per-level',
        expression: 'level * 3',
        units: 'points',
        applicability: 'all players',
        boundaryBehavior: 'integer levels only',
        sourceRefId: '2026.08.29.1:stats',
        lastReviewedAt: '2026-08-29',
        candidateId: 'manual-bootstrap',
      }),
    ).rejects.toThrow(/Curator authorization required/);
  } finally {
    disconnect(ordinary);
    disconnect(curator);
    disconnect(owner);
  }
});

test('stages allowlisted wiki revisions as pending candidates only', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Procedure integration runs once.');
  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const owner = await connect(ownerToken);
  const curator = await connect();
  const ordinary = await connect();
  try {
    await owner.connection.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });
    await owner.connection.reducers.grantCurator({ identity: curator.identity });
    const statsResponseBody = JSON.stringify({
      query: {
        pages: [
          {
            title: 'Stats',
            revisions: [
              {
                revid: 23125,
                timestamp: '2025-11-03T13:14:55Z',
                slots: { main: { content: 'Stats fixture fragment' } },
              },
            ],
          },
        ],
      },
    });
    await expect(
      ordinary.connection.reducers.stageWikiFixtureForLocalTest({
        pageTitle: 'Stats',
        responseBody: statsResponseBody,
      }),
    ).rejects.toThrow(/Owner authorization required/);
    await subscribeToCurationViews(curator);

    await expect(
      curator.connection.procedures.fetchWikiCandidate({ pageTitle: 'Admin' }),
    ).rejects.toMatch(/allowlisted/);
    await owner.connection.reducers.stageWikiFixtureForLocalTest({
      pageTitle: 'Stats',
      responseBody: statsResponseBody,
    });
    const candidateId = 'stats:23125';
    await expect
      .poll(() => [...curator.connection.db.myWikiCandidates.iter()].length)
      .toBe(1);
    expect([...curator.connection.db.myWikiCandidates.iter()][0]).toMatchObject({
      id: candidateId,
      pageTitle: 'Stats',
      revisionId: '23125',
      status: 'pending',
    });

    await owner.connection.reducers.stageWikiFixtureForLocalTest({
      pageTitle: 'Stats',
      responseBody: statsResponseBody,
    });
    expect([...curator.connection.db.myWikiCandidates.iter()]).toHaveLength(1);
    await expect(
      owner.connection.reducers.stageWikiFixtureForLocalTest({
        pageTitle: 'Bestiary',
        responseBody: 'x'.repeat(2_000_001),
      }),
    ).rejects.toThrow(/2 MB/);
    await owner.connection.reducers.configureAuth({
      mode: 'locked',
      issuer: '',
      audience: '',
    });
    await expect(
      owner.connection.reducers.stageWikiFixtureForLocalTest({
        pageTitle: 'Stats',
        responseBody: statsResponseBody,
      }),
    ).rejects.toThrow(/development auth/);
  } finally {
    disconnect(ordinary);
    disconnect(curator);
    disconnect(owner);
  }
});

test('publishes a complete release atomically and keeps it immutable', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');
  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const owner = await connect(ownerToken);
  const curator = await connect();
  const ordinary = await connect();
  const invalidVersion = '2026.08.29.2';
  const validVersion = '2026.08.29.3';
  try {
    await owner.connection.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });
    await owner.connection.reducers.grantCurator({ identity: curator.identity });
    await subscribeToCurationViews(curator);
    await curator.connection.reducers.createReleaseDraft({
      version: invalidVersion,
      formulaSetVersion: 'sbor-stats-v1',
      sourceSummary: 'Intentionally incomplete release',
      lastReviewedAt: '2026-08-29',
    });

    const publishAsCurator = (
      curator.connection.reducers as unknown as {
        publishRelease(args: { version: string }): Promise<void>;
      }
    ).publishRelease;
    await expect(publishAsCurator({ version: invalidVersion })).rejects.toThrow(
      /Missing required formula/,
    );
    expect([...curator.connection.db.datasetRelease.iter()]).toHaveLength(1);
    expect([...curator.connection.db.equipment.iter()]).toHaveLength(0);
    expect([...curator.connection.db.formula.iter()]).toHaveLength(0);
    expect([...curator.connection.db.sourceReference.iter()]).toHaveLength(0);

    await seedPublishableDraft(owner, curator, validVersion);
    const publishAsOrdinary = (
      ordinary.connection.reducers as unknown as {
        publishRelease(args: { version: string }): Promise<void>;
      }
    ).publishRelease;
    await expect(publishAsOrdinary({ version: validVersion })).rejects.toThrow(
      /Curator authorization required/,
    );

    await publishAsCurator({ version: validVersion });
    await expect
      .poll(
        () =>
          [...curator.connection.db.datasetRelease.iter()].find(
            (release) => release.version === validVersion,
          )?.isCurrent,
      )
      .toBe(true);
    expect(
      [...curator.connection.db.datasetRelease.iter()].find(
        (release) => release.version === 'bootstrap-0',
      )?.isCurrent,
    ).toBe(false);
    expect([...curator.connection.db.equipment.iter()]).toHaveLength(8);
    expect([...curator.connection.db.formula.iter()]).toHaveLength(9);
    expect([...curator.connection.db.sourceReference.iter()]).toHaveLength(17);
    expect(
      [...curator.connection.db.myReleaseDrafts.iter()].find(
        (draft) => draft.version === validVersion,
      )?.status,
    ).toBe('published');
    await expect(publishAsCurator({ version: validVersion })).rejects.toThrow(
      /already published/,
    );
    await expect(
      curator.connection.reducers.upsertDraftFormula({
        id: `${validVersion}:formula:points-per-level`,
        releaseVersion: validVersion,
        formulaId: 'points-per-level',
        expression: 'changed',
        units: 'points',
        applicability: 'all players',
        boundaryBehavior: 'integer levels',
        sourceRefId: `${validVersion}:source:formula:points-per-level`,
        lastReviewedAt: '2026-08-29',
        candidateId: 'stats:23125',
      }),
    ).rejects.toThrow(/immutable/);
  } finally {
    disconnect(ordinary);
    disconnect(curator);
    disconnect(owner);
  }
});
