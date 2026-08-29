import { schema, table, t } from 'spacetimedb/server';

export const appConfig = table(
  { name: 'app_config' },
  {
    ownerIdentity: t.identity().primaryKey(),
  },
);

export const datasetRelease = table(
  { name: 'dataset_release', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    version: t.string().unique(),
    formulaSetVersion: t.string(),
    publishedAt: t.timestamp(),
    lastReviewedAt: t.string(),
    sourceSummary: t.string(),
    isCurrent: t.bool(),
  },
);

const spacetimedb = schema({ appConfig, datasetRelease });

export type AppSchema = (typeof spacetimedb)['schemaType'];
export default spacetimedb;
