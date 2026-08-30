import { SenderError, t } from 'spacetimedb/server';
import { assertOwner, type AppReducerCtx } from './auth';
import { assertCurator } from './curationAuth';
import {
  OPTIMIZER_WEAPON_PATHS,
  REQUIRED_FORMULA_IDS,
  validateReleaseDraft,
} from './releaseValidation';
import { validateCatalogRelease } from './catalogReleaseValidation';
import spacetimedb from './schema';

const controlCharacters = /[\u0000-\u001f\u007f]/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const releasePattern = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const canonicalSourcePattern =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
const officialGameUrl =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';
const ownerAttestationPattern = /^owner-gameplay-attestation:\d{4}-\d{2}-\d{2}$/;
const slots = new Set([
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
]);
const acquisitionTypes = new Set([
  'starter',
  'shop',
  'mob-drop',
  'boss-drop',
  'crafting',
  'quest',
  'event',
  'badge',
  'gamepass',
]);
const availabilityValues = new Set([
  'always',
  'active-event',
  'inactive-event',
]);
const catalogVerificationValues = new Set([
  'verified',
  'partial',
  'conflicting',
  'unknown',
  'legacy',
]);
const catalogAvailabilityValues = new Set([
  'always',
  'active-event',
  'inactive-event',
  'rotating',
  'limited',
  'gamepass',
  'badge',
  'legacy',
  'unobtainable',
  'unknown',
]);
const catalogAccessValues = new Set([
  'free',
  'event',
  'gamepass',
  'badge',
  'limited',
  'owned-only',
]);

function assertText(value: string, label: string, maxLength: number): void {
  if (
    value.trim().length === 0 ||
    value.length > maxLength ||
    controlCharacters.test(value)
  ) {
    throw new SenderError(`${label} is invalid`);
  }
}

function assertDate(value: string, label: string): void {
  if (!datePattern.test(value)) throw new SenderError(`${label} is invalid`);
}

function editableDraft(ctx: AppReducerCtx, version: string) {
  const draft = ctx.db.releaseDraft.version.find(version);
  if (!draft) throw new SenderError('Release draft not found');
  if (draft.status === 'published') {
    throw new SenderError('Published releases are immutable');
  }
  return draft;
}

function touchDraft(ctx: AppReducerCtx, version: string): void {
  const draft = editableDraft(ctx, version);
  ctx.db.releaseDraft.version.update({ ...draft, updatedAt: ctx.timestamp });
}

function parseWeaponPaths(value: string): string[] {
  const paths = value
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  if (
    new Set(paths).size !== paths.length ||
    paths.some(
      (path) =>
        !OPTIMIZER_WEAPON_PATHS.includes(
          path as (typeof OPTIMIZER_WEAPON_PATHS)[number],
        ),
    )
  ) {
    throw new SenderError('Weapon paths are invalid');
  }
  return paths;
}

type PublishedSourceRow = {
  id: string;
  releaseVersion: string;
  entityKind: string;
  entityId: string;
  sourceUrl: string;
  sourceRevision: string;
  capturedAt: string;
  lastReviewedAt: string;
  candidateId?: string;
};

function sourcePageTitle(sourceUrl: string): string | undefined {
  const prefix = 'https://swordbloxonlinerebirth.fandom.com/wiki/';
  if (!sourceUrl.startsWith(prefix)) return undefined;
  try {
    return decodeURIComponent(sourceUrl.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function candidateIdForPage(pageTitle: string, revisionId: string): string {
  return `${pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${revisionId}`;
}

function acceptedCandidateForPublishedSource(
  ctx: AppReducerCtx,
  source: PublishedSourceRow,
): string {
  if (source.candidateId) {
    const storedCandidate = ctx.db.wikiCandidate.id.find(source.candidateId);
    if (storedCandidate?.status === 'accepted') return storedCandidate.id;
    throw new SenderError(
      `Published source ${source.id} no longer has its accepted candidate`,
    );
  }

  const isLegacyOwnerAttestation =
    source.entityKind === 'formula' &&
    source.entityId === 'points-per-level' &&
    source.sourceUrl === officialGameUrl &&
    ownerAttestationPattern.test(source.sourceRevision);
  if (isLegacyOwnerAttestation) {
    const statsCandidates = Array.from(ctx.db.wikiCandidate.iter())
      .filter(
        (candidate) =>
          candidate.pageTitle === 'Stats' && candidate.status === 'accepted',
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    const candidate = statsCandidates[statsCandidates.length - 1];
    if (candidate) return candidate.id;
    throw new SenderError(
      'Stage and accept the Stats candidate before carrying forward the owner attestation',
    );
  }

  const pageTitle = sourcePageTitle(source.sourceUrl);
  if (!pageTitle) {
    throw new SenderError(`Published source ${source.id} is not canonical`);
  }
  const candidateId = candidateIdForPage(pageTitle, source.sourceRevision);
  const candidate = ctx.db.wikiCandidate.id.find(candidateId);
  if (
    !candidate ||
    candidate.status !== 'accepted' ||
    candidate.pageTitle !== pageTitle ||
    candidate.revisionId !== source.sourceRevision
  ) {
    throw new SenderError(
      `Stage and accept ${pageTitle} revision ${source.sourceRevision} before carrying it forward`,
    );
  }
  return candidate.id;
}

export const grantCurator = spacetimedb.reducer(
  { identity: t.identity() },
  (ctx, { identity }) => {
    assertOwner(ctx);
    if (ctx.db.appConfig.ownerIdentity.find(identity)) {
      throw new SenderError('The owner already has curator access');
    }
    if (ctx.db.curatorRole.identity.find(identity)) {
      throw new SenderError('Curator role already exists');
    }
    ctx.db.curatorRole.insert({
      identity,
      grantedBy: ctx.sender,
      grantedAt: ctx.timestamp,
    });
  },
);

export const revokeCurator = spacetimedb.reducer(
  { identity: t.identity() },
  (ctx, { identity }) => {
    assertOwner(ctx);
    if (!ctx.db.curatorRole.identity.delete(identity)) {
      throw new SenderError('Curator role not found');
    }
  },
);

export const createReleaseDraft = spacetimedb.reducer(
  {
    version: t.string(),
    formulaSetVersion: t.string(),
    sourceSummary: t.string(),
    lastReviewedAt: t.string(),
  },
  (ctx, args) => {
    assertCurator(ctx);
    if (!releasePattern.test(args.version)) {
      throw new SenderError('Release version is invalid');
    }
    if (args.formulaSetVersion !== 'sbor-stats-v1') {
      throw new SenderError('Formula set version is unsupported');
    }
    assertText(args.sourceSummary, 'Source summary', 500);
    assertDate(args.lastReviewedAt, 'Last reviewed date');
    if (ctx.db.releaseDraft.version.find(args.version)) {
      throw new SenderError('Release draft already exists');
    }
    if (ctx.db.datasetRelease.version.find(args.version)) {
      throw new SenderError('Release version is already published');
    }
    ctx.db.releaseDraft.insert({
      ...args,
      createdBy: ctx.sender,
      status: 'draft',
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
    });
  },
);

export const createReleaseDraftFromCurrent = spacetimedb.reducer(
  {
    version: t.string(),
    sourceSummary: t.string(),
    lastReviewedAt: t.string(),
  },
  (ctx, args) => {
    assertCurator(ctx);
    if (!releasePattern.test(args.version)) {
      throw new SenderError('Release version is invalid');
    }
    assertText(args.sourceSummary, 'Source summary', 500);
    assertDate(args.lastReviewedAt, 'Last reviewed date');
    if (
      ctx.db.releaseDraft.version.find(args.version) ||
      ctx.db.datasetRelease.version.find(args.version)
    ) {
      throw new SenderError('Release version already exists');
    }

    const currentReleases = Array.from(ctx.db.datasetRelease.iter()).filter(
      (release) => release.isCurrent,
    );
    if (currentReleases.length !== 1) {
      throw new SenderError('Exactly one current release is required');
    }
    const current = currentReleases[0]!;
    const equipmentRows = Array.from(
      ctx.db.equipment.equipmentReleaseVersion.filter(current.version),
    );
    const formulaRows = Array.from(
      ctx.db.formula.formulaReleaseVersion.filter(current.version),
    );
    const sourceRows = Array.from(
      ctx.db.sourceReference.sourceReferenceReleaseVersion.filter(
        current.version,
      ),
    );
    if (
      equipmentRows.length === 0 ||
      formulaRows.length === 0 ||
      sourceRows.length === 0
    ) {
      throw new SenderError('The current release has no curated data to carry forward');
    }

    const candidateIds = new Map<string, string>();
    const draftSourceIds = new Map<string, string>();
    for (const source of sourceRows) {
      candidateIds.set(
        source.id,
        acceptedCandidateForPublishedSource(ctx, source),
      );
      draftSourceIds.set(
        source.id,
        `${args.version}:source:${source.entityKind}:${source.entityId}`,
      );
    }

    ctx.db.releaseDraft.insert({
      version: args.version,
      createdBy: ctx.sender,
      formulaSetVersion: current.formulaSetVersion,
      sourceSummary: args.sourceSummary,
      lastReviewedAt: args.lastReviewedAt,
      status: 'draft',
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
    });
    for (const source of sourceRows) {
      ctx.db.draftSourceReference.insert({
        id: draftSourceIds.get(source.id)!,
        releaseVersion: args.version,
        entityKind: source.entityKind,
        entityId: source.entityId,
        sourceUrl: source.sourceUrl,
        sourceRevision: source.sourceRevision,
        capturedAt: source.capturedAt,
        lastReviewedAt: source.lastReviewedAt,
        candidateId: candidateIds.get(source.id)!,
      });
    }
    for (const row of equipmentRows) {
      const sourceRefId = draftSourceIds.get(row.sourceRefId);
      const candidateId = candidateIds.get(row.sourceRefId);
      if (!sourceRefId || !candidateId) {
        throw new SenderError(`Equipment ${row.itemId} has no published source`);
      }
      ctx.db.draftEquipment.insert({
        id: `${args.version}:equipment:${row.itemId}`,
        releaseVersion: args.version,
        itemId: row.itemId,
        name: row.name,
        slot: row.slot,
        weaponPaths: row.weaponPaths,
        attack: row.attack,
        defense: row.defense,
        dexterity: row.dexterity,
        levelRequirement: row.levelRequirement,
        skillRequirement: row.skillRequirement,
        floor: row.floor,
        acquisitionType: row.acquisitionType,
        acquisitionDetail: row.acquisitionDetail,
        availability: row.availability,
        sourceRefId,
        lastReviewedAt: row.lastReviewedAt,
        candidateId,
      });
    }
    for (const row of formulaRows) {
      const sourceRefId = draftSourceIds.get(row.sourceRefId);
      const candidateId = candidateIds.get(row.sourceRefId);
      if (!sourceRefId || !candidateId) {
        throw new SenderError(`Formula ${row.formulaId} has no published source`);
      }
      ctx.db.draftFormula.insert({
        id: `${args.version}:formula:${row.formulaId}`,
        releaseVersion: args.version,
        formulaId: row.formulaId,
        expression: row.expression,
        units: row.units,
        applicability: row.applicability,
        boundaryBehavior: row.boundaryBehavior,
        sourceRefId,
        lastReviewedAt: row.lastReviewedAt,
        candidateId,
      });
    }
  },
);

export const upsertDraftEquipment = spacetimedb.reducer(
  {
    id: t.string(),
    releaseVersion: t.string(),
    itemId: t.string(),
    name: t.string(),
    slot: t.string(),
    weaponPaths: t.string(),
    attack: t.f64(),
    defense: t.f64(),
    dexterity: t.f64(),
    levelRequirement: t.u32(),
    skillRequirement: t.u32().optional(),
    floor: t.u32(),
    acquisitionType: t.string(),
    acquisitionDetail: t.string(),
    availability: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    editableDraft(ctx, row.releaseVersion);
    for (const [value, label, max] of [
      [row.id, 'Draft equipment ID', 180],
      [row.itemId, 'Item ID', 100],
      [row.name, 'Item name', 100],
      [row.acquisitionDetail, 'Acquisition detail', 500],
      [row.sourceRefId, 'Source reference ID', 180],
      [row.candidateId, 'Candidate ID', 180],
    ] as const) {
      assertText(value, label, max);
    }
    if (!slots.has(row.slot)) throw new SenderError('Equipment slot is invalid');
    const paths = parseWeaponPaths(row.weaponPaths);
    if (
      (row.slot === 'main-hand' || row.slot === 'off-hand') &&
      paths.length === 0
    ) {
      throw new SenderError('Weapon equipment requires a compatible path');
    }
    if (
      row.attack < 0 ||
      row.defense < 0 ||
      row.dexterity < 0 ||
      row.levelRequirement < 1 ||
      row.floor < 1 ||
      row.floor > 19
    ) {
      throw new SenderError('Equipment numeric value is invalid');
    }
    if (!acquisitionTypes.has(row.acquisitionType)) {
      throw new SenderError('Acquisition type is invalid');
    }
    if (!availabilityValues.has(row.availability)) {
      throw new SenderError('Availability is invalid');
    }
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    const current = ctx.db.draftEquipment.id.find(row.id);
    if (current && current.releaseVersion !== row.releaseVersion) {
      throw new SenderError('Draft equipment ID belongs to another release');
    }
    const storedRow = {
      ...row,
      skillRequirement: row.skillRequirement,
    };
    if (current) ctx.db.draftEquipment.id.update(storedRow);
    else ctx.db.draftEquipment.insert(storedRow);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const removeDraftEquipment = spacetimedb.reducer(
  { id: t.string() },
  (ctx, { id }) => {
    assertCurator(ctx);
    const current = ctx.db.draftEquipment.id.find(id);
    if (!current) throw new SenderError('Draft equipment not found');
    editableDraft(ctx, current.releaseVersion);
    ctx.db.draftEquipment.id.delete(id);
    touchDraft(ctx, current.releaseVersion);
  },
);

export const upsertDraftFormula = spacetimedb.reducer(
  {
    id: t.string(),
    releaseVersion: t.string(),
    formulaId: t.string(),
    expression: t.string(),
    units: t.string(),
    applicability: t.string(),
    boundaryBehavior: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    editableDraft(ctx, row.releaseVersion);
    if (
      !REQUIRED_FORMULA_IDS.includes(
        row.formulaId as (typeof REQUIRED_FORMULA_IDS)[number],
      )
    ) {
      throw new SenderError('Formula ID is invalid');
    }
    for (const [value, label, max] of [
      [row.id, 'Draft formula ID', 180],
      [row.expression, 'Formula expression', 500],
      [row.units, 'Formula units', 100],
      [row.applicability, 'Formula applicability', 500],
      [row.boundaryBehavior, 'Formula boundary behavior', 500],
      [row.sourceRefId, 'Source reference ID', 180],
      [row.candidateId, 'Candidate ID', 180],
    ] as const) {
      assertText(value, label, max);
    }
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    const current = ctx.db.draftFormula.id.find(row.id);
    if (current && current.releaseVersion !== row.releaseVersion) {
      throw new SenderError('Draft formula ID belongs to another release');
    }
    if (current) ctx.db.draftFormula.id.update(row);
    else ctx.db.draftFormula.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftSourceReference = spacetimedb.reducer(
  {
    id: t.string(),
    releaseVersion: t.string(),
    entityKind: t.string(),
    entityId: t.string(),
    sourceUrl: t.string(),
    sourceRevision: t.string(),
    capturedAt: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    editableDraft(ctx, row.releaseVersion);
    for (const [value, label, max] of [
      [row.id, 'Draft source ID', 180],
      [row.entityId, 'Source entity ID', 100],
      [row.sourceRevision, 'Source revision', 100],
      [row.capturedAt, 'Captured timestamp', 100],
      [row.candidateId, 'Candidate ID', 180],
    ] as const) {
      assertText(value, label, max);
    }
    if (![
      'equipment',
      'formula',
      'gap',
      'catalog-equipment',
      'mechanic',
    ].includes(row.entityKind)) {
      throw new SenderError('Source entity kind is invalid');
    }
    const isOwnerPointsAttestation =
      (row.entityKind === 'formula' || row.entityKind === 'mechanic') &&
      row.entityId === 'points-per-level' &&
      row.sourceUrl === officialGameUrl &&
      ownerAttestationPattern.test(row.sourceRevision);
    if (isOwnerPointsAttestation) {
      assertOwner(ctx);
    } else if (!canonicalSourcePattern.test(row.sourceUrl)) {
      throw new SenderError(
        'Source must use the canonical wiki or the owner gameplay attestation',
      );
    }
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    const current = ctx.db.draftSourceReference.id.find(row.id);
    if (current && current.releaseVersion !== row.releaseVersion) {
      throw new SenderError('Draft source ID belongs to another release');
    }
    if (current) ctx.db.draftSourceReference.id.update(row);
    else ctx.db.draftSourceReference.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const recordReviewDecision = spacetimedb.reducer(
  {
    id: t.string(),
    candidateId: t.string(),
    decision: t.string(),
    note: t.string(),
  },
  (ctx, args) => {
    assertCurator(ctx);
    assertText(args.id, 'Review ID', 180);
    if (!['accept', 'reject'].includes(args.decision)) {
      throw new SenderError('Review decision is invalid');
    }
    if (args.decision === 'reject' && args.note.trim().length === 0) {
      throw new SenderError('Rejected candidates require a note');
    }
    if (args.note.length > 1_000 || controlCharacters.test(args.note)) {
      throw new SenderError('Review note is invalid');
    }
    const candidate = ctx.db.wikiCandidate.id.find(args.candidateId);
    if (!candidate) throw new SenderError('Wiki candidate not found');
    if (candidate.status !== 'pending') {
      throw new SenderError('Wiki candidate was already reviewed');
    }
    ctx.db.reviewDecision.insert({
      ...args,
      curator: ctx.sender,
      createdAt: ctx.timestamp,
    });
    ctx.db.wikiCandidate.id.update({
      ...candidate,
      status: args.decision === 'accept' ? 'accepted' : 'rejected',
    });
  },
);

export const publishRelease = spacetimedb.reducer(
  { version: t.string() },
  (ctx, { version }) => {
    assertCurator(ctx);
    const draft = ctx.db.releaseDraft.version.find(version);
    if (!draft) throw new SenderError('Release draft not found');
    if (draft.status === 'published' || ctx.db.datasetRelease.version.find(version)) {
      throw new SenderError('Release version is already published');
    }

    const equipmentRows = Array.from(
      ctx.db.draftEquipment.draftEquipmentReleaseVersion.filter(version),
    );
    const formulaRows = Array.from(
      ctx.db.draftFormula.draftFormulaReleaseVersion.filter(version),
    );
    const sourceRows = Array.from(
      ctx.db.draftSourceReference.draftSourceReferenceReleaseVersion.filter(
        version,
      ),
    );
    const candidateIds = new Set([
      ...equipmentRows.map((row) => row.candidateId),
      ...formulaRows.map((row) => row.candidateId),
      ...sourceRows.map((row) => row.candidateId),
    ]);
    const candidates = [...candidateIds].flatMap((id) => {
      const candidate = ctx.db.wikiCandidate.id.find(id);
      return candidate
        ? [{
            id: candidate.id,
            pageTitle: candidate.pageTitle,
            sourceUrl: candidate.sourceUrl,
            revisionId: candidate.revisionId,
            status: candidate.status,
          }]
        : [];
    });

    const errors = validateReleaseDraft({
      version,
      formulaSetVersion: draft.formulaSetVersion,
      equipment: equipmentRows,
      formulas: formulaRows,
      sources: sourceRows,
      candidates,
    });
    const publicSourceIds = new Map<string, string>();
    const seenPublicSourceIds = new Set<string>();
    for (const source of sourceRows) {
      const publicId = `${version}:${source.entityId}`;
      if (seenPublicSourceIds.has(publicId)) {
        errors.push(`Duplicate public source reference ID: ${publicId}`);
      }
      seenPublicSourceIds.add(publicId);
      publicSourceIds.set(source.id, publicId);
    }
    if (errors.length > 0) throw new SenderError(errors.join('; '));

    for (const release of ctx.db.datasetRelease.iter()) {
      if (release.isCurrent) {
        ctx.db.datasetRelease.id.update({ ...release, isCurrent: false });
      }
    }
    for (const source of sourceRows) {
      ctx.db.sourceReference.insert({
        id: publicSourceIds.get(source.id)!,
        releaseVersion: version,
        entityKind: source.entityKind,
        entityId: source.entityId,
        sourceUrl: source.sourceUrl,
        sourceRevision: source.sourceRevision,
        capturedAt: source.capturedAt,
        lastReviewedAt: source.lastReviewedAt,
        candidateId: source.candidateId,
      });
    }
    for (const row of equipmentRows) {
      ctx.db.equipment.insert({
        id: `${version}:${row.itemId}`,
        releaseVersion: version,
        itemId: row.itemId,
        name: row.name,
        slot: row.slot,
        weaponPaths: row.weaponPaths,
        attack: row.attack,
        defense: row.defense,
        dexterity: row.dexterity,
        levelRequirement: row.levelRequirement,
        skillRequirement: row.skillRequirement,
        floor: row.floor,
        acquisitionType: row.acquisitionType,
        acquisitionDetail: row.acquisitionDetail,
        availability: row.availability,
        sourceRefId: publicSourceIds.get(row.sourceRefId)!,
        lastReviewedAt: row.lastReviewedAt,
      });
    }
    for (const row of formulaRows) {
      ctx.db.formula.insert({
        id: `${version}:${row.formulaId}`,
        releaseVersion: version,
        formulaId: row.formulaId,
        expression: row.expression,
        units: row.units,
        applicability: row.applicability,
        boundaryBehavior: row.boundaryBehavior,
        sourceRefId: publicSourceIds.get(row.sourceRefId)!,
        lastReviewedAt: row.lastReviewedAt,
      });
    }
    ctx.db.datasetRelease.insert({
      id: 0n,
      version,
      formulaSetVersion: draft.formulaSetVersion,
      publishedAt: ctx.timestamp,
      lastReviewedAt: draft.lastReviewedAt,
      sourceSummary: draft.sourceSummary,
      isCurrent: true,
    });
    ctx.db.releaseDraft.version.update({
      ...draft,
      status: 'published',
      updatedAt: ctx.timestamp,
    });
  },
);

export const upsertWikiPageSnapshot = spacetimedb.reducer(
  {
    id: t.string(),
    pageId: t.u64(),
    pageTitle: t.string(),
    sourceUrl: t.string(),
    revisionId: t.string(),
    revisionTimestamp: t.string(),
    contentHash: t.string(),
    redirectTarget: t.string().optional(),
    content: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    assertText(row.id, 'Wiki snapshot ID', 180);
    assertText(row.pageTitle, 'Wiki page title', 180);
    assertText(row.revisionId, 'Wiki revision ID', 100);
    assertText(row.contentHash, 'Wiki content hash', 180);
    if (!canonicalSourcePattern.test(row.sourceUrl)) {
      throw new SenderError('Wiki snapshot source is not canonical');
    }
    if (row.content.length === 0 || row.content.length > 2_000_000) {
      throw new SenderError('Wiki snapshot content is invalid');
    }
    const stored = { ...row, redirectTarget: row.redirectTarget, fetchedAt: ctx.timestamp };
    if (ctx.db.wikiPageSnapshot.id.find(row.id)) {
      ctx.db.wikiPageSnapshot.id.update(stored);
    } else {
      ctx.db.wikiPageSnapshot.insert(stored);
    }
  },
);

export const upsertCoverageManifest = spacetimedb.reducer(
  {
    releaseVersion: t.string(),
    discovered: t.u32(),
    fetched: t.u32(),
    parsed: t.u32(),
    normalized: t.u32(),
    verified: t.u32(),
    partial: t.u32(),
    conflicting: t.u32(),
    unknown: t.u32(),
    legacy: t.u32(),
    unresolvedJson: t.string(),
    manifestHash: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    editableDraft(ctx, row.releaseVersion);
    assertText(row.manifestHash, 'Manifest hash', 180);
    if (row.unresolvedJson.length === 0 || row.unresolvedJson.length > 1_000_000) {
      throw new SenderError('Coverage unresolved JSON is invalid');
    }
    const stored = { ...row, createdAt: ctx.timestamp };
    if (ctx.db.coverageManifest.releaseVersion.find(row.releaseVersion)) {
      ctx.db.coverageManifest.releaseVersion.update(stored);
    } else {
      ctx.db.coverageManifest.insert(stored);
    }
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftCatalogEquipment = spacetimedb.reducer(
  {
    id: t.string(),
    releaseVersion: t.string(),
    itemId: t.string(),
    name: t.string(),
    variantGroupId: t.string().optional(),
    slot: t.string(),
    weaponPaths: t.string(),
    attack: t.f64().optional(),
    defense: t.f64().optional(),
    dexterity: t.f64().optional(),
    levelRequirement: t.u32().optional(),
    skillRequirement: t.u32().optional(),
    verificationStatus: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx);
    editableDraft(ctx, row.releaseVersion);
    assertText(row.id, 'Draft catalog ID', 180);
    assertText(row.itemId, 'Catalog item ID', 100);
    assertText(row.name, 'Catalog item name', 180);
    if (!slots.has(row.slot)) throw new SenderError('Catalog slot is invalid');
    const paths = parseWeaponPaths(row.weaponPaths);
    if ((row.slot === 'main-hand' || row.slot === 'off-hand') && paths.length === 0) {
      throw new SenderError('Catalog weapon requires a compatible path');
    }
    if (!catalogVerificationValues.has(row.verificationStatus)) {
      throw new SenderError('Catalog verification status is invalid');
    }
    for (const value of [row.attack, row.defense, row.dexterity]) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new SenderError('Catalog numeric value is invalid');
      }
    }
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    const stored = {
      ...row,
      variantGroupId: row.variantGroupId,
      attack: row.attack,
      defense: row.defense,
      dexterity: row.dexterity,
      levelRequirement: row.levelRequirement,
      skillRequirement: row.skillRequirement,
    };
    if (ctx.db.draftCatalogEquipment.id.find(row.id)) {
      ctx.db.draftCatalogEquipment.id.update(stored);
    } else {
      ctx.db.draftCatalogEquipment.insert(stored);
    }
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftEquipmentAlias = spacetimedb.reducer(
  {
    id: t.string(), releaseVersion: t.string(), itemId: t.string(),
    alias: t.string(), sourceRefId: t.string(), candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    assertText(row.alias, 'Equipment alias', 180);
    if (ctx.db.draftEquipmentAlias.id.find(row.id)) ctx.db.draftEquipmentAlias.id.update(row);
    else ctx.db.draftEquipmentAlias.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftEquipmentAcquisition = spacetimedb.reducer(
  {
    id: t.string(), releaseVersion: t.string(), itemId: t.string(),
    acquisitionType: t.string(), detail: t.string(), floor: t.u32().optional(),
    cost: t.f64().optional(), currency: t.string().optional(),
    availability: t.string(), accessType: t.string(), sourceRefId: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    assertText(row.detail, 'Acquisition detail', 1_000);
    if (!acquisitionTypes.has(row.acquisitionType)) throw new SenderError('Acquisition type is invalid');
    if (!catalogAvailabilityValues.has(row.availability)) throw new SenderError('Catalog availability is invalid');
    if (!catalogAccessValues.has(row.accessType)) throw new SenderError('Catalog access type is invalid');
    if (row.cost !== undefined && (!Number.isFinite(row.cost) || row.cost < 0)) throw new SenderError('Acquisition cost is invalid');
    const stored = { ...row, floor: row.floor, cost: row.cost, currency: row.currency };
    if (ctx.db.draftEquipmentAcquisition.id.find(row.id)) ctx.db.draftEquipmentAcquisition.id.update(stored);
    else ctx.db.draftEquipmentAcquisition.insert(stored);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftEquipmentResistance = spacetimedb.reducer(
  {
    id: t.string(), releaseVersion: t.string(), itemId: t.string(), status: t.string(),
    percent: t.f64(), sourceRefId: t.string(), candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    assertText(row.status, 'Resistance status', 100);
    if (!Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100) throw new SenderError('Resistance percent is invalid');
    if (ctx.db.draftEquipmentResistance.id.find(row.id)) ctx.db.draftEquipmentResistance.id.update(row);
    else ctx.db.draftEquipmentResistance.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftEquipmentSpecialEffect = spacetimedb.reducer(
  {
    id: t.string(), releaseVersion: t.string(), itemId: t.string(),
    description: t.string(), sourceRefId: t.string(), candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    assertText(row.description, 'Special effect', 2_000);
    if (ctx.db.draftEquipmentSpecialEffect.id.find(row.id)) ctx.db.draftEquipmentSpecialEffect.id.update(row);
    else ctx.db.draftEquipmentSpecialEffect.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftMechanic = spacetimedb.reducer(
  {
    id: t.string(), releaseVersion: t.string(), mechanicId: t.string(),
    expression: t.string(), units: t.string(), applicability: t.string(),
    boundaryBehavior: t.string(), computability: t.string(), parametersJson: t.string(),
    verificationStatus: t.string(), sourceRefId: t.string(), lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    if (!['exact', 'descriptive', 'conflicting', 'unknown'].includes(row.computability)) throw new SenderError('Mechanic computability is invalid');
    if (!catalogVerificationValues.has(row.verificationStatus)) throw new SenderError('Mechanic verification status is invalid');
    if (row.parametersJson.length === 0 || row.parametersJson.length > 20_000) throw new SenderError('Mechanic parameters JSON is invalid');
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    if (ctx.db.draftMechanic.id.find(row.id)) ctx.db.draftMechanic.id.update(row);
    else ctx.db.draftMechanic.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const upsertDraftStrategyPolicy = spacetimedb.reducer(
  {
    releaseVersion: t.string(), policyVersion: t.string(), policyJson: t.string(),
    lastReviewedAt: t.string(),
  },
  (ctx, row) => {
    assertCurator(ctx); editableDraft(ctx, row.releaseVersion);
    if (row.policyVersion !== 'sbor-policy-v2' || row.policyJson.length === 0 || row.policyJson.length > 100_000) throw new SenderError('Strategy policy is invalid');
    assertDate(row.lastReviewedAt, 'Last reviewed date');
    if (ctx.db.draftStrategyPolicy.releaseVersion.find(row.releaseVersion)) ctx.db.draftStrategyPolicy.releaseVersion.update(row);
    else ctx.db.draftStrategyPolicy.insert(row);
    touchDraft(ctx, row.releaseVersion);
  },
);

export const publishCatalogRelease = spacetimedb.reducer(
  { version: t.string() },
  (ctx, { version }) => {
    assertCurator(ctx);
    const draft = ctx.db.releaseDraft.version.find(version);
    if (!draft) throw new SenderError('Release draft not found');
    if (draft.formulaSetVersion !== 'sbor-stats-v2') throw new SenderError('Catalog publication requires sbor-stats-v2');
    if (draft.status === 'published' || ctx.db.datasetRelease.version.find(version)) throw new SenderError('Release version is already published');

    const equipmentRows = Array.from(ctx.db.draftCatalogEquipment.draftCatalogEquipmentReleaseVersion.filter(version));
    const aliasRows = Array.from(ctx.db.draftEquipmentAlias.draftEquipmentAliasReleaseVersion.filter(version));
    const acquisitionRows = Array.from(ctx.db.draftEquipmentAcquisition.draftEquipmentAcquisitionReleaseVersion.filter(version));
    const resistanceRows = Array.from(ctx.db.draftEquipmentResistance.draftEquipmentResistanceReleaseVersion.filter(version));
    const effectRows = Array.from(ctx.db.draftEquipmentSpecialEffect.draftEquipmentSpecialEffectReleaseVersion.filter(version));
    const mechanicRows = Array.from(ctx.db.draftMechanic.draftMechanicReleaseVersion.filter(version));
    const sourceRows = Array.from(ctx.db.draftSourceReference.draftSourceReferenceReleaseVersion.filter(version));
    const manifest = ctx.db.coverageManifest.releaseVersion.find(version);
    const policy = ctx.db.draftStrategyPolicy.releaseVersion.find(version);
    if (!manifest) throw new SenderError('Coverage manifest is required');
    if (!policy) throw new SenderError('Strategy policy is required');
    const candidateIds = new Set([...equipmentRows, ...aliasRows, ...acquisitionRows, ...resistanceRows, ...effectRows, ...mechanicRows, ...sourceRows].map((row) => row.candidateId));
    const candidates = [...candidateIds].flatMap((id) => {
      const candidate = ctx.db.wikiCandidate.id.find(id);
      return candidate ? [{ id: candidate.id, pageTitle: candidate.pageTitle, sourceUrl: candidate.sourceUrl, revisionId: candidate.revisionId, status: candidate.status }] : [];
    });
    const errors = validateCatalogRelease({
      version,
      formulaSetVersion: draft.formulaSetVersion,
      manifest,
      policy,
      equipment: equipmentRows,
      aliases: aliasRows,
      acquisitions: acquisitionRows,
      resistances: resistanceRows,
      effects: effectRows,
      mechanics: mechanicRows,
      sources: sourceRows,
      candidates,
    });
    const publicSourceIds = new Map(sourceRows.map((source) => [source.id, `${version}:${source.entityKind}:${source.entityId}`]));
    if (new Set(publicSourceIds.values()).size !== sourceRows.length) errors.push('Duplicate public source reference ID');
    if (errors.length > 0) throw new SenderError(errors.join('; '));

    for (const release of ctx.db.datasetRelease.iter()) if (release.isCurrent) ctx.db.datasetRelease.id.update({ ...release, isCurrent: false });
    for (const source of sourceRows) ctx.db.sourceReference.insert({ ...source, id: publicSourceIds.get(source.id)!, candidateId: source.candidateId });
    for (const row of equipmentRows) ctx.db.catalogEquipment.insert({ ...row, id: `${version}:${row.itemId}`, sourceRefId: publicSourceIds.get(row.sourceRefId)!, candidateId: undefined } as never);
    for (const row of aliasRows) ctx.db.equipmentAlias.insert({ id: `${version}:alias:${row.id}`, releaseVersion: version, itemId: row.itemId, alias: row.alias, sourceRefId: publicSourceIds.get(row.sourceRefId)! });
    for (const row of acquisitionRows) ctx.db.equipmentAcquisition.insert({ id: `${version}:acquisition:${row.id}`, releaseVersion: version, itemId: row.itemId, acquisitionType: row.acquisitionType, detail: row.detail, floor: row.floor, cost: row.cost, currency: row.currency, availability: row.availability, accessType: row.accessType, sourceRefId: publicSourceIds.get(row.sourceRefId)! });
    for (const row of resistanceRows) ctx.db.equipmentResistance.insert({ id: `${version}:resistance:${row.id}`, releaseVersion: version, itemId: row.itemId, status: row.status, percent: row.percent, sourceRefId: publicSourceIds.get(row.sourceRefId)! });
    for (const row of effectRows) ctx.db.equipmentSpecialEffect.insert({ id: `${version}:effect:${row.id}`, releaseVersion: version, itemId: row.itemId, description: row.description, sourceRefId: publicSourceIds.get(row.sourceRefId)! });
    for (const row of mechanicRows) ctx.db.mechanic.insert({ id: `${version}:mechanic:${row.mechanicId}`, releaseVersion: version, mechanicId: row.mechanicId, expression: row.expression, units: row.units, applicability: row.applicability, boundaryBehavior: row.boundaryBehavior, computability: row.computability, parametersJson: row.parametersJson, verificationStatus: row.verificationStatus, sourceRefId: publicSourceIds.get(row.sourceRefId)!, lastReviewedAt: row.lastReviewedAt });
    ctx.db.releaseStrategyPolicy.insert({ releaseVersion: version, policyVersion: policy.policyVersion, policyJson: policy.policyJson, lastReviewedAt: policy.lastReviewedAt });
    ctx.db.datasetRelease.insert({ id: 0n, version, formulaSetVersion: draft.formulaSetVersion, publishedAt: ctx.timestamp, lastReviewedAt: draft.lastReviewedAt, sourceSummary: draft.sourceSummary, isCurrent: true });
    ctx.db.releaseDraft.version.update({ ...draft, status: 'published', updatedAt: ctx.timestamp });
  },
);
