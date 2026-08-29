import { SenderError, t } from 'spacetimedb/server';
import { assertOwner, type AppReducerCtx } from './auth';
import { assertCurator } from './curationAuth';
import {
  OPTIMIZER_WEAPON_PATHS,
  REQUIRED_FORMULA_IDS,
  validateReleaseDraft,
} from './releaseValidation';
import spacetimedb from './schema';

const controlCharacters = /[\u0000-\u001f\u007f]/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const releasePattern = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const canonicalSourcePattern =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
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
    if (!['equipment', 'formula', 'gap'].includes(row.entityKind)) {
      throw new SenderError('Source entity kind is invalid');
    }
    if (!canonicalSourcePattern.test(row.sourceUrl)) {
      throw new SenderError('Source URL must use the canonical wiki host');
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
      return candidate ? [{ id: candidate.id, status: candidate.status }] : [];
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
