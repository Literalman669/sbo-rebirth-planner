import process from 'node:process';
import { firstReleaseSnapshot, sourceRevisions } from './first-release-data.mjs';

const uri = process.env.SBO_SPACETIME_URI;
const databaseName = process.env.SBO_SPACETIME_DATABASE;
const ownerToken = process.env.SBO_OWNER_TOKEN;
if (!uri || !databaseName || !ownerToken) {
  throw new Error('Seed requires SBO_SPACETIME_URI, SBO_SPACETIME_DATABASE, and SBO_OWNER_TOKEN');
}

const { DbConnection, tables } = await import(
  '../client/src/module_bindings/index.ts'
);

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function connect() {
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(databaseName)
      .withToken(ownerToken)
      .onConnect((connection) => resolve(connection))
      .onConnectError((_context, error) => reject(error))
      .build();
  });
}

async function waitFor(read, expected, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = read();
    if (expected(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function currentIndividualPage(pageTitle, expectedRevision) {
  const endpoint =
    'https://swordbloxonlinerebirth.fandom.com/api.php?action=query&' +
    'prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&' +
    `format=json&formatversion=2&titles=${encodeURIComponent(pageTitle)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`${pageTitle} verification failed (${response.status})`);
  const body = await response.json();
  const revision = body?.query?.pages?.[0]?.revisions?.[0];
  if (String(revision?.revid) !== expectedRevision) {
    throw new Error(
      `${pageTitle} changed from reviewed revision ${expectedRevision} to ${revision?.revid}`,
    );
  }
  return revision;
}

const connection = await connect();
let subscription;
try {
  subscription = await new Promise((resolve, reject) => {
    const handle = connection
      .subscriptionBuilder()
      .onApplied(() => resolve(handle))
      .onError((_context, error) => reject(error))
      .subscribe([
        tables.datasetRelease,
        tables.myCuratorAccess,
        tables.myWikiCandidates,
        tables.myReleaseDrafts,
        tables.equipment,
        tables.formula,
        tables.sourceReference,
      ]);
  });
  await connection.reducers.configureAuth({
    mode: 'development',
    issuer: '',
    audience: '',
  });

  const pageTitles = [
    'Stats',
    'One-Handed',
    'Two-Handed',
    'Rapier',
    'Dagger',
    'Melee',
    'Armor',
    'Shields',
  ];
  const candidateIds = new Map();
  for (const pageTitle of pageTitles) {
    const candidateId = await connection.procedures.fetchWikiCandidate({
      pageTitle,
    });
    const expected = `${slug(pageTitle)}:${sourceRevisions[pageTitle]}`;
    if (candidateId !== expected) {
      throw new Error(
        `${pageTitle} changed: expected ${expected}, received ${candidateId}`,
      );
    }
    candidateIds.set(pageTitle, candidateId);
  }
  await waitFor(
    () => [...connection.db.myWikiCandidates.iter()].length,
    (count) => count === pageTitles.length,
    'wiki candidates',
  );
  for (const [pageTitle, candidateId] of candidateIds) {
    await connection.reducers.recordReviewDecision({
      id: `${firstReleaseSnapshot.version}:review:${slug(pageTitle)}`,
      candidateId,
      decision: 'accept',
      note: `Reviewed canonical ${pageTitle} revision ${sourceRevisions[pageTitle]} for the first release.`,
    });
  }
  const fistsRevision = await currentIndividualPage(
    'Fists',
    sourceRevisions.Fists,
  );
  const candidates = () => [...connection.db.myWikiCandidates.iter()];
  await waitFor(
    () => candidates().every((candidate) => candidate.status === 'accepted'),
    Boolean,
    'accepted candidate state',
  );

  await connection.reducers.createReleaseDraft({
    version: firstReleaseSnapshot.version,
    formulaSetVersion: firstReleaseSnapshot.formulaSetVersion,
    sourceSummary: firstReleaseSnapshot.sourceSummary,
    lastReviewedAt: firstReleaseSnapshot.lastReviewedAt,
  });

  function candidateFor(pageTitle) {
    return candidateIds.get(pageTitle);
  }
  function capturedAtFor(pageTitle) {
    if (pageTitle === 'Fists') return fistsRevision.timestamp;
    const candidate = candidates().find(
      (row) => row.id === candidateFor(pageTitle),
    );
    if (!candidate) throw new Error(`Missing candidate for ${pageTitle}`);
    return candidate.revisionTimestamp;
  }

  for (const item of firstReleaseSnapshot.equipment) {
    const sourceId = `${firstReleaseSnapshot.version}:source:equipment:${item.id}`;
    await connection.reducers.upsertDraftSourceReference({
      id: sourceId,
      releaseVersion: firstReleaseSnapshot.version,
      entityKind: 'equipment',
      entityId: item.id,
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
      capturedAt: capturedAtFor(item.sourcePage),
      lastReviewedAt: item.lastReviewedAt,
      candidateId: candidateFor(item.sourcePage),
    });
    await connection.reducers.upsertDraftEquipment({
      id: `${firstReleaseSnapshot.version}:equipment:${item.id}`,
      releaseVersion: firstReleaseSnapshot.version,
      itemId: item.id,
      name: item.name,
      slot: item.slot,
      weaponPaths: item.weaponPaths.join(','),
      attack: item.attack,
      defense: item.defense,
      dexterity: item.dexterity,
      levelRequirement: item.levelRequirement,
      skillRequirement: item.skillRequirement,
      floor: item.floor,
      acquisitionType: item.acquisitionType,
      acquisitionDetail: item.acquisitionDetail,
      availability: item.availability,
      sourceRefId: sourceId,
      lastReviewedAt: item.lastReviewedAt,
      candidateId: candidateFor(item.sourcePage),
    });
  }

  for (const formula of firstReleaseSnapshot.formulas) {
    const sourceId = `${firstReleaseSnapshot.version}:source:formula:${formula.id}`;
    await connection.reducers.upsertDraftSourceReference({
      id: sourceId,
      releaseVersion: firstReleaseSnapshot.version,
      entityKind: 'formula',
      entityId: formula.id,
      sourceUrl: formula.sourceUrl,
      sourceRevision: formula.sourceRevision,
      capturedAt:
        formula.id === 'points-per-level'
          ? firstReleaseSnapshot.publishedAt
          : capturedAtFor('Stats'),
      lastReviewedAt: formula.lastReviewedAt,
      candidateId: candidateFor('Stats'),
    });
    await connection.reducers.upsertDraftFormula({
      id: `${firstReleaseSnapshot.version}:formula:${formula.id}`,
      releaseVersion: firstReleaseSnapshot.version,
      formulaId: formula.id,
      expression: formula.expression,
      units: formula.units,
      applicability: formula.applicability,
      boundaryBehavior: formula.boundaryBehavior,
      sourceRefId: sourceId,
      lastReviewedAt: formula.lastReviewedAt,
      candidateId: candidateFor('Stats'),
    });
  }

  for (const gap of firstReleaseSnapshot.knownGaps) {
    const entityId = `gap:${gap.path}:${gap.band}`;
    await connection.reducers.upsertDraftSourceReference({
      id: `${firstReleaseSnapshot.version}:source:${entityId}`,
      releaseVersion: firstReleaseSnapshot.version,
      entityKind: 'gap',
      entityId,
      sourceUrl: gap.sourceUrl,
      sourceRevision: gap.sourceRevision,
      capturedAt: capturedAtFor(gap.sourcePage),
      lastReviewedAt: gap.lastReviewedAt,
      candidateId: candidateFor(gap.sourcePage),
    });
  }

  await connection.reducers.publishRelease({
    version: firstReleaseSnapshot.version,
  });
  await waitFor(
    () =>
      [...connection.db.datasetRelease.iter()].find(
        (release) => release.version === firstReleaseSnapshot.version,
      )?.isCurrent,
    (current) => current === true,
    'published first release',
  );
  process.stdout.write(`Published local release ${firstReleaseSnapshot.version}\n`);
} finally {
  subscription?.unsubscribe();
  connection.disconnect();
}
