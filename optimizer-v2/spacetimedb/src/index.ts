import spacetimedb from './schema';

export { default } from './schema';

export const init = spacetimedb.init((ctx) => {
  ctx.db.appConfig.insert({ ownerIdentity: ctx.sender });
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
