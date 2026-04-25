import { schema, table, t } from 'spacetimedb/server';

/** Allowed client-side localStorage keys mirrored to cloud (see app.js STORAGE_KEY constants). */
const ALLOWED_DOC_KEYS = new Set([
  'sbo-rebirth-planner.builds.v1',
  'sbo-rebirth-planner.floor-tracker.v1',
  'sbo-rebirth-planner.pinned-presets.v1',
  'sbo-rebirth-planner.preset-filter.v1',
  'sbo-rebirth-planner.form-draft.v1',
  'sbo-rebirth-planner.equipped.v1',
  'sbo-rebirth-planner.calibration.v1',
]);

const planner_doc = table(
  {
    name: 'planner_doc',
    indexes: [{ accessor: 'by_owner', algorithm: 'btree', columns: ['owner'] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity(),
    doc_key: t.string(),
    doc_json: t.string(),
    updated_at: t.timestamp(),
  },
);

const plannerDocRow = t.row('PlannerDocRow', {
  id: t.u64(),
  owner: t.identity(),
  doc_key: t.string(),
  doc_json: t.string(),
  updated_at: t.timestamp(),
});

const spacetimedb = schema({ planner_doc });
export default spacetimedb;

export const init = spacetimedb.init((_ctx) => {});

export const onConnect = spacetimedb.clientConnected((_ctx) => {});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {});

/** Caller-visible slice of their own KV rows (private table + public view pattern). */
export const my_planner_docs = spacetimedb.view(
  { name: 'my_planner_docs', public: true },
  t.array(plannerDocRow),
  (ctx) => {
    const rows = [...ctx.db.planner_doc.by_owner.filter(ctx.sender)];
    return rows.map((r) => ({
      id: r.id,
      owner: r.owner,
      doc_key: r.doc_key,
      doc_json: r.doc_json,
      updated_at: r.updated_at,
    }));
  },
);

function assertAllowedKey(key: string) {
  if (!ALLOWED_DOC_KEYS.has(key)) {
    throw new Error(`doc_key not allowed: ${key}`);
  }
}

export const upsert_planner_doc = spacetimedb.reducer(
  { doc_key: t.string(), doc_json: t.string() },
  (ctx, { doc_key, doc_json }) => {
    assertAllowedKey(doc_key);
    if (doc_json.length > 1_500_000) {
      throw new Error('doc_json too large');
    }
    for (const row of ctx.db.planner_doc.by_owner.filter(ctx.sender)) {
      if (row.doc_key === doc_key) {
        ctx.db.planner_doc.id.update({
          ...row,
          doc_json,
          updated_at: ctx.timestamp,
        });
        return;
      }
    }
    ctx.db.planner_doc.insert({
      id: 0n,
      owner: ctx.sender,
      doc_key,
      doc_json,
      updated_at: ctx.timestamp,
    });
  },
);

export const delete_planner_doc = spacetimedb.reducer({ doc_key: t.string() }, (ctx, { doc_key }) => {
  assertAllowedKey(doc_key);
  for (const row of ctx.db.planner_doc.by_owner.filter(ctx.sender)) {
    if (row.doc_key === doc_key) {
      ctx.db.planner_doc.id.delete(row.id);
      return;
    }
  }
});
