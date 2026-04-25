# SpacetimeDB sync (optional)

The planner stays **fully usable offline** in the browser (`localStorage`). When you enable SpacetimeDB, the same JSON blobs are **mirrored** to your published database for multi-device backup and live sync.

## Stack

- **Server module:** [SpacetimeDB](https://spacetimedb.com/docs) **2.0.2** TypeScript module in `../spacetimedb-module/` (tables + reducers).
- **Client:** `spacetimedb` npm package **2.0.2** + generated bindings in `stdb-bindings/`, bundled to `stdb-client.bundle.js` (see `package.json` → `build:stdb-client`).

## Enable on the site

1. Publish the module once ([`spacetimedb-module/README.md`](../spacetimedb-module/README.md)).
2. Edit `config.stdb.js` and set:

```js
window.SBO_STDB_CONFIG = {
  uri: "https://maincloud.spacetimedb.com",
  databaseName: "your-published-database-name",
};
```

3. Ensure `index.html` loads (in order): `config.stdb.js` → `stdb-client.bundle.js` → `app.js`.

On connect, the client subscribes to the `my_planner_docs` view (private `planner_doc` rows for your identity). When cloud data differs from `localStorage`, **cloud values replace local** for the known planner keys.

## Changing the schema

Edit `spacetimedb-module/spacetimedb/src/index.ts`, then run `npm run generate:stdb-bindings` and `npm run build:stdb-client` from this directory, re-publish the module, and deploy the updated bundle.
