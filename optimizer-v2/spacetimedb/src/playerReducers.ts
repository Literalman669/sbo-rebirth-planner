import { SenderError, t } from 'spacetimedb/server';
import { assertAppUser, assertOwner, type AppReducerCtx } from './auth';
import spacetimedb from './schema';

const weaponPaths = new Set([
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
]);
const goals = new Set([
  'balanced',
  'damage',
  'survivability',
  'mobility',
  'farming',
]);
const equipmentSlots = new Set([
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
]);
const controlCharacters = /[\u0000-\u001f\u007f]/;

const cloudProfileInput = t.object('CloudProfileInput', {
  schemaVersion: t.u32(),
  level: t.u32(),
  maxFloor: t.u32(),
  weaponPath: t.string(),
  goal: t.string(),
  weaponSkill: t.u32().optional(),
  str: t.u32(),
  def: t.u32(),
  agi: t.u32(),
  vit: t.u32(),
  luk: t.u32(),
  datasetVersion: t.string(),
});

const equipmentInput = t.object('CloudEquipmentInput', {
  slot: t.string(),
  itemId: t.string(),
});

type CloudProfileInput = {
  schemaVersion: number;
  level: number;
  maxFloor: number;
  weaponPath: string;
  goal: string;
  weaponSkill?: number;
  str: number;
  def: number;
  agi: number;
  vit: number;
  luk: number;
  datasetVersion: string;
};

type CloudEquipmentInput = { slot: string; itemId: string };

function assertText(value: string, label: string, maxLength: number): void {
  if (
    value.length === 0 ||
    value.length > maxLength ||
    controlCharacters.test(value)
  ) {
    throw new SenderError(`${label} is invalid`);
  }
}

function assertProfile(profile: CloudProfileInput): void {
  if (profile.schemaVersion !== 2) {
    throw new SenderError('Unsupported profile schema version');
  }
  if (profile.level < 1 || profile.level > 10_000) {
    throw new SenderError('Level is out of range');
  }
  if (profile.maxFloor < 1 || profile.maxFloor > 19) {
    throw new SenderError('Floor is out of range');
  }
  if (!weaponPaths.has(profile.weaponPath)) {
    throw new SenderError('Weapon path is invalid');
  }
  if (!goals.has(profile.goal)) throw new SenderError('Goal is invalid');
  if (profile.weaponSkill !== undefined && profile.weaponSkill > 10_000) {
    throw new SenderError('Weapon skill is out of range');
  }
  for (const stat of [
    profile.str,
    profile.def,
    profile.agi,
    profile.vit,
    profile.luk,
  ]) {
    if (stat > 500) throw new SenderError('Stat is out of range');
  }
  assertText(profile.datasetVersion, 'Dataset version', 100);
}

function assertEquipment(equipment: readonly CloudEquipmentInput[]): void {
  if (equipment.length > 6) throw new SenderError('Too many equipment rows');
  const seenSlots = new Set<string>();
  for (const row of equipment) {
    if (!equipmentSlots.has(row.slot) || seenSlots.has(row.slot)) {
      throw new SenderError('Equipment slot is invalid or duplicated');
    }
    seenSlots.add(row.slot);
    assertText(row.itemId, 'Equipment item ID', 100);
  }
}

function assertOwnedItems(ownedItemIds: readonly string[]): void {
  if (ownedItemIds.length > 100) throw new SenderError('Too many owned items');
  const seen = new Set<string>();
  for (const itemId of ownedItemIds) {
    assertText(itemId, 'Owned item ID', 100);
    if (seen.has(itemId)) throw new SenderError('Owned item IDs must be unique');
    seen.add(itemId);
  }
}

function ensureProfile(ctx: AppReducerCtx): void {
  const current = ctx.db.userProfile.identity.find(ctx.sender);
  if (current) {
    ctx.db.userProfile.identity.update({ ...current, updatedAt: ctx.timestamp });
    return;
  }
  ctx.db.userProfile.insert({
    identity: ctx.sender,
    guestImportCompletedAt: undefined,
    createdAt: ctx.timestamp,
    updatedAt: ctx.timestamp,
  });
}

function assertOwnedBuild(ctx: AppReducerCtx, buildId: string) {
  const current = ctx.db.build.id.find(buildId);
  if (!current || !current.owner.equals(ctx.sender)) {
    throw new SenderError('Build not found for this identity');
  }
  return current;
}

function insertRevision(
  ctx: AppReducerCtx,
  args: {
    buildId: string;
    revisionId: string;
    parentRevisionId?: string;
    profile: CloudProfileInput;
    equipment: readonly CloudEquipmentInput[];
    ownedItemIds: readonly string[];
  },
): void {
  const { profile } = args;
  ctx.db.buildRevision.insert({
    id: args.revisionId,
    buildId: args.buildId,
    owner: ctx.sender,
    parentRevisionId: args.parentRevisionId,
    schemaVersion: profile.schemaVersion,
    level: profile.level,
    maxFloor: profile.maxFloor,
    weaponPath: profile.weaponPath,
    goal: profile.goal,
    weaponSkill: profile.weaponSkill,
    str: profile.str,
    def: profile.def,
    agi: profile.agi,
    vit: profile.vit,
    luk: profile.luk,
    datasetVersion: profile.datasetVersion,
    createdAt: ctx.timestamp,
  });

  args.equipment.forEach((row, index) => {
    ctx.db.revisionEquipment.insert({
      id: `${args.revisionId}:equipment:${index}`,
      revisionId: args.revisionId,
      owner: ctx.sender,
      slot: row.slot,
      itemId: row.itemId,
    });
  });
  args.ownedItemIds.forEach((itemId, index) => {
    ctx.db.revisionOwnedItem.insert({
      id: `${args.revisionId}:owned:${index}`,
      revisionId: args.revisionId,
      owner: ctx.sender,
      itemId,
    });
  });
}

function sameStringRows(
  stored: readonly string[],
  requested: readonly string[],
): boolean {
  if (stored.length !== requested.length) return false;
  const left = [...stored].sort();
  const right = [...requested].sort();
  return left.every((value, index) => value === right[index]);
}

function isIdempotentRevisionRetry(
  ctx: AppReducerCtx,
  args: {
    buildId: string;
    revisionId: string;
    parentRevisionId?: string;
    profile: CloudProfileInput;
    equipment: readonly CloudEquipmentInput[];
    ownedItemIds: readonly string[];
  },
): boolean {
  const revision = ctx.db.buildRevision.id.find(args.revisionId);
  if (
    !revision ||
    !revision.owner.equals(ctx.sender) ||
    revision.buildId !== args.buildId ||
    revision.parentRevisionId !== args.parentRevisionId
  ) {
    return false;
  }

  const profile = args.profile;
  if (
    revision.schemaVersion !== profile.schemaVersion ||
    revision.level !== profile.level ||
    revision.maxFloor !== profile.maxFloor ||
    revision.weaponPath !== profile.weaponPath ||
    revision.goal !== profile.goal ||
    revision.weaponSkill !== profile.weaponSkill ||
    revision.str !== profile.str ||
    revision.def !== profile.def ||
    revision.agi !== profile.agi ||
    revision.vit !== profile.vit ||
    revision.luk !== profile.luk ||
    revision.datasetVersion !== profile.datasetVersion
  ) {
    return false;
  }

  const storedEquipment = Array.from(
    ctx.db.revisionEquipment.revisionEquipmentRevisionId.filter(
      args.revisionId,
    ),
    (row) => `${row.slot}\u0000${row.itemId}`,
  );
  const requestedEquipment = args.equipment.map(
    (row) => `${row.slot}\u0000${row.itemId}`,
  );
  const storedOwnedItems = Array.from(
    ctx.db.revisionOwnedItem.revisionOwnedItemRevisionId.filter(
      args.revisionId,
    ),
    (row) => row.itemId,
  );
  return (
    sameStringRows(storedEquipment, requestedEquipment) &&
    sameStringRows(storedOwnedItems, args.ownedItemIds)
  );
}

export const configureAuth = spacetimedb.reducer(
  { mode: t.string(), issuer: t.string(), audience: t.string() },
  (ctx, { mode, issuer, audience }) => {
    assertOwner(ctx);
    if (!['locked', 'development', 'production'].includes(mode)) {
      throw new SenderError('Invalid auth mode');
    }
    if (
      mode === 'production' &&
      (issuer !== 'https://auth.spacetimedb.com/oidc' || audience.length < 10)
    ) {
      throw new SenderError(
        'Production auth requires the SpacetimeAuth issuer and audience',
      );
    }
    const current = ctx.db.authConfig.key.find('primary');
    if (!current) throw new SenderError('Auth configuration is missing');
    ctx.db.authConfig.key.update({ ...current, mode, issuer, audience });
  },
);

export const saveBuildRevision = spacetimedb.reducer(
  {
    buildId: t.string(),
    revisionId: t.string(),
    name: t.string(),
    parentRevisionId: t.string().optional(),
    profile: cloudProfileInput,
    equipment: t.array(equipmentInput),
    ownedItemIds: t.array(t.string()),
  },
  (ctx, args) => {
    assertAppUser(ctx);
    assertText(args.buildId, 'Build ID', 100);
    assertText(args.revisionId, 'Revision ID', 100);
    assertText(args.name.trim(), 'Build name', 60);
    if (args.parentRevisionId !== undefined) {
      assertText(args.parentRevisionId, 'Parent revision ID', 100);
    }
    assertProfile(args.profile);
    assertEquipment(args.equipment);
    assertOwnedItems(args.ownedItemIds);

    if (ctx.db.buildRevision.id.find(args.revisionId)) {
      if (isIdempotentRevisionRetry(ctx, args)) return;
      throw new SenderError('Revision ID already exists with different content');
    }

    const currentBuild = ctx.db.build.id.find(args.buildId);
    if (currentBuild && !currentBuild.owner.equals(ctx.sender)) {
      throw new SenderError('Build is owned by another identity');
    }
    if (!currentBuild && args.parentRevisionId !== undefined) {
      throw new SenderError('A new build cannot have a parent revision');
    }
    if (args.parentRevisionId !== undefined) {
      const parent = ctx.db.buildRevision.id.find(args.parentRevisionId);
      if (
        !parent ||
        parent.buildId !== args.buildId ||
        !parent.owner.equals(ctx.sender)
      ) {
        throw new SenderError('Parent revision is invalid');
      }
    }

    ensureProfile(ctx);
    insertRevision(ctx, args);

    if (currentBuild) {
      ctx.db.build.id.update({
        ...currentBuild,
        name: args.name.trim(),
        headRevisionId: args.revisionId,
        updatedAt: ctx.timestamp,
      });
    } else {
      ctx.db.build.insert({
        id: args.buildId,
        owner: ctx.sender,
        name: args.name.trim(),
        headRevisionId: args.revisionId,
        createdAt: ctx.timestamp,
        updatedAt: ctx.timestamp,
      });
    }
  },
);

export const completeGuestImport = spacetimedb.reducer({}, (ctx) => {
  assertAppUser(ctx);
  ensureProfile(ctx);
  const current = ctx.db.userProfile.identity.find(ctx.sender);
  if (!current) throw new SenderError('Profile creation failed');
  ctx.db.userProfile.identity.update({
    ...current,
    guestImportCompletedAt: ctx.timestamp,
    updatedAt: ctx.timestamp,
  });
});

export const restoreBuildRevision = spacetimedb.reducer(
  {
    buildId: t.string(),
    sourceRevisionId: t.string(),
    newRevisionId: t.string(),
  },
  (ctx, { buildId, sourceRevisionId, newRevisionId }) => {
    assertAppUser(ctx);
    assertText(buildId, 'Build ID', 100);
    assertText(sourceRevisionId, 'Source revision ID', 100);
    assertText(newRevisionId, 'New revision ID', 100);
    if (ctx.db.buildRevision.id.find(newRevisionId)) {
      throw new SenderError('Revision ID already exists');
    }

    const currentBuild = assertOwnedBuild(ctx, buildId);
    const source = ctx.db.buildRevision.id.find(sourceRevisionId);
    if (
      !source ||
      source.buildId !== buildId ||
      !source.owner.equals(ctx.sender)
    ) {
      throw new SenderError('Revision not found for this identity');
    }

    const equipment = Array.from(
      ctx.db.revisionEquipment.revisionEquipmentRevisionId.filter(
        sourceRevisionId,
      ),
      (row) => ({ slot: row.slot, itemId: row.itemId }),
    );
    const ownedItemIds = Array.from(
      ctx.db.revisionOwnedItem.revisionOwnedItemRevisionId.filter(
        sourceRevisionId,
      ),
      (row) => row.itemId,
    );

    insertRevision(ctx, {
      buildId,
      revisionId: newRevisionId,
      parentRevisionId: currentBuild.headRevisionId,
      profile: {
        schemaVersion: source.schemaVersion,
        level: source.level,
        maxFloor: source.maxFloor,
        weaponPath: source.weaponPath,
        goal: source.goal,
        weaponSkill: source.weaponSkill,
        str: source.str,
        def: source.def,
        agi: source.agi,
        vit: source.vit,
        luk: source.luk,
        datasetVersion: source.datasetVersion,
      },
      equipment,
      ownedItemIds,
    });
    ctx.db.build.id.update({
      ...currentBuild,
      headRevisionId: newRevisionId,
      updatedAt: ctx.timestamp,
    });
    ensureProfile(ctx);
  },
);

export const deleteBuild = spacetimedb.reducer(
  { buildId: t.string() },
  (ctx, { buildId }) => {
    assertAppUser(ctx);
    assertText(buildId, 'Build ID', 100);
    assertOwnedBuild(ctx, buildId);

    const revisions = Array.from(
      ctx.db.buildRevision.buildRevisionBuildId.filter(buildId),
    );
    for (const revision of revisions) {
      ctx.db.revisionEquipment.revisionEquipmentRevisionId.delete(revision.id);
      ctx.db.revisionOwnedItem.revisionOwnedItemRevisionId.delete(revision.id);
      ctx.db.buildRevision.id.delete(revision.id);
    }
    ctx.db.build.id.delete(buildId);
  },
);
