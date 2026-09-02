import spacetimedb from './schema';

export { default } from './schema';
export {
  completeGuestImport,
  configureAuth,
  deleteBuild,
  deletePlanProgress,
  renameBuild,
  restoreBuildRevision,
  saveBuildRevision,
  setBuildArchived,
  upsertPlanProgress,
  upsertUserInventory,
  upsertUserPreferences,
} from './playerReducers';
export {
  myBuildRevisions,
  myBuilds,
  myPlanProgress,
  myProfile,
  myRevisionEquipment,
  myRevisionOwnedItems,
  myUserPreferences,
  myUserInventory,
} from './playerViews';
export { createBuildShare, revokeBuildShare } from './sharing';
export {
  createReleaseDraft,
  createReleaseDraftFromCurrent,
  grantCurator,
  publishCatalogRelease,
  publishRelease,
  recordReviewDecision,
  removeDraftEquipment,
  revokeCurator,
  upsertDraftEquipment,
  upsertDraftCatalogEquipment,
  upsertDraftEquipmentAcquisition,
  upsertDraftEquipmentAlias,
  upsertDraftEquipmentResistance,
  upsertDraftEquipmentSpecialEffect,
  upsertDraftFormula,
  upsertDraftMechanic,
  upsertDraftSourceReference,
  upsertDraftStrategyPolicy,
  upsertCoverageManifest,
  upsertWikiPageSnapshot,
} from './curationReducers';
export {
  myCoverageManifests,
  myCuratorAccess,
  myDraftCatalogEquipment,
  myDraftEquipmentAcquisitions,
  myDraftEquipmentAliases,
  myDraftEquipmentResistances,
  myDraftEquipmentSpecialEffects,
  myDraftEquipment,
  myDraftFormulas,
  myDraftMechanics,
  myDraftSourceReferences,
  myDraftStrategyPolicies,
  myReleaseDrafts,
  myReviewDecisions,
  myWikiCandidates,
  myWikiPageSnapshots,
} from './curationViews';
export {
  fetchScheduledWikiCandidate,
  fetchWikiCandidate,
  stageWikiFixtureForLocalTest,
} from './wikiProcedures';

export const init = spacetimedb.init((ctx) => {
  ctx.db.appConfig.insert({ ownerIdentity: ctx.sender });
  ctx.db.authConfig.insert({
    key: 'primary',
    mode: 'locked',
    issuer: '',
    audience: '',
  });
  ctx.db.datasetRelease.insert({
    id: 0n,
    version: 'bootstrap-0',
    formulaSetVersion: 'sbor-stats-v1',
    publishedAt: ctx.timestamp,
    lastReviewedAt: '2026-08-29',
    sourceSummary: 'Empty bootstrap release for connection verification',
    isCurrent: true,
  });
});
