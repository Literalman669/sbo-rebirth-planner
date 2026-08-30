# SBO: Rebirth Optimizer Reliability Ledger

This ledger records the completed local reliability campaign. A closed finding
has its focused regression and the relevant full layer passing; values below
are evidence, not runtime gates. `npm run test:reliability` decides success
only from child-process exit codes and emits a JSON summary for automation.

## Measured baseline

| Measure | Recorded result | Evidence |
| --- | --- | --- |
| Optimizer determinism | 1,000 identical serializations; diagnostic elapsed 194.6 ms | Task 20 fresh local gate |
| Local build persistence | 250 deterministic local builds | Task 5 storage stress |
| Cloud history | 100 immutable revisions | Task 7 module stress |
| Same-token convergence | 20 additional revisions (101–120) across two subscriptions | Task 7 module stress |
| Share/revoke | 50 distinct create/revoke cycles | Task 8 module stress |
| Routed planner | 20 Character → Stats → Equipment → Results cycles | Task 6 browser stress |
| Browser viewports | 1440×1000 and 390×844; 8 executions, 8 passed | Task 6 |
| Same-parent cloud concurrency | 8 same-parent pairs; 16 fulfilled siblings; +16 revisions and +24 rows in each child table; no assumed winning sibling | Task 18 fixed-local integration |
| Fresh browser server | Occupied `127.0.0.1:4173` fails closed before database/browser activity; listeners receive zero HTTP requests; fixed local URI/database only | Task 19 focused lifecycle proof |
| Cloud desktop stress duration | 925 ms | Task 7 |
| Sharing integration duration | 40.1 s (23 passed, 7 expected skips) | Task 8 final fixed-local run |
| Publication focused duration | 6.0 s (test body 3.7 s) | Task 9 carry-forward regression |
| Routed-cycle duration | not captured | Task 6 report |

The following existing client build artifact chunk sizes were captured in bytes:

| Chunk | Bytes |
| --- | ---: |
| `data-vendor-DbPbAp63.js` | 87,149 |
| `index-aTb0C0Q0.css` | 18,879 |
| `index-BpPnh8FJ.js` | 129,405 |
| `react-vendor-CBRsJp3P.js` | 353,721 |
| `rolldown-runtime-CbXtAM7H.js` | 589 |
| `spacetime-vendor-Do-ucTAG.js` | 129,149 |

## Findings

| ID | severity | reproduction | root cause | regression | fix | status |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | high | Cross the UTC day boundary while running `curationFlow.test.tsx` | Test hard-coded `2026-08-29` although production derives the current UTC review date | 7 focused tests; full baseline 176 client / 25 module / 12 script tests | Fake the date only in the test and restore timers | closed (`a1efe3a`) |
| R-02 | high | Enter noninteger/out-of-range character values, blank stats, or overspend; continue with unrepresented points | Planner lacked complete screen-local validation and result precision accounting | `completeness`, `plannerScreens`, schema tests; full client layer 235 tests | Typed budget analysis; block invalid/overspent input; preserve under-budget input with warning | closed (`9ebcbd9`) |
| R-03 | medium | Omit required weapon skill or reach Results with unaccounted points | Candidate precision reason and budget warning were dropped from the plan/result contract | `optimizeBuild`, `recommendEquipment`, `ResultsScreen`; full client layer 238 tests | Propagate future-only eligibility note and warnings without allocating missing points | closed (`27932ce`) |
| R-04 | high | Reject the unmount save with `QuotaExceededError` after a quota-limited draft save | Cleanup launched an unhandled `saveDraft` promise | Provider focused 4 tests; storage set 21 tests; client typecheck | Best-effort cleanup terminates only its rejected promise; mounted error state unchanged | closed by Task 13 (`a37f367`) |
| R-05 | high | Parse MediaWiki revision text containing JSON-decoded `Stats\u0000fragment` | Revision parser accepted unsafe C0/DEL controls before candidate staging | `wikiProcedures` 18/18; module layer 36/36; module typecheck | Reject unsafe C0/DEL after decode while preserving tab/LF/CR | closed by Task 14 (`8535f21`) |
| R-06 | medium | Read optional sign-in guidance while hosted auth is not configured | Copy implied sign-in availability and did not define the durable/local boundary | `authScreens` 8 tests; full 254 client / 53 module / 13 script tests | Qualify sign-in as configured; retain local guest and email-magic-link/provider boundary copy | closed (`1aab8b4`) |
| H-01 | medium | Review keyboard/browser flow for required keys and edits after route cycles | Initial harness omitted Space/Shift+Tab proof and persisted Two-Handed/DEF/VIT/LUK assertions | Fixed-local desktop/mobile reliability flow: 8 passed | Expanded keyboard recovery and persisted-value assertions; no product change | closed (`2cd20d1`) |
| H-02 | medium | Review offline replay and rejected foreign mutation under real module connection | Initial harness asserted mocked reducer arguments and omitted post-rejection owner state | Real offline replay plus repository unit 9/9 and integration | Use bounded queue subject, real adapter replay, and owner-state polling; no product change | closed (`d3b9e7e`) |
| H-03 | medium | Share revision 50 after revision 100, then inject an extra child row | Initial harness did not require exact historical child sets or revoke its setup share | Fixed-local integration: 23 passed, 7 expected skips | Assert exact normalized child arrays and revoke setup share | closed (`00cd5bc`) |
| H-04 | low | Perturb a carried formula while publishing the second reviewed release | Initial harness did not compare complete carried snapshots | Focused fixed-local publication: 1 passed in 6.0 s | Full-field deterministic snapshots with named reviewed-field exception only | closed (`e73579b`) |
| H-05 | medium | Substitute untrusted Fandom origin or mutate a fixture path array | Initial fixture invariant accepted arbitrary HTTPS and retained a mutable nested array | Fixture suite 5/5; script suite 13/13; full reliability command | Require canonical verified Fandom provenance and clone `weaponPaths` | closed (Task 1 review round) |
| F-01 | critical | Invoke optimizer, Results, or Shared flow with invested stats above `level × pointsPerLevel` | Optimization/allocation did not share a blocker-aware readiness boundary for every entry point | Task 15 RED 14 cases; focused readiness/planner/results/share 44/44; fresh client units | `assessOptimizationReadiness` blocks overspent profiles before recommendation/allocation | closed (`b6812f7`) |
| F-02 | critical | Hydrate a verified-looking cached dataset row with noncanonical source URL/revision; publish the same source in the SpacetimeDB runtime | Runtime schema accepted arbitrary HTTPS/optional provenance; the URL-global client/server parity follow-up failed in the deployed runtime where `URL` is unavailable | Task 16 schema/cache RED 19, then 55 focused client and 35 publication checks; Task 16 runtime follow-up full local integration 24 passed/8 intended skips | Exact canonical provenance, token round-trip, revision/date checks, cache isolation, and URL-global-free runtime validation | closed (`f086657`) |
| F-03 | important | Reach a future candidate that requires both level and missing weapon skill | Level-only early return discarded the combined future-only skill confirmation note | Task 17 RED 4; focused eligibility/optimizer/Results 26/26 | Aggregate ordered eligibility reasons and retain the combined confirmation note | closed (`d850de5`) |
| F-04 | important | Type invalid, partial, whitespace, or otherwise uncommitted optional Weapon Skill text, then reload before Continue | Character screen wrote optional skill edits into the persisted draft before final validation | Task 15 follow-up RED 6/30; focused planner/provider 30/30 | Keep raw skill text local; validate and commit only on Continue | closed (`95c1c65`) |
| F-05 | critical | Use a readiness-valid level with every stat at 500, leaving fewer than 30 allocatable stat slots | Allocator could exhaust stat capacity and throw instead of returning an explicit blocker | Task 15 RED 14 cases; focused readiness/planner/results/share 44/44; fresh client units | Readiness returns `insufficient-stat-capacity`; Stats, Results, Shared, and optimizer stop before allocation | closed (`b6812f7`) |
| F-06 | critical | Submit two distinct child-set revisions from the same parent without awaiting either reducer call | The former 100-revision harness was sequential and could not establish same-parent concurrency behavior | Task 18 eight `Promise.allSettled` pairs: 16 fulfilled siblings, +16 revisions, +24 each child table; fresh integration | Test-only two-live-connection concurrent harness asserts both siblings, exact deltas, and only a pair-eight head without assuming which sibling wins | closed (`6fdff11`) |
| F-07 | important | Start fixed-local integration while another process occupies the browser port | Playwright allowed `reuseExistingServer`; the lifecycle could interact with a prior server instead of proving fresh ownership | Task 19 RED; focused config/lifecycle 2/2 and fresh fixed-local integration | `reuseExistingServer: false` plus `127.0.0.1:4173` bind preflight; no unknown process is contacted or terminated | closed (`366ac96`) |
| F-08 | important | Open an under-budget or future/unknown-skill shared snapshot | Shared view recomputed a correct historical plan but omitted its precision warning, upgrade requirement text, and optimizer-provided confirmation note | Task 21 RED: shared warning status/order and future requirement/eligibility visibility; exact-release substitution regressions retained | Render `RecommendationPlan.warnings`, `requirementText`, and optional `eligibilityNote` without recomputing or changing the read-only route | closed (Task 21) |
| E-01 | external | Confirm earned points for a real Level-1 gameplay character | The `level × pointsPerLevel` rule is dataset/schema evidence, not a gameplay observation | Schema protects `pointsPerLevel: 3`; gameplay confirmation not captured | No code change authorized | open — Level-1 baseline not gameplay-confirmed |
| E-02 | external | Configure and exercise social login | No social OAuth provider credentials/configuration are enabled or discoverable in this repository | Auth copy regression only; no provider integration test is possible | Requires provider-console and SpacetimeAuth dashboard configuration | open — credentials/config not enabled |

## Plan amendments and local-only constraints

Task 13 was added after Task 5's RED exposed an unhandled unmount rejection.
Its exact minimal boundary was to preserve the best-effort cleanup save, add a
rejection terminator, and avoid retries, draft replacement/clearing, or any
change to mounted autosave error reporting. Its commit contains only
`BuildDraftProvider.tsx` and its focused test.

Task 14 was added after Task 9's RED showed an accepted decoded NUL. Its exact
boundary was to reject unsafe C0/DEL characters after JSON decoding before
returning content, preserve tab/LF/CR verbatim, and avoid normalization or
rewriting. Its commit contains only `wikiRevision.ts` and its matrix test.

All runner and stress mutation is fixed to `http://127.0.0.1:3000` and
`sbo-rebirth-optimizer-v2-test`; it accepts no production target or credential
input. Imports are side-effect free, CLI execution is main-module guarded, and
the JSON summary reports direct child exit-code outcomes only. It does not
parse this ledger, test prose, or timing diagnostics to determine pass/fail.
Generated `optimizer-v2/test-results/` remains untracked and must not be
staged.

## Task 12 local release gate (2026-08-29)

The clean local release gate completed after `npm ci` (0 reported
vulnerabilities) and `npm run check:toolchain` (Node 22.22.2, SpacetimeDB
2.8.3). `npm run test:reliability` passed all 6 child layers: 39 client test
files / 254 tests, 3 module test files / 53 tests, 15 script tests, typecheck,
coverage validation for release `2026.08.29.1`, and the SpacetimeDB module
build. The fixed-local browser integration reported 24 passed and 8 expected
skips; the built Pages deep-link suite reported 2 passed. The runner used only
`http://127.0.0.1:3000` and `sbo-rebirth-optimizer-v2-test`, and
`git diff --exit-code -- client/src/module_bindings` remained clean.

Both CI workflows now require that same fixed-local reliability command after
dependency installation, the exact 2.8.3 toolchain pin/check, module build,
binding generation, and binding-diff verification. In the deploy workflow it
precedes SpacetimeDB authentication, Maincloud publish, production auth lock,
Pages artifact upload, and deployment.

The deploy workflow has no job-level production environment block. Its
fixed-local source/binding and reliability steps receive no production
SpacetimeAuth or Vite settings; the production client ID, Maincloud URI, and
database are scoped only to the post-gate production verification/build steps.

The GitHub CI run URL/status, Maincloud publish, Pages deployment URL, and
read-only live-browser smoke are pending owner-authorized external steps; no
links or external statuses are asserted by this local record.

## Task 20 fresh clean gate (2026-08-30)

`npm ci` completed with 0 reported vulnerabilities, and `npm run
check:toolchain` confirmed Node 22.22.2 and SpacetimeDB 2.8.3. The fresh
`npm run test:reliability` command passed all six direct child layers: 40
client unit files / 317 tests in 14.96 s, 3 module unit files / 62 tests in
213 ms, and the freshly rerun 15-test script suite in 105.7716 ms. Client and
module typechecks, coverage validation for `2026.08.29.1`, and the
SpacetimeDB module build also passed. These timings are diagnostics, not
runner pass/fail thresholds.

The fixed-local integration launched a new local SpacetimeDB/browser lifecycle
and completed 24 passed tests with 8 intended mobile-only skips in 45.0 s. The
built Pages deep-link suite completed 2 passed tests in 1.5 s; its Vite build
completed in 222 ms. The current built chunks are listed above, and `git diff
--exit-code -- client/src/module_bindings` exited 0. This local gate neither
dispatched CI nor published, deployed, or smoke-tested an external target.

## Task 21 shared-metadata clean gate (2026-08-30)

Task 21 first recorded the focused RED failure in `SharedBuildScreen.test.tsx`:
the shared view omitted the literal 24-point reduced-precision warning and the
future target's requirement/eligibility metadata. Its focused shared and
optimizer suite then passed 20 tests. The fresh `npm run test:unit` layer
passed 40 client files / 319 tests in 15.88 s, 3 module files / 62 tests in
280 ms, and 15 scripts in 108.7679 ms; both workspace typechecks passed. The
fresh clean reliability runner repeated all six local-only layers, including
coverage validation, module build, 24 fixed-local integration passes with 8
intended skips in 49.0 s, and two built Pages deep-link passes in 1.4 s.
The rebuilt entry chunk is `index-BpPnh8FJ.js` (129,405 bytes), and the final
binding diff command exited 0. No CI, deployment, publication, or live smoke
was requested; the two external findings above remain open.

## Task 22 GitHub Actions browser-base isolation (2026-08-30)

Both [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33299676885)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33299676888)
failed in their fixed-local integration gate before authentication, publication,
or any production step. The runner's ambient `GITHUB_ACTIONS=true` selected the
production Pages base (`/sbo-rebirth-planner/`) for Vite's local dev server.
Consequently direct `/equipment` and `/character` browser routes rendered
outside the router basename, producing four direct-route/keyboard failures and
a cascading late sharing timeout.

`SBO_VITE_BASE_PATH` is now an explicit non-secret Vite server override that
resolves before the ambient GitHub Actions fallback. The fixed-local Playwright
web server supplies `SBO_VITE_BASE_PATH=/` alongside its fixed test database
configuration; production builds still have no override and therefore retain
the `/sbo-rebirth-planner/` base under GitHub Actions. The RED config test
failed because both the resolver and server override were absent. Its GREEN
run passed 4/4, including local override, GitHub Pages default, normal-local
default, and fixed database/server assertions.

With `GITHUB_ACTIONS=true` scoped to the PowerShell integration command and
restored afterward, fixed-local integration passed 24 tests with 8 intended
skips in 44.4 s, including the direct-route and keyboard checks. The fresh
full reliability command passed all six layers: 40 client files / 321 tests,
3 module files / 62 tests, 15 script tests (before the phase-plan tests were added), typechecks, coverage validation,
module build, fixed-local integration (24 passed, 8 skipped, 43.7 s), and
Pages (2 passed, 1.4 s). An independent `npm run test:pages` production build
(203 ms) and deep-link suite (2 passed, 1.4 s) also passed, and
`git diff --exit-code -- client/src/module_bindings` exited 0.

The subsequent [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33300415526)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33300415518)
reruns prove that the base repair removed the direct-route and keyboard
failures. They then hit the outer 30-second Playwright watchdog on two bounded
desktop module stress cases: the 100-revision composite (including 50
share/revoke cycles, offline replay, and eight same-parent races) and the
11-category publication rollback/second-release case. The later sharing-module
timeout was cascading aborted cleanup, not an independent sharing timeout; all
production steps were skipped.

Only those two cases now declare watchdogs: 120 seconds for the bounded
100-revision composite and 60 seconds for bounded publication rollback. The
global Playwright timeout remains unset, no polls/assertions/counts changed,
and the sharing-module timeout remains unchanged. The watchdog RED failed
because neither declaration existed; GREEN passed 5/5 focused configuration
tests. Two further `GITHUB_ACTIONS=true` fixed-local integrations passed 24
tests with 8 intended skips (46.9 s and 47.6 s); the two stress cases completed
in 10.3/3.6 s and 9.5/3.4 s respectively, with suite cleanup intact. A fresh
full reliability gate passed all six layers: 40 client files / 322 tests, 3
module files / 62 tests, 15 scripts (before the phase-plan tests were added), fixed-local integration (24 passed, 8
skipped, 45.0 s), and Pages (2 passed, 1.5 s). Independent Pages, root
typecheck, and binding-diff checks also passed. New GitHub reruns are pending
the watchdog commit; no external action was performed locally.

The third [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33300931793)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33300931706)
runs kept the browser base/direct-route repair green, but proved the bounded
composite reaches its exact 120-second local watchdog and publication reaches
its exact 60-second local watchdog under CI. The following sharing timeout was
again cascading aborted cleanup, and production steps were skipped. The two
per-test limits now remain strict locally (120 seconds / 60 seconds) but use
CI-only ceilings of 300 seconds / 180 seconds through `process.env.CI`; global
and sharing limits remain unchanged. Concise stdout phase markers now identify
the seven composite phases and each publication category plus second release.

The CI-and-GitHub-shaped local integration was repeated twice with both
`CI=true` and `GITHUB_ACTIONS=true`: 24 passed with 8 intended skips in 44.1 s
and 42.7 s, with every phase marker emitted. The strict local full reliability
pre-phase-isolation gate passed all six layers again: 40 client files / 322 tests, 3 module files /
62 tests, 15 scripts, integration 24 passed / 8 skipped in 43.5 s, and Pages
2 passed. Independent Pages (2 passed, 1.4 s; build 210 ms), root typecheck,
and binding diff also passed. At that historical point, fourth GitHub reruns
were pending the CI-watchdog commit; no external action was performed locally.

## Task 22 final owned-process-group gate (2026-08-30, `038d924`)

The exact strict `npm run test:reliability` command completed at the committed
owned-process-group head: 40 client files / 322 tests in 14.44 s, 3 module files /
62 tests in 225 ms, and 18 script tests. Typechecks, coverage validation, and
the module build passed. The owned-server phase output was core 21 passed / 5
skipped in 30.0 s, composite 1 / 1 in 12.2 s, publication 1 / 1 in 6.8 s, and
sharing 1 / 1 in 2.6 s, for the exact 24 passed / 8 intended skips aggregate.
Pages passed 2 / 2 in 1.4 s, and `git diff --exit-code --
client/src/module_bindings` exited 0; ports 3000 and 4173 had no listeners after teardown. The older 15-script Task 22 entries above
are historical pre-phase-plan gates; fifth GitHub reruns remain pending.

The fourth [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33301520394)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33301520388)
runs showed that neither bounded workload started: each logged only its
connect/subscriptions marker, then its first connection hung until the exact
300-second or 180-second watchdog. The long-lived single local SpacetimeDB
process had stopped accepting clients after earlier files; the sharing timeout
was cascading and production steps were skipped. Phase isolation is the fix,
not further timeout expansion.

`run-local-integration.mjs` now starts four deterministic phases with a fresh
in-memory owned server, data directory, identities, module publish, development
auth, browser-port preflight, server-port reuse refusal, owned-process exit,
and port-3000 release before the next phase: core, exact composite grep, exact
publication grep, and sharing only. The pure phase-plan tests prove complete
selectors and fail-fast ordering. The two watchdogs are restored to bounded
120-second/60-second fallback for every environment; global and sharing limits
are unchanged. Two final CI/GitHub-shaped runs passed the exact 24/8 aggregate;
fifth GitHub reruns are pending this phase-isolation commit.

The fifth [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33302887655)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33302887685)
runs passed core and failed only during owned-server teardown: Linux `SIGTERM`
to the `spacetime start` launcher left its descendant tree alive. Production
steps were skipped. Non-Windows phase servers now start detached in their own
owned process group; teardown targets only negative owned PID with `SIGTERM`,
then bounded `SIGKILL` fallback on that same group, treating `ESRCH` as exited,
before waiting for launcher exit and port release. Windows owned-tree taskkill
is unchanged. Sixth reruns are pending this process-group commit.

The sixth [Optimizer V2 CI](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33303354853)
and [Deploy Optimizer V2](https://github.com/Literalman669/sbo-rebirth-planner/actions/runs/33303354862)
runs passed core, then falsely required a detached Node launcher `exitCode`
after its owned process group was already gone. Linux teardown now authoritatively
requires owned negative-PID group absence plus port release, then destroys/unrefs
the detached handle; Windows retains child-exit/taskkill behavior. Production
steps were skipped; seventh reruns are pending.
