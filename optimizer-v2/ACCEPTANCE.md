# Optimizer V2 Acceptance Evidence

Evidence captured for release `2026.08.29.1` with SpacetimeDB 2.8.3.

| # | Version 1 criterion | Proof | Status |
|---|---|---|---|
| 1 | A player can create or resume a build through four distinct routed screens. | `client/e2e/acceptance.spec.ts`, `client/e2e/guest-flow.spec.ts` | Pass |
| 2 | All six agreed weapon paths are supported by the typed profile and verified eligibility rules. | `client/src/domain/build/schema.test.ts`, `client/src/data/fallbackOptimizerCoverage.test.ts`, `client/e2e/acceptance.spec.ts` | Pass |
| 3 | The required input set is limited to character level and floor, weapon path, invested stats, and equipped gear; weapon skill and goal refinements remain optional. | `client/e2e/acceptance.spec.ts`, `client/src/features/planner/plannerScreens.test.tsx` | Pass |
| 4 | Balanced is the default goal and the four optional goals alter documented optimizer behavior. | `client/e2e/acceptance.spec.ts`, `client/src/domain/optimizer/allocateStats.test.ts` | Pass |
| 5 | Results show one immediate action, a deterministic ten-level stat plan, and no more than three verified upgrade targets. | `client/src/features/results/ResultsScreen.test.tsx`, `client/src/domain/optimizer/optimizeBuild.test.ts` | Pass |
| 6 | Every recommendation links to its underlying wiki provenance and displays the dataset version. | `client/src/features/results/ResultsScreen.test.tsx`, `client/src/infrastructure/spacetime/datasetMapper.test.ts` | Pass |
| 7 | Unverified and unavailable items cannot leak into ordinary recommendations. | `client/src/domain/optimizer/eligibility.test.ts`, `client/src/data/fallbackOptimizerCoverage.test.ts`, `npm run validate:coverage` | Pass |
| 8 | Guests can use the complete optimizer locally without signing in. | `client/e2e/guest-flow.spec.ts` on desktop and mobile | Pass |
| 9 | SpacetimeAuth sign-in offers selective import and enables cloud builds, synchronization, history, and sharing. | `client/e2e/cloud-flow.spec.ts`, `client/src/features/builds/GuestImportDialog.test.tsx` | Pass |
| 10 | Signed-in builds use native private tables, identity-filtered views, reducers, and immutable revisions rather than JSON-blob mirroring. | `client/e2e/cloud-module.spec.ts`, `spacetimedb/src/schema.ts`, `spacetimedb/src/playerReducers.ts` | Pass |
| 11 | Public verified data updates through subscriptions, remains cached for connection loss, and marks older plans stale. | `client/src/infrastructure/spacetime/datasetMapper.test.ts`, `client/src/infrastructure/storage/datasetCache.test.ts`, `client/src/features/results/planStaleness.test.ts`, `client/e2e/cloud-flow.spec.ts` | Pass |
| 12 | Owner-managed curators can review staged wiki changes and atomically publish a validated release; ordinary users cannot access curation data or actions. | `client/e2e/curation-module.spec.ts`, `client/e2e/curation-ui.spec.ts`, `spacetimedb/src/releaseValidation.test.ts` | Pass |
| 13 | Players can create and revoke public build snapshots that contain no owner identity or private history. | `client/e2e/sharing-module.spec.ts`, `client/e2e/cloud-flow.spec.ts` | Pass |
| 14 | The CLI, server package, client SDK, generated bindings, local tests, and CI all use SpacetimeDB 2.8.3. | `npm run check:toolchain`, generated `client/src/module_bindings/index.ts`, `.github/workflows/optimizer-v2-ci.yml` | Pass |
| 15 | Mobile, desktop, keyboard, reduced-motion, offline, reconnect, and cross-session flows pass their planned checks. | Both Playwright projects; `client/e2e/acceptance.spec.ts`, `client/e2e/cloud-flow.spec.ts`, `client/e2e/guest-flow.spec.ts` | Pass |
| 16 | GitHub Actions validates and deploys the Maincloud module and GitHub Pages client through separate controlled stages. | `.github/workflows/optimizer-v2-deploy.yml`; Maincloud database `c20067cf2187077ff78299737ab232460ff7e32a536148eb80ad59d188c03791`; first workflow run and production smoke check must be recorded here after deployment. | Pending first manual deployment |

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

Third-party social providers remain disabled until their provider-specific
OAuth client IDs and secrets are supplied. Magic-link email login and guest
mode are enabled, so optional sign-in remains functional without weakening the
database issuer/audience checks.
