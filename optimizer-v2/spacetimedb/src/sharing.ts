import { SenderError, t } from 'spacetimedb/server';
import { assertAppUser } from './auth';
import spacetimedb from './schema';

const shareIdPattern = /^[a-zA-Z0-9_-]{22,64}$/;

export const createBuildShare = spacetimedb.reducer(
  { buildId: t.string(), shareId: t.string() },
  (ctx, { buildId, shareId }) => {
    assertAppUser(ctx);
    if (!shareIdPattern.test(shareId)) {
      throw new SenderError('Share ID is invalid');
    }
    if (ctx.db.buildShareOwner.shareId.find(shareId)) {
      throw new SenderError('Share ID already exists');
    }

    const build = ctx.db.build.id.find(buildId);
    if (!build || !build.owner.equals(ctx.sender)) {
      throw new SenderError('Build not found for this identity');
    }
    if (
      build.name.length < 1 ||
      build.name.length > 60 ||
      /[\u0000-\u001f\u007f]/.test(build.name)
    ) {
      throw new SenderError('Build name is invalid');
    }
    const revision = ctx.db.buildRevision.id.find(build.headRevisionId);
    if (
      !revision ||
      revision.buildId !== build.id ||
      !revision.owner.equals(ctx.sender)
    ) {
      throw new SenderError('Build head is invalid');
    }

    const equipment = Array.from(
      ctx.db.revisionEquipment.revisionEquipmentRevisionId.filter(revision.id),
    );
    const ownedItems = Array.from(
      ctx.db.revisionOwnedItem.revisionOwnedItemRevisionId.filter(revision.id),
    );

    ctx.db.buildShareOwner.insert({
      shareId,
      owner: ctx.sender,
      buildId,
      createdAt: ctx.timestamp,
    });
    ctx.db.sharedBuild.insert({
      shareId,
      name: build.name,
      schemaVersion: revision.schemaVersion,
      level: revision.level,
      maxFloor: revision.maxFloor,
      weaponPath: revision.weaponPath,
      goal: revision.goal,
      weaponSkill: revision.weaponSkill,
      str: revision.str,
      def: revision.def,
      agi: revision.agi,
      vit: revision.vit,
      luk: revision.luk,
      datasetVersion: revision.datasetVersion,
      createdAt: ctx.timestamp,
    });
    equipment.forEach((row, index) => {
      ctx.db.sharedBuildEquipment.insert({
        id: `${shareId}:equipment:${index}`,
        shareId,
        slot: row.slot,
        itemId: row.itemId,
      });
    });
    ownedItems.forEach((row, index) => {
      ctx.db.sharedBuildOwnedItem.insert({
        id: `${shareId}:owned:${index}`,
        shareId,
        itemId: row.itemId,
      });
    });
  },
);

export const revokeBuildShare = spacetimedb.reducer(
  { shareId: t.string() },
  (ctx, { shareId }) => {
    assertAppUser(ctx);
    const ownership = ctx.db.buildShareOwner.shareId.find(shareId);
    if (!ownership || !ownership.owner.equals(ctx.sender)) {
      throw new SenderError('Share not found for this identity');
    }
    ctx.db.sharedBuildEquipment.sharedBuildEquipmentShareId.delete(shareId);
    ctx.db.sharedBuildOwnedItem.sharedBuildOwnedItemShareId.delete(shareId);
    ctx.db.sharedBuild.shareId.delete(shareId);
    ctx.db.buildShareOwner.shareId.delete(shareId);
  },
);
