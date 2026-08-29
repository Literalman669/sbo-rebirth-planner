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
