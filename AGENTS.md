# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Static HTML/CSS/JS web app (SBO:Rebirth Build Planner) in `sbo-rebirth-planner/`. Core planner has no required build step. **Optional** SpacetimeDB sync uses a small esbuild step (`npm run build:stdb-client`) to produce `stdb-client.bundle.js`; see `sbo-rebirth-planner/SPACETIMEDB.md` and `spacetimedb-module/README.md`. See `sbo-rebirth-planner/README.md` for feature details and formula notes.

### Running the dev server

```
cd sbo-rebirth-planner
npm run serve          # npx serve -p 60290
```

Opens at `http://localhost:60290/`. The planner loads `index.html` which pulls in `config.stdb.js` (optional SpacetimeDB settings), `stdb-client.bundle.js` (SpacetimeDB client bridge), then `data.js`, `boss-data.js`, `app.js`, `boss.js`, and `boss-readiness.js`.

### Running tests

```
cd sbo-rebirth-planner
npm test               # node test-planner.js
```

Requires the dev server running on port 60290 first. Tests use Playwright (Chromium). After `npm install`, run `npx playwright install chromium --with-deps` to get the browser binary. `npm test` checks determinism, stale-plan banner, and sync-to-plan visibility.

### Linting

No ESLint or other linter is configured in this project. The codebase is plain JS with no build tooling.

### Production (GitHub Pages)

- **Live site (current):** https://literalman389.github.io/sbo-rebirth-planner/
- **How it updates:** a push to the GitHub repo’s **`main`** branch runs `.github/workflows/deploy.yml`, which builds the optional SpacetimeDB client bundle, runs wiki-sync validation and Playwright smoke tests, then publishes the `sbo-rebirth-planner/` folder to **GitHub Pages**.
- **If the live version stays old:** confirm your **`git remote`** targets the **same** GitHub account/repo that has **Pages** and **Actions** enabled for this project. Pushes only to a different fork (different `github.com/…` owner) will not change that Pages URL until you merge or push those commits to the repo that actually deploys.

### Key gotchas

- SpacetimeDB CLI **2.0.x** should match the `spacetimedb` npm version (currently **2.0.2**) when editing `spacetimedb-module/` and regenerating `stdb-bindings/`.
- The `serve` package is not a devDependency; it's invoked via `npx serve`. This is intentional.
- Playwright browsers are cached in `~/.cache/ms-playwright/` and must be installed separately from `npm install` via `npx playwright install chromium --with-deps`.
- The `sbo-dpo-space/` directory is a separate Hugging Face Spaces deployment (not run locally).
