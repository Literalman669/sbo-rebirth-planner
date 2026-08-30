# SBO: Rebirth Optimizer Reliability Ledger

This ledger records the completed local reliability campaign. A closed finding
has its focused regression and the relevant full layer passing; values below
are evidence, not runtime gates. `npm run test:reliability` decides success
only from child-process exit codes and emits a JSON summary for automation.

## Measured baseline

| Measure | Recorded result | Evidence |
| --- | --- | --- |
| Optimizer determinism | 1,000 identical serializations; diagnostic elapsed 73.0 ms | Task 2 focused stress |
| Local build persistence | 250 deterministic local builds | Task 5 storage stress |
| Cloud history | 100 immutable revisions | Task 7 module stress |
| Same-token convergence | 20 additional revisions (101–120) across two subscriptions | Task 7 module stress |
| Share/revoke | 50 distinct create/revoke cycles | Task 8 module stress |
| Routed planner | 20 Character → Stats → Equipment → Results cycles | Task 6 browser stress |
| Browser viewports | 1440×1000 and 390×844; 8 executions, 8 passed | Task 6 |
| Cloud desktop stress duration | 925 ms | Task 7 |
| Sharing integration duration | 40.1 s (23 passed, 7 expected skips) | Task 8 final fixed-local run |
| Publication focused duration | 6.0 s (test body 3.7 s) | Task 9 carry-forward regression |
| Routed-cycle duration | not captured | Task 6 report |

The following existing client build artifact chunk sizes were captured in bytes:

| Chunk | Bytes |
| --- | ---: |
| `data-vendor-DbPbAp63.js` | 87,149 |
| `index-aTb0C0Q0.css` | 18,879 |
| `index-CdbLZwQd.js` | 125,295 |
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
