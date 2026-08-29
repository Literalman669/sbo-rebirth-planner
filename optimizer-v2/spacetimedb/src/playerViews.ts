import { t } from 'spacetimedb/server';
import spacetimedb, {
  build,
  buildRevision,
  revisionEquipment,
  revisionOwnedItem,
  userProfile,
} from './schema';

export const myBuilds = spacetimedb.view(
  { name: 'my_builds', public: true },
  t.array(build.rowType),
  (ctx) => Array.from(ctx.db.build.buildOwner.filter(ctx.sender)),
);

export const myProfile = spacetimedb.view(
  { name: 'my_profile', public: true },
  t.array(userProfile.rowType),
  (ctx) => {
    const row = ctx.db.userProfile.identity.find(ctx.sender);
    return row ? [row] : [];
  },
);

export const myBuildRevisions = spacetimedb.view(
  { name: 'my_build_revisions', public: true },
  t.array(buildRevision.rowType),
  (ctx) =>
    Array.from(ctx.db.buildRevision.buildRevisionOwner.filter(ctx.sender)),
);

export const myRevisionEquipment = spacetimedb.view(
  { name: 'my_revision_equipment', public: true },
  t.array(revisionEquipment.rowType),
  (ctx) =>
    Array.from(
      ctx.db.revisionEquipment.revisionEquipmentOwner.filter(ctx.sender),
    ),
);

export const myRevisionOwnedItems = spacetimedb.view(
  { name: 'my_revision_owned_items', public: true },
  t.array(revisionOwnedItem.rowType),
  (ctx) =>
    Array.from(
      ctx.db.revisionOwnedItem.revisionOwnedItemOwner.filter(ctx.sender),
    ),
);
