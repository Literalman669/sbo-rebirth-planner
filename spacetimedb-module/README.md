# SpacetimeDB backend — SBO planner sync

This folder contains the **SpacetimeDB 2.0.x** TypeScript module that stores per-user planner blobs (build presets, draft, calibration, etc.). Clients connect with the official SDK; see [SpacetimeDB docs](https://spacetimedb.com/docs).

## Prerequisites

- [SpacetimeDB CLI](https://spacetimedb.com/install) **2.0.x** (matches generated bindings in `../sbo-rebirth-planner/stdb-bindings/`).
- Node.js 18+ in `spacetimedb/` for `npm install`.

## Publish (Maincloud example)

```bash
cd spacetimedb
npm install
cd ..
spacetime login
spacetime publish --server maincloud YOUR-UNIQUE-DB-NAME
```

Database names must be lowercase letters, numbers, and hyphens only (see `spacetime publish --help`).

## Regenerate client bindings

From repo root:

```bash
cd spacetimedb-module
spacetime build
spacetime generate --lang typescript --out-dir ../sbo-rebirth-planner/stdb-bindings --js-path ./spacetimedb/dist/bundle.js -y
cd ../sbo-rebirth-planner
npm install
npm run build:stdb-client
```

Then commit updated `stdb-bindings/` and `stdb-client.bundle.js` if you changed the module schema.

## Client configuration

In the static planner, set `window.SBO_STDB_CONFIG` before `app.js` loads (see `config.stdb.js`). Use `https://maincloud.spacetimedb.com` as `uri` and the same database name you published.
