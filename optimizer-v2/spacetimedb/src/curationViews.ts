import { t, type ViewCtx } from 'spacetimedb/server';
import spacetimedb, {
  draftEquipment,
  draftFormula,
  draftSourceReference,
  releaseDraft,
  reviewDecision,
  wikiCandidate,
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
