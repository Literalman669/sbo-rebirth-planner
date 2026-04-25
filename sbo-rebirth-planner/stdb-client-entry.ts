/**
 * Browser bridge for SpacetimeDB (generated bindings + SDK).
 * Bundled to stdb-client.bundle.js — see package.json "build:stdb-client".
 */
import { DbConnection } from "./stdb-bindings/index";

export type PlannerStdbConfig = {
  uri: string;
  /** Published database name (see spacetime publish & spacetime.json). */
  databaseName: string;
};

type Listener = () => void;

const listeners = new Set<Listener>();
const pendingWrites = new Map<string, string>();

let conn: DbConnection | null = null;
let tokenStorageKey = "";
let syncScheduled = false;

function tokenKey(cfg: PlannerStdbConfig) {
  return `sbo-stdb-token:${cfg.uri}|${cfg.databaseName}`;
}

function scheduleNotify() {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => {
    syncScheduled = false;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (_e) {
        /* ignore */
      }
    });
  });
}

function readAllDocs(c: DbConnection): Map<string, string> {
  const map = new Map<string, string>();
  const table = (c.db as unknown as { my_planner_docs?: { iter: () => IterableIterator<{ docKey: string; docJson: string }> } }).my_planner_docs;
  if (!table || typeof table.iter !== "function") return map;
  for (const row of table.iter()) {
    map.set(row.docKey, row.docJson);
  }
  return map;
}

function wireTable(c: DbConnection) {
  const table = (c.db as unknown as { my_planner_docs?: {
    iter: () => IterableIterator<{ docKey: string; docJson: string }>;
    onInsert: (cb: (ctx: unknown, row: { docKey: string; docJson: string }) => void) => void;
    onDelete: (cb: (ctx: unknown, row: { docKey: string; docJson: string }) => void) => void;
    onUpdate?: (cb: (ctx: unknown, oldR: { docKey: string; docJson: string }, newR: { docKey: string; docJson: string }) => void) => void;
  } }).my_planner_docs;
  if (!table) return;
  const bump = () => scheduleNotify();
  table.onInsert(() => bump());
  table.onDelete(() => bump());
  if (typeof table.onUpdate === "function") {
    table.onUpdate(() => bump());
  }
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRemoteDocJson(docKey: string): string | null {
  if (!conn) return null;
  const m = readAllDocs(conn);
  return m.has(docKey) ? m.get(docKey)! : null;
}

export function isConnected(): boolean {
  return Boolean(conn);
}

export function connect(cfg: PlannerStdbConfig, onStatus?: (msg: string) => void) {
  disconnect();
  tokenStorageKey = tokenKey(cfg);
  const existing = typeof localStorage !== "undefined" ? localStorage.getItem(tokenStorageKey) : null;

  const builder = DbConnection.builder()
    .withUri(cfg.uri)
    .withDatabaseName(cfg.databaseName)
    .withToken(existing || undefined)
    .onConnect((c, _identity, token) => {
      try {
        localStorage.setItem(tokenStorageKey, token);
      } catch (_e) {
        /* ignore */
      }
      conn = c;
      wireTable(c);
      c.subscriptionBuilder()
        .onApplied(() => {
          onStatus?.("SpacetimeDB: synced");
          flushPending(c);
          scheduleNotify();
        })
        .onError((_ctx, err) => {
          onStatus?.(`SpacetimeDB subscription error: ${err?.message || err}`);
        })
        .subscribe(["SELECT * FROM my_planner_docs"]);
    })
    .onDisconnect(() => {
      conn = null;
      onStatus?.("SpacetimeDB: disconnected");
      scheduleNotify();
    })
    .onConnectError((_ctx, err) => {
      onStatus?.(`SpacetimeDB: ${err?.message || err}`);
    });

  conn = builder.build();
}

export function disconnect() {
  if (conn) {
    try {
      conn.disconnect();
    } catch (_e) {
      /* ignore */
    }
  }
  conn = null;
}

function flushPending(c: DbConnection) {
  if (pendingWrites.size === 0) return;
  const copy = new Map(pendingWrites);
  pendingWrites.clear();
  for (const [docKey, docJson] of copy) {
    c.reducers.upsertPlannerDoc({ docKey, docJson });
  }
}

/** Upsert a doc; sends immediately when a connection exists (otherwise queues until connect). */
export function upsertRemoteDoc(docKey: string, docJson: string) {
  pendingWrites.set(docKey, docJson);
  if (conn) {
    flushPending(conn);
  }
}

export function deleteRemoteDoc(docKey: string) {
  pendingWrites.delete(docKey);
  if (conn) {
    conn.reducers.deletePlannerDoc({ docKey });
  }
}

declare global {
  interface Window {
    SBOPlannerStdb?: {
      connect: typeof connect;
      disconnect: typeof disconnect;
      subscribe: typeof subscribe;
      getRemoteDocJson: typeof getRemoteDocJson;
      isConnected: typeof isConnected;
      upsertRemoteDoc: typeof upsertRemoteDoc;
      deleteRemoteDoc: typeof deleteRemoteDoc;
    };
  }
}

const api = {
  connect,
  disconnect,
  subscribe,
  getRemoteDocJson,
  isConnected,
  upsertRemoteDoc,
  deleteRemoteDoc,
};

if (typeof window !== "undefined") {
  window.SBOPlannerStdb = api;
}
