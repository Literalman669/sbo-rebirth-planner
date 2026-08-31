# Optimizer V2 Acceptance Evidence

Evidence captured for release `2026.08.29.1` with SpacetimeDB 2.8.3. The final
local and GitHub gates, controlled deployment, and read-only production smoke
completed on 2026-08-30.

| # | Version 1 criterion | Proof | Status |
|---|---|---|---|
| 1 | A player can create or resume a build through four distinct routed screens. | `client/e2e/acceptance.spec.ts`, `client/e2e/guest-flow.spec.ts` | Pass |
| 2 | All six agreed weapon paths are supported by the typed profile and verified eligibility rules. | `client/src/domain/build/schema.test.ts`, `client/src/data/fallbackOptimizerCoverage.test.ts`, `client/e2e/acceptance.spec.ts` | Pass |
| 3 | The required input set is limited to character level and floor, weapon path, invested stats, and equipped gear; weapon skill and goal refinements remain optional. | `client/e2e/acceptance.spec.ts`, `client/src/features/planner/plannerScreens.test.tsx` | Pass |
| 4 | Balanced is the default goal and the four optional goals alter documented optimizer behavior. | `client/e2e/acceptance.spec.ts`, `client/src/domain/optimizer/allocateStats.test.ts` | Pass |
| 5 | Results and read-only shared plans show one immediate action, a deterministic ten-level stat plan, plan-precision warnings where applicable, and no more than three verified upgrade targets with optimizer-provided requirement and eligibility guidance. | `client/src/features/results/ResultsScreen.test.tsx`, `client/src/features/share/SharedBuildScreen.test.tsx`, `client/src/domain/optimizer/optimizeBuild.test.ts` | Pass |
| 6 | Every recommendation links to its underlying wiki provenance and displays the dataset version. | `client/src/features/results/ResultsScreen.test.tsx`, `client/src/infrastructure/spacetime/datasetMapper.test.ts` | Pass |
| 7 | Unverified and unavailable items cannot leak into ordinary recommendations. | `client/src/domain/optimizer/eligibility.test.ts`, `client/src/data/fallbackOptimizerCoverage.test.ts`, `npm run validate:coverage` | Pass |
| 8 | Guests can use the complete optimizer locally without signing in. | `client/e2e/guest-flow.spec.ts` on desktop and mobile | Pass |
| 9 | SpacetimeAuth sign-in offers selective import and enables cloud builds, synchronization, history, and sharing. Local drafts are uploaded only after explicit enrollment, and pending writes are isolated by OIDC subject. | `client/e2e/cloud-flow.spec.ts`, `client/src/features/builds/GuestImportDialog.test.tsx`, `client/src/app/providers/CloudBuildsProvider.test.tsx`, `client/src/infrastructure/cloud/pendingRevisionQueue.test.ts` | Pass |
| 10 | Signed-in builds use native private tables, identity-filtered views, reducers, and immutable revisions rather than JSON-blob mirroring. A committed revision retry is idempotent, while a conflicting payload is rejected. | `client/e2e/cloud-module.spec.ts`, `spacetimedb/src/schema.ts`, `spacetimedb/src/playerReducers.ts` | Pass |
| 11 | Public verified data updates through subscriptions, remains cached for connection loss, and preserves an older plan on its exact release until the player explicitly recalculates. | `client/src/infrastructure/spacetime/datasetMapper.test.ts`, `client/src/infrastructure/storage/datasetCache.test.ts`, `client/src/features/results/ResultsScreen.test.tsx`, `client/e2e/cloud-flow.spec.ts` | Pass |
| 12 | Owner-managed curators can review staged wiki changes, carry the current verified release into a complete new draft, and atomically publish only rows whose entity and candidate page/URL/revision match; ordinary users cannot access curation data or actions. | `client/e2e/curation-module.spec.ts` (identity isolation), `spacetimedb/src/releaseValidation.test.ts`, `client/src/features/curation/curationFlow.test.tsx` (404 access gate) | Pass |
| 13 | Players can create and revoke owner-free public build snapshots; historical shares recompute only with their stored dataset version and retain their computed precision and eligibility metadata. | `client/e2e/sharing-module.spec.ts`, `client/e2e/cloud-flow.spec.ts`, `client/src/features/share/SharedBuildScreen.test.tsx` | Pass |
| 14 | The CLI, server package, client SDK, generated bindings, local tests, and CI all use SpacetimeDB 2.8.3. | `npm run check:toolchain`, generated `client/src/module_bindings/index.ts`, `.github/workflows/optimizer-v2-ci.yml` | Pass |
| 15 | Mobile, desktop, keyboard, reduced-motion, offline, reconnect, and cross-session flows pass their planned checks. | Both Playwright projects; `client/e2e/acceptance.spec.ts`, `client/e2e/cloud-flow.spec.ts`, `client/e2e/guest-flow.spec.ts` | Pass |
| 16 | GitHub Actions validates and deploys the Maincloud module and GitHub Pages client through separate controlled stages, including direct nested-route recovery and favicon delivery from the built Pages artifact. | [CI run 33304722474](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304722474), [deployment 33304722564](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304722564), `client/e2e-pages/deep-links.spec.ts`, and the read-only production smoke below. | Pass |

## Pre-deployment regression gates

- Clean `npm ci`: 0 reported package vulnerabilities (2026-08-30 fresh local gate).
- Toolchain: Node 22.22.2 and SpacetimeDB 2.8.3 (2026-08-30 fresh local gate).
- Reliability runner (final deployed head `0b32d66`): all 6 layers passed in GitHub Actions — 40 client unit files / 322 tests (26.42 s), 3 module unit files / 62 tests (293 ms), 20 script tests, typecheck, coverage, and module build. Timings are diagnostic only.
- Fixed-local SpacetimeDB integration: 24 passed, 8 intentionally skipped in 43.5 s, against a new `http://127.0.0.1:3000` / `sbo-rebirth-optimizer-v2-test` lifecycle only; an occupied `127.0.0.1:4173` fails closed without reusing, contacting, or terminating its owner.
- CI base isolation and phase isolation: base and watchdog guards are green while the global timeout remains unset. Fourth-run markers proved a single long-lived local server stopped accepting new clients before either heavy workload began, so the integration runner now uses four fresh owned-server phases with exact heavy-test greps and fail-fast ordering. Two final `CI=true GITHUB_ACTIONS=true` integrations passed 24 tests with 8 intended skips; local watchdog fallbacks are 120s/60s for every environment, while global and sharing limits remain unchanged.
- Auditable final GitHub gate (2026-08-30, `0b32d66`): core 21 passed/5 skipped (39.6 s), composite 1/1 (10.9 s), publication 1/1 (3.4 s), sharing 1/1 (1.9 s), aggregate 24/8; Pages 3/3 in 1.5 s. Generated bindings were clean, and every fixed-local phase used a fresh owned database.
- Same-parent concurrency: 8 concurrent pairs produced 16 fulfilled siblings, +16 revisions, and +24 rows in each child table; no sibling winner is assumed.
- Production-shaped Pages artifact: direct `/auth/callback`, `/shared/:id`, and the base-aware favicon pass (3/3). The production GitHub Actions base remains `/sbo-rebirth-planner/` when no local override is supplied.
- Generated TypeScript bindings are regenerated with SpacetimeDB 2.8.3 and `git diff --exit-code -- client/src/module_bindings` exited 0.
- Shared-plan parity: the local Task 21 RED/GREEN regression proves the shared read-only route places the literal reduced-precision warning in an accessible status before the future stat plan and retains optimizer-produced requirement plus `confirm in game` eligibility text; the exact historical-release substitution checks remain green.

## Completed external evidence

- Historical failed runs include the seventh [CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304045365) and [deploy](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304045333): core and Linux cleanup passed, but leading-`^` greps returned no tests against Linux full titles; production steps were skipped.
- Final [CI run 33304722474](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304722474): success, including the fixed-local six-layer reliability gate.
- Final [deployment 33304722564](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304722564): success, including Maincloud publish, production auth lock/verification, production build, Pages artifact tests/upload, and deployment.
- Live URL: https://literalman669.github.io/sbo-rebirth-planner/
- Read-only smoke: verified release badge, Create Build, direct Character refresh, missing-share state, and 390×844 layout passed; favicon returned HTTP 200 and the fresh browser tab reported zero console errors and zero warnings.
- Detailed allocation checkpoint: current unspent points are allocated first,
  the next ten actual levels each add exactly three points, running totals
  reconcile, and desktop/mobile results share one accessible table contract.
- Wiki catalog audit: 791/791 discovered pages are accounted for, 649 records
  are normalized and source-backed, and unresolved layouts remain explicitly
  excluded. This is development evidence; production stays on dataset
  `2026.08.29.1` until the unresolved review is complete.
- Deployment head `1b8883a`: [CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33312589475)
  and [deploy](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33312589476)
  succeeded. Live smoke verified spend-now, Levels 2–11, zero console
  warnings/errors, and a width-safe 390×844 layout while retaining dataset
  `2026.08.29.1`.

## One-time production evidence

- Maincloud database: `sbo-rebirth-optimizer-v2`
- Current public release: `2026.08.29.1` with 33 equipment rows and 9 formula rows.
- Production auth mode: `production`
- OIDC issuer: `https://auth.spacetimedb.com/oidc`
- Public OIDC client: `client_034Fmt0pVhyBjR0JXquiKQ`
- Production callback: `https://literalman669.github.io/sbo-rebirth-planner/auth/callback`
- Local callback: `http://localhost:5173/auth/callback`
- GitHub Actions secret `SPACETIMEDB_LOGIN_TOKEN` and variable
  `SPACETIMEAUTH_CLIENT_ID` are configured; secret values are never recorded.
- Current controlled-deployment URL: https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33304722564
- Current live-client URL: https://literalman669.github.io/sbo-rebirth-planner/
- Current production smoke: passed on 2026-08-30 with zero console errors/warnings.

Third-party social providers remain disabled until their provider-specific
OAuth client IDs and secrets are supplied. Magic-link email login and guest
mode are enabled, so optional sign-in remains functional without weakening the
database issuer/audience checks.

## QOL Release 1 local acceptance (2026-08-31, `76f35de`)

The `codex/qol-release-1` implementation passed the complete local acceptance
gate without publishing or mutating production. The accepted flow now includes
the routed Home/Character/Stats/Equipment/Results/Builds workspaces, versioned
local persistence, optional cloud state, undo/save status, guided stat controls,
the complete verified equipment picker, actionable results, focused save modes,
and local/cloud build lifecycle controls.

- Client units: 67 files, 448 tests passed.
- SpacetimeDB module units: 6 files, 73 tests passed.
- Root scripts: 20 tests passed; wiki tools: 6 tests passed.
- Coverage: verified fallback release `2026.08.30.1` passed.
- Integration core: 30 passed and 6 intentional mobile-only skips.
- Isolated backend stress: 100-revision convergence, atomic publication, and
  owner-free share/revoke each passed in fresh local SpacetimeDB phases.
- Pages artifact: 3/3 deep-link, callback, share, and favicon checks passed.
- Accessibility/responsiveness: zero serious or critical axe violations and no
  document overflow at 1440×1000, 768×1024, 390×844, and 320×700.
- Migration: a browser-created v3 database upgraded to v4 while preserving its
  active draft and saved build.
- Fingerprint stability: checklist completion and display expansion left the
  deterministic plan fingerprint unchanged.
- Equipment query: 100 searches over a synthetic 1,000-record index completed
  in 30.8 ms during the final reliability run (1,000 ms budget).
- Visual QA: Home, Character, Stats, Equipment, picker, Results, Save dialog,
  and Builds were inspected at desktop and mobile widths with zero captured
  browser warnings/errors. Visual inspection additionally corrected equipped
  item labeling, radio sizing, checklist density, and build-card action layout.

Known release boundaries remain explicit: social OAuth providers are not
configured; Inventory and Progress are Release 2 surfaces; unresolved wiki
layouts remain excluded rather than guessed; the production live dataset is
still `2026.08.29.1`; and the 907,567-byte main entry chunk retains Vite's
non-blocking code-splitting warning. This branch is verified but not merged,
pushed, published, or deployed pending owner approval.

## QOL Release 2 inventory local acceptance (2026-08-31)

| # | Inventory criterion | Proof | Status |
|---|---|---|---|
| 1 | Guests and signed-in players have one canonical inventory across builds, while ownership updates the active build without recording an undo edit. | `client/src/app/providers/InventoryProvider.test.tsx`, `client/e2e/inventory-flow.spec.ts` | Pass |
| 2 | The inventory workspace exposes the complete verified catalog with search, filters, sorting, progressive rendering, ownership, favorites, comparison, notes, and direct equip actions. | `client/src/domain/inventory/catalog.test.ts`, `client/src/features/inventory/inventory.test.tsx` | Pass |
| 3 | Two to four items can be compared with verified raw stats, prices or explicit missing-price labels, projected change, slot warnings, and direct wiki provenance. | `client/src/features/inventory/inventory.test.tsx`, `client/e2e/qol-accessibility.spec.ts` | Pass |
| 4 | Inventory backups are versioned and validated; merge is non-destructive, while replace and reset require explicit confirmation. | `client/src/domain/inventory/stateSchema.test.ts`, `client/src/features/inventory/inventory.test.tsx` | Pass |
| 5 | Local inventory survives reload and the v4-to-v5 IndexedDB migration without losing the active draft or saved builds; an older open tab produces an actionable recovery notice instead of an infinite loading state. | `client/src/infrastructure/storage/inventoryStore.test.ts`, `client/src/infrastructure/storage/plannerDatabase.test.ts`, `client/src/features/shell/shell.test.tsx`, `client/e2e/reliability-flow.spec.ts` | Pass |
| 6 | Cloud inventory is private, identity-scoped, local-first, retryable, merge-safe on first attachment, and does not manufacture immutable build revisions for favorites, comparison, or notes. | `client/src/app/providers/CloudBuildsProvider.test.tsx`, `client/src/infrastructure/cloud/buildRepository.test.ts`, `client/e2e/cloud-module.spec.ts` | Pass |
| 7 | The server and client accept at most 2,000 unique owned IDs, four comparison IDs, and 500 bounded notes; malformed or cross-identity state is rejected. | `spacetimedb/src/plannerState.test.ts`, `client/src/domain/inventory/stateSchema.test.ts`, `client/e2e/cloud-module.spec.ts` | Pass |
| 8 | Inventory, comparison, and backup surfaces remain keyboard-accessible and width-safe at the four supported viewports with zero serious/critical accessibility violations. | `client/e2e/qol-accessibility.spec.ts` | Pass |
| 9 | Favorites, comparison choices, and notes preserve the deterministic plan fingerprint; owning/equipping an item deliberately changes planner inputs. | `client/e2e/inventory-flow.spec.ts`, `client/src/app/providers/InventoryProvider.test.tsx` | Pass |
| 10 | Catalog querying remains bounded at scale. | 100 queries × 1,000 records in 255.7 ms during the final reliability gate (1,000 ms budget) | Pass |

This inventory batch deliberately leaves the later Release 2 build-comparison,
presets, progress-dashboard, and player-stat-tracking work for separately
scoped plans. It does not guess unresolved wiki records or publish a new
verified game-data release.
