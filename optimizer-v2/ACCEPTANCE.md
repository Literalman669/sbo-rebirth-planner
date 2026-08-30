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
