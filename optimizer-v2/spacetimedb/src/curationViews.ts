import { t, type ViewCtx } from 'spacetimedb/server';
import spacetimedb, {
  coverageManifest,
  draftCatalogEquipment,
  draftEquipmentAcquisition,
  draftEquipmentAlias,
  draftEquipmentResistance,
  draftEquipmentSpecialEffect,
  draftEquipment,
  draftFormula,
  draftMechanic,
  draftSourceReference,
  draftStrategyPolicy,
  releaseDraft,
  reviewDecision,
  wikiCandidate,
  wikiPageSnapshot,
  type AppSchema,
} from './schema';

const curatorAccessRow = t.object('CuratorAccess', {
  identity: t.identity(),
  access: t.string(),
});

export const myCuratorAccess = spacetimedb.view(
  { name: 'my_curator_access', public: true },
  t.array(curatorAccessRow),
  (ctx) => {
    if (ctx.db.appConfig.ownerIdentity.find(ctx.sender)) {
      return [{ identity: ctx.sender, access: 'owner' }];
    }
    if (ctx.db.curatorRole.identity.find(ctx.sender)) {
      return [{ identity: ctx.sender, access: 'curator' }];
    }
    return [];
  },
);

function canCurate(ctx: ViewCtx<AppSchema>): boolean {
  return Boolean(
    ctx.db.appConfig.ownerIdentity.find(ctx.sender) ||
      ctx.db.curatorRole.identity.find(ctx.sender),
  );
}

export const myWikiCandidates = spacetimedb.view(
  { name: 'my_wiki_candidates', public: true },
  t.array(wikiCandidate.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.wikiCandidate.iter()) : []),
);

export const myReviewDecisions = spacetimedb.view(
  { name: 'my_review_decisions', public: true },
  t.array(reviewDecision.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.reviewDecision.iter()) : []),
);

export const myReleaseDrafts = spacetimedb.view(
  { name: 'my_release_drafts', public: true },
  t.array(releaseDraft.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.releaseDraft.iter()) : []),
);

export const myDraftEquipment = spacetimedb.view(
  { name: 'my_draft_equipment', public: true },
  t.array(draftEquipment.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftEquipment.iter()) : []),
);

export const myDraftFormulas = spacetimedb.view(
  { name: 'my_draft_formulas', public: true },
  t.array(draftFormula.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftFormula.iter()) : []),
);

export const myDraftSourceReferences = spacetimedb.view(
  { name: 'my_draft_source_references', public: true },
  t.array(draftSourceReference.rowType),
  (ctx) =>
    canCurate(ctx) ? Array.from(ctx.db.draftSourceReference.iter()) : [],
);

export const myWikiPageSnapshots = spacetimedb.view(
  { name: 'my_wiki_page_snapshots', public: true },
  t.array(wikiPageSnapshot.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.wikiPageSnapshot.iter()) : []),
);

export const myCoverageManifests = spacetimedb.view(
  { name: 'my_coverage_manifests', public: true },
  t.array(coverageManifest.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.coverageManifest.iter()) : []),
);

export const myDraftCatalogEquipment = spacetimedb.view(
  { name: 'my_draft_catalog_equipment', public: true },
  t.array(draftCatalogEquipment.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftCatalogEquipment.iter()) : []),
);

export const myDraftEquipmentAliases = spacetimedb.view(
  { name: 'my_draft_equipment_aliases', public: true },
  t.array(draftEquipmentAlias.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftEquipmentAlias.iter()) : []),
);

export const myDraftEquipmentAcquisitions = spacetimedb.view(
  { name: 'my_draft_equipment_acquisitions', public: true },
  t.array(draftEquipmentAcquisition.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftEquipmentAcquisition.iter()) : []),
);

export const myDraftEquipmentResistances = spacetimedb.view(
  { name: 'my_draft_equipment_resistances', public: true },
  t.array(draftEquipmentResistance.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftEquipmentResistance.iter()) : []),
);

export const myDraftEquipmentSpecialEffects = spacetimedb.view(
  { name: 'my_draft_equipment_special_effects', public: true },
  t.array(draftEquipmentSpecialEffect.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftEquipmentSpecialEffect.iter()) : []),
);

export const myDraftMechanics = spacetimedb.view(
  { name: 'my_draft_mechanics', public: true },
  t.array(draftMechanic.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftMechanic.iter()) : []),
);

export const myDraftStrategyPolicies = spacetimedb.view(
  { name: 'my_draft_strategy_policies', public: true },
  t.array(draftStrategyPolicy.rowType),
  (ctx) => (canCurate(ctx) ? Array.from(ctx.db.draftStrategyPolicy.iter()) : []),
);
