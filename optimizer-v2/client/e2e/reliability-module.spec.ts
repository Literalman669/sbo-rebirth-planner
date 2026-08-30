import { expect, test, type TestInfo } from '@playwright/test';
import 'fake-indexeddb/auto';
import { writeFile } from 'node:fs/promises';
import type { Identity } from 'spacetimedb';
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
const historicalShareId = `historical-snapshot-${'h'.repeat(24)}`;

type TestConnection = {
  connection: DbConnection;
  identity: Identity;
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
  const isHistoricalChildSnapshot = index <= 50;
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
    equipment: isHistoricalChildSnapshot
      ? [
          { slot: 'main-hand', itemId: 'steel-greatsword' },
          { slot: 'armor', itemId: 'beginner-armor' },
        ]
      : [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
    ownedItemIds: isHistoricalChildSnapshot
      ? ['steel-greatsword', 'beginner-armor']
      : ['iron-greatsword'],
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
      .onConnect((connection, identity, issuedToken) =>
        resolve({ connection, identity, token: issuedToken }),
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

async function subscribeToPublicShares(testConnection: TestConnection) {
  const subscription = await new Promise<SubscriptionHandle>((resolve, reject) => {
    const handle = testConnection.connection
      .subscriptionBuilder()
      .onApplied(() => resolve(handle))
      .onError(() => reject(new Error('Public share subscription failed')))
      .subscribe([
        tables.sharedBuild,
        tables.sharedBuildEquipment,
        tables.sharedBuildOwnedItem,
      ]);
  });
  testConnection.subscription = subscription;
}

async function subscribeToPublicationViews(testConnection: TestConnection) {
  const subscription = await new Promise<SubscriptionHandle>((resolve, reject) => {
    const handle = testConnection.connection
      .subscriptionBuilder()
      .onApplied(() => resolve(handle))
      .onError(() => reject(new Error('Publication stress subscription failed')))
      .subscribe([
        tables.datasetRelease,
        tables.equipment,
        tables.formula,
        tables.sourceReference,
        tables.myCuratorAccess,
        tables.myWikiCandidates,
        tables.myReleaseDrafts,
        tables.myDraftEquipment,
        tables.myDraftFormulas,
        tables.myDraftSourceReferences,
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

function publicShareSummary(testConnection: TestConnection, shareId: string) {
  return {
    builds: [...testConnection.connection.db.sharedBuild.iter()].filter(
      (candidate) => candidate.shareId === shareId,
    ),
    equipment: [
      ...testConnection.connection.db.sharedBuildEquipment.iter(),
    ].filter((candidate) => candidate.shareId === shareId),
    ownedItems: [
      ...testConnection.connection.db.sharedBuildOwnedItem.iter(),
    ].filter((candidate) => candidate.shareId === shareId),
  };
}

function publicShareChildren(testConnection: TestConnection, shareId: string) {
  const summary = publicShareSummary(testConnection, shareId);
  return {
    equipment: summary.equipment
      .map(({ slot, itemId }) => ({ slot, itemId }))
      .sort(
        (left, right) =>
          left.slot.localeCompare(right.slot) ||
          left.itemId.localeCompare(right.itemId),
      ),
    ownedItems: summary.ownedItems.map(({ itemId }) => itemId).sort(),
  };
}

function privateRevisionChildren(
  testConnection: TestConnection,
  revisionId: string,
) {
  return {
    equipment: [...testConnection.connection.db.myRevisionEquipment.iter()]
      .filter((candidate) => candidate.revisionId === revisionId)
      .map(({ slot, itemId }) => ({ slot, itemId }))
      .sort((left, right) => left.slot.localeCompare(right.slot)),
    ownedItems: [...testConnection.connection.db.myRevisionOwnedItems.iter()]
      .filter((candidate) => candidate.revisionId === revisionId)
      .map(({ itemId }) => itemId)
      .sort(),
  };
}

function shareIdForCycle(index: number) {
  return `share-revoke-${String(index).padStart(2, '0')}-${'s'.repeat(28)}`;
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

const publicationRevisions = {
  Stats: '900001',
  'Two-Handed': '900002',
  'One-Handed': '900003',
  Rapier: '900004',
  Dagger: '900005',
  Fists: '900006',
  Armor: '900007',
  Shields: '900008',
} as const;

const publicationEquipment = [
  {
    itemId: 'iron-greatsword',
    name: 'Iron Greatsword',
    pageTitle: 'Two-Handed',
    slot: 'main-hand',
    weaponPaths: 'two-handed',
    attack: 3,
    defense: 0,
    dexterity: 0,
    skillRequirement: 1,
    acquisitionType: 'starter',
  },
  {
    itemId: 'steel-greatsword',
    name: 'Steel Greatsword',
    pageTitle: 'Two-Handed',
    slot: 'main-hand',
    weaponPaths: 'two-handed',
    attack: 10,
    defense: 0,
    dexterity: 0,
    skillRequirement: 5,
    acquisitionType: 'shop',
  },
  {
    itemId: 'beginner-sword',
    name: 'Beginner Sword',
    pageTitle: 'One-Handed',
    slot: 'main-hand',
    weaponPaths: 'one-handed,dual-wield',
    attack: 3.4,
    defense: 0,
    dexterity: 0,
    skillRequirement: 1,
    acquisitionType: 'starter',
  },
  {
    itemId: 'iron-rapier',
    name: 'Iron Rapier',
    pageTitle: 'Rapier',
    slot: 'main-hand',
    weaponPaths: 'rapier',
    attack: 2.6,
    defense: 0,
    dexterity: 0,
    skillRequirement: 1,
    acquisitionType: 'starter',
  },
  {
    itemId: 'iron-dagger',
    name: 'Iron Dagger',
    pageTitle: 'Dagger',
    slot: 'main-hand',
    weaponPaths: 'dagger',
    attack: 2.5,
    defense: 0,
    dexterity: 0,
    skillRequirement: 1,
    acquisitionType: 'starter',
  },
  {
    itemId: 'fists',
    name: 'Fists',
    pageTitle: 'Fists',
    slot: 'main-hand',
    weaponPaths: 'melee',
    attack: 2.5,
    defense: 0,
    dexterity: 0,
    skillRequirement: 1,
    acquisitionType: 'starter',
  },
  {
    itemId: 'beginner-armor',
    name: 'Beginner Armor',
    pageTitle: 'Armor',
    slot: 'armor',
    weaponPaths: '',
    attack: 0,
    defense: 0.5,
    dexterity: 3,
    skillRequirement: undefined,
    acquisitionType: 'starter',
  },
  {
    itemId: 'wooden-shield',
    name: 'Wooden Shield',
    pageTitle: 'Shields',
    slot: 'shield',
    weaponPaths: 'one-handed,rapier,dagger',
    attack: 0,
    defense: 0.6,
    dexterity: 0,
    skillRequirement: undefined,
    acquisitionType: 'starter',
  },
] as const;

const publicationFormulaIds = [
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

type PublicationInvalidKind =
  | 'valid'
  | 'missing-formula'
  | 'missing-path'
  | 'duplicate-item'
  | 'duplicate-formula'
  | 'duplicate-source'
  | 'invalid-gap'
  | 'wrong-page'
  | 'mismatched-revision'
  | 'unaccepted-candidate'
  | 'missing-source';

function publicationCandidateId(
  pageTitle: keyof typeof publicationRevisions,
  revisionId: string = publicationRevisions[pageTitle],
) {
  return `${pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${revisionId}`;
}

function publicationWikiResponse(pageTitle: string, revisionId: string) {
  return JSON.stringify({
    query: {
      pages: [
        {
          title: pageTitle,
          revisions: [
            {
              revid: Number(revisionId),
              timestamp: '2026-08-29T12:00:00Z',
              slots: { main: { content: `${pageTitle} Task 9 fixture` } },
            },
          ],
        },
      ],
    },
  });
}

async function ensureAcceptedPublicationCandidates(
  owner: TestConnection,
  curator: TestConnection,
) {
  for (const [pageTitle, revisionId] of Object.entries(publicationRevisions)) {
    const typedPageTitle = pageTitle as keyof typeof publicationRevisions;
    const candidateId = publicationCandidateId(typedPageTitle);
    const current = [...curator.connection.db.myWikiCandidates.iter()].find(
      (row) => row.id === candidateId,
    );
    if (!current) {
      await owner.connection.reducers.stageWikiFixtureForLocalTest({
        pageTitle,
        responseBody: publicationWikiResponse(pageTitle, revisionId),
      });
    }
    await expect
      .poll(
        () =>
          [...curator.connection.db.myWikiCandidates.iter()].find(
            (row) => row.id === candidateId,
          )?.status,
      )
      .toMatch(/pending|accepted/);
    const staged = [...curator.connection.db.myWikiCandidates.iter()].find(
      (row) => row.id === candidateId,
    );
    if (staged?.status === 'pending') {
      await curator.connection.reducers.recordReviewDecision({
        id: `task-9:review:${candidateId}`,
        candidateId,
        decision: 'accept',
        note: `Task 9 reviewed ${pageTitle} at revision ${revisionId}.`,
      });
    }
    await expect
      .poll(
        () =>
          [...curator.connection.db.myWikiCandidates.iter()].find(
            (row) => row.id === candidateId,
          )?.status,
      )
      .toBe('accepted');
  }
}

async function stagePendingPublicationCandidate(
  owner: TestConnection,
  curator: TestConnection,
) {
  const revisionId = '900099';
  const candidateId = publicationCandidateId('Two-Handed', revisionId);
  await owner.connection.reducers.stageWikiFixtureForLocalTest({
    pageTitle: 'Two-Handed',
    responseBody: publicationWikiResponse('Two-Handed', revisionId),
  });
  await expect
    .poll(
      () =>
        [...curator.connection.db.myWikiCandidates.iter()].find(
          (row) => row.id === candidateId,
        )?.status,
    )
    .toBe('pending');
  return { candidateId, revisionId };
}

async function seedPublicationDraft(
  curator: TestConnection,
  version: string,
  kind: PublicationInvalidKind,
) {
  await curator.connection.reducers.createReleaseDraft({
    version,
    formulaSetVersion: 'sbor-stats-v1',
    sourceSummary: `Task 9 ${kind} publication fixture`,
    lastReviewedAt: '2026-08-29',
  });

  for (const item of publicationEquipment) {
    if (kind === 'missing-path' && item.itemId === 'iron-rapier') continue;
    const wrongPage = kind === 'wrong-page' && item.itemId === 'iron-greatsword';
    const pendingCandidate =
      kind === 'unaccepted-candidate' && item.itemId === 'iron-greatsword';
    const pageTitle = wrongPage ? 'Stats' : item.pageTitle;
    const revisionId = pendingCandidate
      ? '900099'
      : publicationRevisions[pageTitle];
    const candidateId = publicationCandidateId(pageTitle, revisionId);
    const sourceRefId = `${version}:source:equipment:${item.itemId}`;
    if (!(kind === 'missing-source' && item.itemId === 'iron-greatsword')) {
      await curator.connection.reducers.upsertDraftSourceReference({
        id: sourceRefId,
        releaseVersion: version,
        entityKind: 'equipment',
        entityId: item.itemId,
        sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
        sourceRevision:
          kind === 'mismatched-revision' && item.itemId === 'iron-greatsword'
            ? '999'
            : revisionId,
        capturedAt: '2026-08-29T12:00:00Z',
        lastReviewedAt: '2026-08-29',
        candidateId,
      });
    }
    await curator.connection.reducers.upsertDraftEquipment({
      id: `${version}:equipment:${item.itemId}`,
      releaseVersion: version,
      itemId: item.itemId,
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
      acquisitionDetail: 'Task 9 exact integration fixture',
      availability: 'always',
      sourceRefId,
      lastReviewedAt: '2026-08-29',
      candidateId,
    });
  }

  if (kind === 'duplicate-item') {
    const sourceRefId = `${version}:source:equipment:iron-greatsword`;
    await curator.connection.reducers.upsertDraftEquipment({
      id: `${version}:equipment:duplicate-iron-greatsword`,
      releaseVersion: version,
      itemId: 'iron-greatsword',
      name: 'Duplicate Iron Greatsword',
      slot: 'main-hand',
      weaponPaths: 'two-handed',
      attack: 3,
      defense: 0,
      dexterity: 0,
      levelRequirement: 1,
      skillRequirement: 1,
      floor: 1,
      acquisitionType: 'starter',
      acquisitionDetail: 'Task 9 duplicate item fixture',
      availability: 'always',
      sourceRefId,
      lastReviewedAt: '2026-08-29',
      candidateId: publicationCandidateId('Two-Handed'),
    });
  }

  const statsCandidateId = publicationCandidateId('Stats');
  for (const formulaId of publicationFormulaIds) {
    if (kind === 'missing-formula' && formulaId === 'points-per-level') continue;
    const sourceRefId = `${version}:source:formula:${formulaId}`;
    await curator.connection.reducers.upsertDraftSourceReference({
      id: sourceRefId,
      releaseVersion: version,
      entityKind: 'formula',
      entityId: formulaId,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      sourceRevision: publicationRevisions.Stats,
      capturedAt: '2026-08-29T12:00:00Z',
      lastReviewedAt: '2026-08-29',
      candidateId: statsCandidateId,
    });
    await curator.connection.reducers.upsertDraftFormula({
      id: `${version}:formula:${formulaId}`,
      releaseVersion: version,
      formulaId,
      expression: `${formulaId} literal Task 9 expression`,
      units: 'verified units',
      applicability: 'all players',
      boundaryBehavior: 'literal reviewed boundary',
      sourceRefId,
      lastReviewedAt: '2026-08-29',
      candidateId: statsCandidateId,
    });
  }

  if (kind === 'duplicate-formula') {
    await curator.connection.reducers.upsertDraftFormula({
      id: `${version}:formula:duplicate-points-per-level`,
      releaseVersion: version,
      formulaId: 'points-per-level',
      expression: 'duplicate literal Task 9 expression',
      units: 'verified units',
      applicability: 'all players',
      boundaryBehavior: 'literal reviewed boundary',
      sourceRefId: `${version}:source:formula:points-per-level`,
      lastReviewedAt: '2026-08-29',
      candidateId: statsCandidateId,
    });
  }

  if (kind === 'duplicate-source') {
    await curator.connection.reducers.upsertDraftSourceReference({
      id: `${version}:source:duplicate:iron-greatsword`,
      releaseVersion: version,
      entityKind: 'equipment',
      entityId: 'iron-greatsword',
      sourceUrl:
        'https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed',
      sourceRevision: publicationRevisions['Two-Handed'],
      capturedAt: '2026-08-29T12:00:00Z',
      lastReviewedAt: '2026-08-29',
      candidateId: publicationCandidateId('Two-Handed'),
    });
  }

  if (kind === 'invalid-gap') {
    await curator.connection.reducers.upsertDraftSourceReference({
      id: `${version}:source:gap:invalid`,
      releaseVersion: version,
      entityKind: 'gap',
      entityId: 'gap:two-handed:not-a-band',
      sourceUrl:
        'https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed',
      sourceRevision: publicationRevisions['Two-Handed'],
      capturedAt: '2026-08-29T12:00:00Z',
      lastReviewedAt: '2026-08-29',
      candidateId: publicationCandidateId('Two-Handed'),
    });
  }
}

function publicPublicationState(testConnection: TestConnection) {
  const releases = [...testConnection.connection.db.datasetRelease.iter()];
  return {
    releaseCount: releases.length,
    equipmentCount: [...testConnection.connection.db.equipment.iter()].length,
    formulaCount: [...testConnection.connection.db.formula.iter()].length,
    sourceCount: [...testConnection.connection.db.sourceReference.iter()].length,
    currentVersions: releases
      .filter((release) => release.isCurrent)
      .map((release) => release.version)
      .sort(),
  };
}

function publishedVersionCounts(
  testConnection: TestConnection,
  version: string,
) {
  return {
    releases: [...testConnection.connection.db.datasetRelease.iter()].filter(
      (row) => row.version === version,
    ).length,
    equipment: [...testConnection.connection.db.equipment.iter()].filter(
      (row) => row.releaseVersion === version,
    ).length,
    formulas: [...testConnection.connection.db.formula.iter()].filter(
      (row) => row.releaseVersion === version,
    ).length,
    sources: [...testConnection.connection.db.sourceReference.iter()].filter(
      (row) => row.releaseVersion === version,
    ).length,
  };
}

async function attachFailureEvidence(
  testInfo: TestInfo,
  reducerInputs: readonly RevisionInput[],
  primary: TestConnection | undefined,
  secondary: TestConnection | undefined,
  foreign: TestConnection | undefined,
  publicViewer: TestConnection | undefined,
  clientQueueState: unknown,
  sharingState: unknown,
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
        publicShareSubscription: publicViewer
          ? {
              historical: publicShareSummary(publicViewer, historicalShareId),
              cycles: Array.from({ length: 50 }, (_unused, index) => {
                const shareId = shareIdForCycle(index + 1);
                return { shareId, ...publicShareSummary(publicViewer, shareId) };
              }),
            }
          : undefined,
        clientQueueState,
        sharingState,
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
  let publicViewer: TestConnection | undefined;
  let reconnected: TestConnection | undefined;
  let clientQueueState: unknown;
  let sharingState: unknown;

  try {
    primary = await connect();
    secondary = await connect(primary.token);
    foreign = await connect();
    publicViewer = await connect();
    await Promise.all([
      subscribeToPrivateViews(primary),
      subscribeToPrivateViews(secondary),
      subscribeToPrivateViews(foreign),
      subscribeToPublicShares(publicViewer),
    ]);

    let parentRevisionId: string | undefined;
    for (let index = 1; index <= 50; index += 1) {
      const input = revision(index, parentRevisionId);
      reducerInputs.push(input);
      await primary.connection.reducers.saveBuildRevision(input);
      parentRevisionId = input.revisionId;
    }

    await primary.connection.reducers.createBuildShare({
      buildId,
      shareId: historicalShareId,
    });
    await expect.poll(() => publicShareSummary(publicViewer!, historicalShareId)).toMatchObject({
      builds: [
        {
          shareId: historicalShareId,
          name: 'Cloud Revision Stress',
          level: 50,
          str: 50,
          datasetVersion: 'bootstrap-0',
        },
      ],
    });
    await expect.poll(() => publicShareChildren(publicViewer!, historicalShareId)).toEqual({
      equipment: [
        { slot: 'armor', itemId: 'beginner-armor' },
        { slot: 'main-hand', itemId: 'steel-greatsword' },
      ],
      ownedItems: ['beginner-armor', 'steel-greatsword'],
    });
    const historicalSnapshot = publicShareSummary(publicViewer, historicalShareId).builds[0]!;
    expect(historicalSnapshot).not.toHaveProperty('owner');
    expect(historicalSnapshot).not.toHaveProperty('identity');
    expect(historicalSnapshot).not.toHaveProperty('profile');
    expect(historicalSnapshot).not.toHaveProperty('buildId');

    for (let index = 51; index <= 100; index += 1) {
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
      revisionEquipment: 150,
      revisionOwnedItems: 150,
      headRevisionId: 'stress-revision-100',
    });

    await expect.poll(() => publicShareSummary(publicViewer!, historicalShareId)).toMatchObject({
      builds: [
        {
          shareId: historicalShareId,
          level: 50,
          str: 50,
          datasetVersion: 'bootstrap-0',
        },
      ],
    });
    await expect.poll(() => publicShareChildren(publicViewer!, historicalShareId)).toEqual({
      equipment: [
        { slot: 'armor', itemId: 'beginner-armor' },
        { slot: 'main-hand', itemId: 'steel-greatsword' },
      ],
      ownedItems: ['beginner-armor', 'steel-greatsword'],
    });
    expect(
      privateRevisionChildren(primary, 'stress-revision-100'),
    ).toEqual({
      equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
      ownedItems: ['iron-greatsword'],
    });

    const revokedShares: string[] = [];
    for (let index = 1; index <= 50; index += 1) {
      const shareId = shareIdForCycle(index);
      await primary.connection.reducers.createBuildShare({ buildId, shareId });
      await expect.poll(() => publicShareSummary(publicViewer!, shareId)).toMatchObject({
        builds: [{ shareId, level: 100, str: 100 }],
        equipment: [{ slot: 'main-hand', itemId: 'iron-greatsword' }],
        ownedItems: [{ itemId: 'iron-greatsword' }],
      });

      await primary.connection.reducers.revokeBuildShare({ shareId });
      await expect.poll(() => {
        const publicRows = publicShareSummary(publicViewer!, shareId);
        const privateRows = buildSummary(primary!, buildId);
        return {
          publicRows: {
            builds: publicRows.builds.length,
            equipment: publicRows.equipment.length,
            ownedItems: publicRows.ownedItems.length,
          },
          privateRows: {
            headRevisionId: privateRows.build?.headRevisionId,
            revisions: privateRows.revisions.length,
            equipment: privateRows.revisionEquipment.length,
            ownedItems: privateRows.revisionOwnedItems.length,
          },
        };
      }).toEqual({
        publicRows: { builds: 0, equipment: 0, ownedItems: 0 },
        privateRows: {
          headRevisionId: 'stress-revision-100',
          revisions: 100,
          equipment: 150,
          ownedItems: 150,
        },
      });
      revokedShares.push(shareId);
    }
    sharingState = {
      historicalShare: publicShareSummary(publicViewer, historicalShareId),
      revokedShares,
      privateBuild: buildSummary(primary, buildId),
    };
    await primary.connection.reducers.revokeBuildShare({ shareId: historicalShareId });
    await expect.poll(() => publicShareSummary(publicViewer!, historicalShareId)).toEqual({
      builds: [],
      equipment: [],
      ownedItems: [],
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
    expect(viewSummary(primary).revisionEquipment).toHaveLength(150);
    expect(viewSummary(primary).revisionOwnedItems).toHaveLength(150);

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
    expect(viewSummary(primary).revisionEquipment).toHaveLength(150);
    expect(viewSummary(primary).revisionOwnedItems).toHaveLength(150);

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
        revisionEquipment: 170,
        revisionOwnedItems: 170,
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
      revisionEquipment: 170,
      revisionOwnedItems: 170,
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
      publicViewer,
      clientQueueState,
      sharingState,
    );
    throw error;
  } finally {
    disconnect(reconnected);
    disconnect(publicViewer);
    disconnect(foreign);
    disconnect(secondary);
    disconnect(primary);
  }
});

test('rejects invalid publications atomically and carries one reviewed row into a second release', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Module integration runs once.');
  const ownerToken = process.env.SBO_TEST_OWNER_TOKEN;
  if (!ownerToken) throw new Error('SBO_TEST_OWNER_TOKEN is required');

  const firstVersion = '2026.08.29.90';
  const secondVersion = '2026.08.29.102';
  const invalidEvidence: Array<{
    category: string;
    version: string;
    rejection: string;
    before: ReturnType<typeof publicPublicationState>;
    observedAfter: ReturnType<typeof publicPublicationState>;
  }> = [];
  let owner: TestConnection | undefined;
  let curator: TestConnection | undefined;

  try {
    owner = await connect(ownerToken);
    curator = await connect();
    await owner.connection.reducers.configureAuth({
      mode: 'development',
      issuer: '',
      audience: '',
    });
    await owner.connection.reducers.grantCurator({ identity: curator.identity });
    await subscribeToPublicationViews(curator);
    await expect
      .poll(() => [...curator!.connection.db.myCuratorAccess.iter()][0]?.access)
      .toBe('curator');

    await ensureAcceptedPublicationCandidates(owner, curator);
    await stagePendingPublicationCandidate(owner, curator);

    const publishRelease = (
      curator.connection.reducers as unknown as {
        publishRelease(args: { version: string }): Promise<void>;
      }
    ).publishRelease;
    const createReleaseDraftFromCurrent = (
      curator.connection.reducers as unknown as {
        createReleaseDraftFromCurrent(args: {
          version: string;
          sourceSummary: string;
          lastReviewedAt: string;
        }): Promise<void>;
      }
    ).createReleaseDraftFromCurrent;

    await seedPublicationDraft(curator, firstVersion, 'valid');
    await publishRelease({ version: firstVersion });
    await expect
      .poll(() => publicPublicationState(curator!).currentVersions)
      .toEqual([firstVersion]);
    await expect
      .poll(() => publishedVersionCounts(curator!, firstVersion))
      .toEqual({ releases: 1, equipment: 8, formulas: 9, sources: 17 });

    const invalidCases: readonly {
      category: string;
      version: string;
      kind: Exclude<PublicationInvalidKind, 'valid'>;
      error: string;
    }[] = [
      {
        category: 'missing required formula',
        version: '2026.08.29.91',
        kind: 'missing-formula',
        error: 'Missing required formula: points-per-level',
      },
      {
        category: 'missing optimizer path',
        version: '2026.08.29.92',
        kind: 'missing-path',
        error: 'Missing weapon-path coverage: rapier',
      },
      {
        category: 'duplicate item ID',
        version: '2026.08.29.93',
        kind: 'duplicate-item',
        error: 'Duplicate equipment item ID: iron-greatsword',
      },
      {
        category: 'duplicate formula ID',
        version: '2026.08.29.94',
        kind: 'duplicate-formula',
        error: 'Duplicate formula ID: points-per-level',
      },
      {
        category: 'duplicate public source ID',
        version: '2026.08.29.95',
        kind: 'duplicate-source',
        error:
          'Duplicate public source reference ID: 2026.08.29.95:iron-greatsword',
      },
      {
        category: 'invalid known-gap grammar',
        version: '2026.08.29.96',
        kind: 'invalid-gap',
        error: 'has an invalid known-gap identifier',
      },
      {
        category: 'wrong candidate page',
        version: '2026.08.29.97',
        kind: 'wrong-page',
        error:
          'Equipment iron-greatsword must use the Two-Handed candidate page',
      },
      {
        category: 'mismatched source revision',
        version: '2026.08.29.98',
        kind: 'mismatched-revision',
        error: 'does not match candidate two-handed:900002',
      },
      {
        category: 'unaccepted candidate',
        version: '2026.08.29.99',
        kind: 'unaccepted-candidate',
        error: 'Candidate two-handed:900099 is not accepted',
      },
      {
        category: 'missing source reference',
        version: '2026.08.29.100',
        kind: 'missing-source',
        error: 'Equipment iron-greatsword has no source reference',
      },
    ];

    for (const invalidCase of invalidCases) {
      await seedPublicationDraft(
        curator,
        invalidCase.version,
        invalidCase.kind,
      );
      const before = publicPublicationState(curator);
      const rejection = await publishRelease({ version: invalidCase.version }).then(
        () => 'REDUCER RESOLVED WITHOUT REJECTION',
        (error: unknown) => (error instanceof Error ? error.message : String(error)),
      );
      const observedAfter = publicPublicationState(curator);
      invalidEvidence.push({
        category: invalidCase.category,
        version: invalidCase.version,
        rejection,
        before,
        observedAfter,
      });
      expect(rejection).toContain(invalidCase.error);
      await expect
        .poll(() => publicPublicationState(curator!))
        .toEqual(before);
    }

    const beforeUnsupportedFormulaSet = publicPublicationState(curator);
    const unsupportedFormulaSetRejection = await curator.connection.reducers
      .createReleaseDraft({
        version: '2026.08.29.101',
        formulaSetVersion: 'sbor-stats-v2',
        sourceSummary: 'Task 9 unsupported formula set fixture',
        lastReviewedAt: '2026-08-29',
      })
      .then(
        () => 'REDUCER RESOLVED WITHOUT REJECTION',
        (error: unknown) => (error instanceof Error ? error.message : String(error)),
      );
    const afterUnsupportedFormulaSet = publicPublicationState(curator);
    invalidEvidence.push({
      category: 'unsupported formula set',
      version: '2026.08.29.101',
      rejection: unsupportedFormulaSetRejection,
      before: beforeUnsupportedFormulaSet,
      observedAfter: afterUnsupportedFormulaSet,
    });
    expect(unsupportedFormulaSetRejection).toContain(
      'Formula set version is unsupported',
    );
    await expect
      .poll(() => publicPublicationState(curator!))
      .toEqual(beforeUnsupportedFormulaSet);

    await createReleaseDraftFromCurrent({
      version: secondVersion,
      sourceSummary: 'Task 9 carried-forward release with one reviewed change',
      lastReviewedAt: '2026-08-30',
    });
    await expect
      .poll(() => ({
        equipment: [...curator!.connection.db.myDraftEquipment.iter()].filter(
          (row) => row.releaseVersion === secondVersion,
        ).length,
        formulas: [...curator!.connection.db.myDraftFormulas.iter()].filter(
          (row) => row.releaseVersion === secondVersion,
        ).length,
        sources: [
          ...curator!.connection.db.myDraftSourceReferences.iter(),
        ].filter((row) => row.releaseVersion === secondVersion).length,
      }))
      .toEqual({ equipment: 8, formulas: 9, sources: 17 });

    const reviewedRow = [
      ...curator.connection.db.myDraftEquipment.iter(),
    ].find(
      (row) =>
        row.releaseVersion === secondVersion &&
        row.itemId === 'iron-greatsword',
    );
    expect(reviewedRow).toBeDefined();
    await curator.connection.reducers.upsertDraftEquipment({
      ...reviewedRow!,
      attack: 4,
      lastReviewedAt: '2026-08-30',
    });
    await publishRelease({ version: secondVersion });

    await expect
      .poll(() => publicPublicationState(curator!).currentVersions)
      .toEqual([secondVersion]);
    await expect
      .poll(() => ({
        first: publishedVersionCounts(curator!, firstVersion),
        second: publishedVersionCounts(curator!, secondVersion),
      }))
      .toEqual({
        first: { releases: 1, equipment: 8, formulas: 9, sources: 17 },
        second: { releases: 1, equipment: 8, formulas: 9, sources: 17 },
      });
    expect(
      [...curator.connection.db.datasetRelease.iter()].filter(
        (release) => release.isCurrent,
      ),
    ).toHaveLength(1);
    expect(
      [...curator.connection.db.equipment.iter()].find(
        (row) =>
          row.releaseVersion === firstVersion &&
          row.itemId === 'iron-greatsword',
      ),
    ).toMatchObject({ attack: 3, lastReviewedAt: '2026-08-29' });
    expect(
      [...curator.connection.db.equipment.iter()].find(
        (row) =>
          row.releaseVersion === secondVersion &&
          row.itemId === 'iron-greatsword',
      ),
    ).toMatchObject({ attack: 4, lastReviewedAt: '2026-08-30' });
    expect(invalidEvidence).toHaveLength(11);
    expect(
      invalidEvidence.every(
        (entry) =>
          JSON.stringify(entry.before) === JSON.stringify(entry.observedAfter),
      ),
    ).toBe(true);
  } catch (error) {
    const evidencePath = testInfo.outputPath(
      'dataset-publication-stress-evidence.json',
    );
    await writeFile(
      evidencePath,
      JSON.stringify(
        {
          firstVersion,
          secondVersion,
          invalidEvidence,
          publicState: curator ? publicPublicationState(curator) : undefined,
          firstVersionCounts: curator
            ? publishedVersionCounts(curator, firstVersion)
            : undefined,
          secondVersionCounts: curator
            ? publishedVersionCounts(curator, secondVersion)
            : undefined,
        },
        null,
        2,
      ),
    );
    await testInfo.attach('dataset-publication-stress-evidence', {
      path: evidencePath,
      contentType: 'application/json',
    });
    throw error;
  } finally {
    disconnect(curator);
    disconnect(owner);
  }
});
