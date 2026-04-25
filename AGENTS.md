# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Static HTML/CSS/JS web app (SBO:Rebirth Build Planner) in `sbo-rebirth-planner/`. No build step, no bundler. See `sbo-rebirth-planner/README.md` for feature details and formula notes.

### Running the dev server

```
cd sbo-rebirth-planner
npm run serve          # npx serve -p 60290
```

Opens at `http://localhost:60290/`. The planner loads `index.html` which pulls in `data.js`, `boss-data.js`, `app.js`, `boss.js`, and `boss-readiness.js`.

### Running tests

```
cd sbo-rebirth-planner
npm test               # node test-planner.js
```

Requires the dev server running on port 60290 first. Tests use Playwright (Chromium). After `npm install`, run `npx playwright install chromium --with-deps` to get the browser binary. `npm test` checks determinism, stale-plan banner, and sync-to-plan visibility.

### Linting

No ESLint or other linter is configured in this project. The codebase is plain JS with no build tooling.

### Key gotchas

- The `serve` package is not a devDependency; it's invoked via `npx serve`. This is intentional.
- Playwright browsers are cached in `~/.cache/ms-playwright/` and must be installed separately from `npm install` via `npx playwright install chromium --with-deps`.
- The `sbo-dpo-space/` directory is a separate Hugging Face Spaces deployment (not run locally).
