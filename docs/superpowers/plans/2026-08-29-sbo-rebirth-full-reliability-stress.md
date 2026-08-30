# SBO:Rebirth Optimizer Full Reliability Stress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise every current optimizer utility through deterministic matrices, boundary and corruption tests, isolated SpacetimeDB load, built-browser workflows, and production smoke checks; fix every reproduced Critical or Important defect with a regression test.

**Architecture:** Add focused stress suites beside the domain, storage, React, and module code they exercise, plus a small reliability report that records thresholds and findings. All bulk mutation runs against fake IndexedDB or the fixed ephemeral local SpacetimeDB test database; production is read-only. Known validation and explanation defects are repaired directly, while any newly discovered defect must be root-caused and added as a numbered red-green task before code changes.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Playwright 1.62, fake-indexeddb, SpacetimeDB CLI/server/client 2.8.3, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-29-sbo-rebirth-full-reliability-stress-design.md`

## Global Constraints

- Bulk writes, concurrency, corruption, role changes, sharing, and publication stress use only `sbo-rebirth-optimizer-v2-test` on `http://127.0.0.1:3000`.
- Production checks are read-only except for the already-controlled deployment workflow.
- Keep SpacetimeDB CLI, server package, client package, and generated bindings pinned to exactly `2.8.3`.
- Never print, commit, or copy OIDC client secrets, login tokens, provider secrets, or browser session data.
- Every production behavior change starts with a focused failing test, is observed failing for the intended reason, and receives one minimal root-cause fix.
- Every optimizer recommendation must use a validated exact dataset release and verified source-backed records.
- Do not change the Level-1 earned-point baseline until owner gameplay evidence establishes whether a new Level-1 character begins with zero or three allocatable points.
- Social-provider buttons remain an external configuration dependency; tests must not fabricate provider credentials.
- Use condition polling for asynchronous tests; do not add arbitrary multi-second sleeps to hide races.
- Preserve the existing routed four-screen experience and the current fantasy visual system.

---

## File Map

**New reliability files**

- `optimizer-v2/client/src/test/stressFixtures.ts` — deterministic valid profile/dataset builders and invariant assertions shared by stress suites.
- `optimizer-v2/client/src/domain/optimizer/optimizerStress.test.ts` — six-path/five-goal cross-product, determinism, and execution-volume tests.
- `optimizer-v2/client/e2e/reliability-flow.spec.ts` — repeated route, keyboard, viewport, reload, console, and malformed-input flows.
- `optimizer-v2/client/e2e/reliability-module.spec.ts` — isolated 100-revision, reconnect, account, sharing, and curation stress.
- `optimizer-v2/scripts/run-reliability.mjs` — orchestrates the pinned local integration run and emits a machine-readable summary without touching production.
- `optimizer-v2/scripts/run-reliability.test.mjs` — proves target allowlisting and summary failure behavior.
- `optimizer-v2/RELIABILITY.md` — findings ledger and final measured thresholds.

**Existing files expected to change**

- `optimizer-v2/package.json` — `test:stress` and `test:reliability` scripts.
- `optimizer-v2/client/src/features/planner/completeness.ts` — reusable character, stat-budget, and equipment validation results.
- `optimizer-v2/client/src/features/planner/CharacterScreen.tsx` — block invalid numeric character boundaries.
- `optimizer-v2/client/src/features/planner/StatsScreen.tsx` — distinguish overspent from currently unaccounted points and block only impossible totals.
- `optimizer-v2/client/src/features/results/ResultsScreen.tsx` — display known-skill and unaccounted-point precision warnings without claiming impossible immediacy.
- `optimizer-v2/client/src/domain/optimizer/eligibility.ts` — preserve unknown-skill candidates as future-only with explicit reasons.
- `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts` — expose the selected target’s eligibility explanation.
- `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts` — surface plan warnings in a typed result.
- `optimizer-v2/client/src/domain/build/model.ts` and `schema.ts` — change only if stress evidence proves a new persisted field is necessary.
- Storage/cloud/curation tests beside their current implementations — volume and corruption coverage first; production changes only for reproduced failures.
- `.github/workflows/optimizer-v2-ci.yml` and `optimizer-v2-deploy.yml` — run the final reliability command after it is stable.
- `optimizer-v2/ACCEPTANCE.md` — exact test counts, stress thresholds, run URLs, and remaining external dependencies.

---

### Task 0: Stabilize the Calendar-Boundary Baseline

**Finding:** `ReleaseDraftEditor` correctly derives a review date from the current UTC day, but `curationFlow.test.tsx` hard-codes `2026-08-29`. The suite therefore fails after the UTC calendar crosses into `2026-08-30`, before any reliability implementation runs.

**Files:**
- Modify: `optimizer-v2/client/src/features/curation/curationFlow.test.tsx`

**Interfaces:**
- Consumes: Vitest fake timers and the existing `ReleaseDraftEditor` behavior.
- Produces: a deterministic calendar-boundary test without changing production date semantics.

- [ ] **Step 1: Preserve the reproduced RED evidence**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run curationFlow.test.tsx`

Expected: FAIL because the test expects `lastReviewedAt: '2026-08-29'` while the current UTC date produces `2026-08-30`.

- [ ] **Step 2: Pin the test clock at an unambiguous UTC instant**

Use Vitest fake timers or `vi.setSystemTime` in the affected test setup, restore real timers during cleanup, and keep the existing literal expectation. Do not change `ReleaseDraftEditor.tsx`.

- [ ] **Step 3: Verify focused and complete unit tests**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run curationFlow.test.tsx
npm run test:unit
```

Expected: PASS with no date-boundary failure.

- [ ] **Step 4: Commit**

```bash
git add optimizer-v2/client/src/features/curation/curationFlow.test.tsx
git commit -m "test: stabilize curation review date"
```

### Task 1: Reliability Fixtures, Invariants, and Safe Runner

**Files:**
- Create: `optimizer-v2/client/src/test/stressFixtures.ts`
- Create: `optimizer-v2/scripts/run-reliability.mjs`
- Create: `optimizer-v2/scripts/run-reliability.test.mjs`
- Modify: `optimizer-v2/package.json`

**Interfaces:**
- Produces: `buildStressProfile(overrides?: Partial<CharacterProfile>): CharacterProfile`
- Produces: `buildStressDataset(overrides?: Partial<DatasetSnapshot>): DatasetSnapshot`
- Produces: `assertRecommendationInvariants(plan, profile, dataset): void`
- Produces: `assertFixedReliabilityTarget(uri: string, database: string): void`
- Consumes: current domain schemas, `run-local-integration.mjs`, and fixed local database constants.

- [ ] **Step 1: Add runner allowlist tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFixedReliabilityTarget } from './run-reliability.mjs';

test('accepts only the fixed ephemeral reliability database', () => {
  assert.doesNotThrow(() =>
    assertFixedReliabilityTarget(
      'http://127.0.0.1:3000',
      'sbo-rebirth-optimizer-v2-test',
    ),
  );
  assert.throws(() =>
    assertFixedReliabilityTarget(
      'https://maincloud.spacetimedb.com',
      'sbo-rebirth-optimizer-v2',
    ),
  );
});
```

- [ ] **Step 2: Run the runner test and observe the missing export**

Run: `node --test optimizer-v2/scripts/run-reliability.test.mjs`

Expected: FAIL because `run-reliability.mjs` does not exist.

- [ ] **Step 3: Implement the allowlist and orchestrator**

```js
export function assertFixedReliabilityTarget(uri, database) {
  if (
    uri !== 'http://127.0.0.1:3000' ||
    database !== 'sbo-rebirth-optimizer-v2-test'
  ) {
    throw new Error('Reliability mutation is restricted to the fixed local test database');
  }
}
```

The script must run `npm run test:unit`, `npm run typecheck`, `npm run validate:coverage`, `spacetime build`, `npm run test:integration`, and `npm run test:pages` with inherited output and a nonzero exit when any child fails.

- [ ] **Step 4: Add deterministic fixture builders**

Implement builders using `bootstrapRelease` and literal profile defaults. `assertRecommendationInvariants` must check exact dataset version, one action, thirty future points, at most three unique slot/item targets, and verified source-backed eligibility.

- [ ] **Step 5: Add package scripts**

```json
"test:stress": "npm run test:unit --workspace @sbo/optimizer-client -- --run optimizerStress.test.ts",
"test:reliability": "node scripts/run-reliability.mjs"
```

- [ ] **Step 6: Run focused and complete script tests**

Run: `node --test optimizer-v2/scripts/*.test.mjs`

Expected: all script tests pass.

- [ ] **Step 7: Commit**

```bash
git add optimizer-v2/client/src/test/stressFixtures.ts optimizer-v2/scripts/run-reliability.mjs optimizer-v2/scripts/run-reliability.test.mjs optimizer-v2/package.json
git commit -m "test: add safe reliability stress runner"
```

### Task 2: Optimizer Cross-Product and Determinism Stress

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/optimizerStress.test.ts`
- Modify: `optimizer-v2/client/src/test/stressFixtures.ts`
- Modify only on reproduced failure: optimizer files under `optimizer-v2/client/src/domain/optimizer/`

**Interfaces:**
- Consumes: Task 1 fixture builders and `assertRecommendationInvariants`.
- Produces: table-driven coverage for all 30 path/goal pairs and the 1,000-run threshold.

- [ ] **Step 1: Add the 30-combination invariant table**

```ts
const paths: WeaponPath[] = [
  'two-handed', 'one-handed', 'rapier', 'dagger', 'dual-wield', 'melee',
];
const goals: OptimizationGoal[] = [
  'balanced', 'damage', 'survivability', 'mobility', 'farming',
];

it.each(paths.flatMap(path => goals.map(goal => [path, goal] as const)))(
  '%s / %s returns only eligible verified advice',
  (weaponPath, goal) => {
    const profile = buildStressProfile({ weaponPath, goal });
    const dataset = buildStressDataset();
    assertRecommendationInvariants(optimizeBuild(profile, dataset), profile, dataset);
  },
);
```

- [ ] **Step 2: Add literal boundary rows**

Cover level/floor/skill immediately below, at, and above requirements; owned inactive-event items; omitted weapon skill; and an exact historical dataset version. Expectations must be literal item IDs and action kinds, not values computed by the production ranking helper.

- [ ] **Step 3: Add 1,000-run determinism test**

Serialize the first result and assert the next 999 serializations are identical. Record elapsed time as test diagnostic output, but do not use a hardware-specific hard failure threshold.

- [ ] **Step 4: Run the stress suite**

Run: `npm run test:stress --prefix optimizer-v2`

Expected: PASS, or a focused invariant failure naming the first bad path/goal/profile.

- [ ] **Step 5: If an invariant fails, stop and append a numbered red-green repair task**

The appended task must name the exact failing row, root cause, files, failing assertion, minimal implementation, focused verification command, full optimizer command, and commit. Do not alter production optimizer code inside Task 2.

- [ ] **Step 6: Commit coverage**

```bash
git add optimizer-v2/client/src/domain/optimizer/optimizerStress.test.ts optimizer-v2/client/src/test/stressFixtures.ts
git commit -m "test: stress every optimizer path and goal"
```

### Task 3: Character and Stat-Budget Validation Repair

**Files:**
- Modify: `optimizer-v2/client/src/features/planner/completeness.ts`
- Modify: `optimizer-v2/client/src/features/planner/CharacterScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/StatsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Test: create `optimizer-v2/client/src/features/planner/completeness.test.ts`

**Interfaces:**
- Produces: `analyzeStatBudget(profile: CharacterProfile, pointsPerLevel: number): StatBudget`
- Produces type:

```ts
type StatBudget = {
  expected: number;
  invested: number;
  difference: number;
  status: 'balanced' | 'unaccounted' | 'overspent';
};
```

- Consumes: the current verified `pointsPerLevel` value without changing the Level-1 baseline.

- [ ] **Step 1: Add failing unit tests for stat-budget states**

```ts
expect(analyzeStatBudget(profileWithTotal(24), 3)).toEqual({
  expected: 24, invested: 24, difference: 0, status: 'balanced',
});
expect(analyzeStatBudget(profileWithTotal(0), 3)).toMatchObject({
  difference: 24, status: 'unaccounted',
});
expect(analyzeStatBudget(profileWithTotal(25), 3)).toMatchObject({
  difference: -1, status: 'overspent',
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run completeness.test.ts`

Expected: FAIL because `analyzeStatBudget` is not exported.

- [ ] **Step 3: Implement the pure budget analyzer**

Use the same earned-point rule currently published by the dataset. Clamp nothing and preserve the signed difference so impossible overspending cannot be hidden.

- [ ] **Step 4: Add failing component tests for invalid navigation**

Assert Character Continue keeps focus on invalid level/floor fields and Stats Continue blocks negative, fractional, above-cap, and overspent input. Assert under-budget input remains allowed but is explicitly announced as unaccounted/unspent rather than validly invested.

- [ ] **Step 5: Run component tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run plannerScreens.test.tsx`

Expected: FAIL because the current Continue handlers navigate without these guards.

- [ ] **Step 6: Implement minimal screen guards**

Character validation must enforce integer level `1..10000` and floor `1..19`. Stats validation must enforce integer `0..500` per stat and reject overspending. Under-budget copy must say the optimizer sees `N` points not represented in invested stats and will treat plan precision as reduced.

- [ ] **Step 7: Verify focused and full planner tests**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run completeness.test.ts plannerScreens.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add optimizer-v2/client/src/features/planner/completeness.ts optimizer-v2/client/src/features/planner/completeness.test.ts optimizer-v2/client/src/features/planner/CharacterScreen.tsx optimizer-v2/client/src/features/planner/StatsScreen.tsx optimizer-v2/client/src/features/planner/plannerScreens.test.tsx
git commit -m "fix: validate character and stat budgets"
```

### Task 4: Unknown-Skill and Unaccounted-Point Result Explanations

**Files:**
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`

**Interfaces:**
- Extends `UpgradeTarget` with `eligibilityNote?: string`.
- Extends `RecommendationPlan` with `warnings: string[]`.
- Consumes: `analyzeStatBudget` from Task 3 and `CandidateClassification.reason`.

- [ ] **Step 1: Add failing optimizer tests**

For a skill-gated Steel Greatsword with omitted weapon skill, assert it is not the immediate action and its target includes `eligibilityNote: 'Requires Weapon Skill 5; confirm in game'`. For a Level-8 zero-stat profile, assert warnings include the literal positive budget difference produced by Task 3.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run optimizeBuild.test.ts`

Expected: FAIL because the result lacks typed warnings and target notes.

- [ ] **Step 3: Propagate eligibility reasons into ranked targets**

Set `eligibilityNote` only when a candidate is future-only or precision-limited. Do not duplicate the requirement text for immediate, fully confirmed candidates.

- [ ] **Step 4: Add stat-budget warnings to `optimizeBuild`**

Use Task 3’s analyzer. Do not alter the thirty future points or silently distribute currently unaccounted points until the Level-1 baseline is confirmed.

- [ ] **Step 5: Add failing Results UI assertions**

Assert the warnings render above the future stat table and an unknown-skill target visibly says “confirm in game.”

- [ ] **Step 6: Implement warning UI and verify**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run optimizeBuild.test.ts ResultsScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts optimizer-v2/client/src/features/results/ResultsScreen.tsx optimizer-v2/client/src/features/results/ResultsScreen.test.tsx
git commit -m "fix: explain incomplete stat and skill precision"
```

### Task 5: Local Storage Volume, Corruption, and Failure Stress

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts`
- Modify only on reproduced failure: corresponding implementation files.

**Interfaces:**
- Consumes: Task 1 profile/dataset fixtures.
- Produces: measured 250-build, cache-corruption, and legacy-claim coverage.

- [ ] **Step 1: Add 250-build ordering and targeted-deletion test**

Create 250 profiles with literal IDs, controlled timestamps, and alternating paths. Assert all valid rows return, newest first, deleting build 127 removes only that record, and the active draft remains.

- [ ] **Step 2: Add corrupt-row isolation tests**

Insert invalid raw draft, named build, release, scoped pending revision, and legacy pending revision records directly through fake IndexedDB. Assert each adapter isolates only its corrupt row and preserves valid neighbors.

- [ ] **Step 3: Add storage rejection component test**

Provide a `GuestBuildStore` whose `saveDraft` rejects with `QuotaExceededError`; assert `BuildDraftProvider` renders a storage status without clearing the in-memory draft.

- [ ] **Step 4: Run storage suites**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run guestBuildStore.test.ts datasetCache.test.ts pendingRevisionQueue.test.ts BuildDraftProvider.test.tsx
```

Expected: PASS or a focused adapter failure.

- [ ] **Step 5: Repair only reproduced adapter defects using a new failing test**

If Step 4 fails, append a numbered task naming the adapter operation, raw row, root cause, and minimal implementation before modifying production storage code.

- [ ] **Step 6: Commit**

```bash
git add optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx
git commit -m "test: stress local reliability and corruption isolation"
```

### Task 6: Browser Route, Validation, Responsive, and Console Stress

**Files:**
- Create: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify only on reproduced failure: relevant React/CSS files.

**Interfaces:**
- Consumes: existing Playwright local test server and fixed local auth adapter.
- Produces: desktop/mobile route-cycle and console-health proof.

- [ ] **Step 1: Add console and page-error collection helper**

```ts
function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(message.text());
  });
  return failures;
}
```

- [ ] **Step 2: Add repeated route-cycle test**

Complete Character → Stats → Equipment → Results, use all three Edit links, and repeat the cycle twenty times. Assert one active progress step, no duplicate result sections, stable draft values, and zero runtime failures.

- [ ] **Step 3: Add invalid-input keyboard test**

Use only Tab, Shift+Tab, Space, arrow keys, and Enter. Assert invalid Continue actions retain the route and focus the first invalid control; then correct values and complete the flow.

- [ ] **Step 4: Add desktop/mobile layout assertions**

At 1440×1000 and 390×844, assert the primary panel fits within viewport width, required actions are visible, and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [ ] **Step 5: Add direct-route reload rows**

Reload `/character`, `/stats`, `/equipment`, `/results`, `/auth/callback`, and `/shared/missing`. Assert expected screen or guard behavior and no framework overlay.

- [ ] **Step 6: Run browser reliability flow**

Run: `npm run test:integration --prefix optimizer-v2`

Expected: all desktop/mobile browser checks pass.

- [ ] **Step 7: For each rendered failure, capture DOM, screenshot, and console evidence before a TDD repair**

Do not weaken assertions or extend timeouts without showing the actual asynchronous condition.

- [ ] **Step 8: Commit**

```bash
git add optimizer-v2/client/e2e/reliability-flow.spec.ts optimizer-v2/client/src optimizer-v2/client/src/styles
git commit -m "test: stress routed and responsive planner behavior"
```

### Task 7: Cloud Revision, Offline, and Account-Isolation Stress

**Files:**
- Create: `optimizer-v2/client/e2e/reliability-module.spec.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify only on reproduced failure: cloud repository, queue, or server reducers.

**Interfaces:**
- Consumes: local owner/test identities from `run-local-integration.mjs`.
- Produces: 100-revision and multi-connection final-state assertions.

- [ ] **Step 1: Add 100 sequential revision integration test**

Save one build from Level 1 through Level 100 with stable revision IDs. Assert exactly 100 revisions, one build, expected child-row counts, and head `stress-revision-100`.

- [ ] **Step 2: Add idempotent retry and conflict rows**

Replay revision 50 with identical payload and assert counts do not change. Replay revision 50 with a changed stat and assert the reducer rejects it without changing the head.

- [ ] **Step 3: Add two-connection same-identity test**

Alternate valid revisions between two connections using the same token. Assert both subscribed views converge on the latest head and retain all history.

- [ ] **Step 4: Add offline ordered replay and account switch test**

Queue three revisions while the reducer adapter rejects as offline. Reconnect as the same subject and assert ordered replay. Then seed another subject’s pending row and assert it remains untouched.

- [ ] **Step 5: Run module reliability test**

Run: `npm run test:integration --prefix optimizer-v2`

Expected: all module stress assertions pass without increasing timeouts.

- [ ] **Step 6: Repair reproduced concurrency defects with a focused red-green task**

Any failure must identify client queue state, reducer input, committed table state, and subscription result before production changes.

- [ ] **Step 7: Commit**

```bash
git add optimizer-v2/client/e2e/reliability-module.spec.ts optimizer-v2/client/src/infrastructure/cloud optimizer-v2/spacetimedb/src/playerReducers.ts
git commit -m "test: stress cloud revisions and account isolation"
```

### Task 8: Sharing, Historical Release, and Revocation Stress

**Files:**
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/PublicDataProvider.tsx` only on reproduced failure.

**Interfaces:**
- Consumes: 100-revision build from Task 7 and exact historical snapshot resolver.
- Produces: immutable share and historical-cache retention proof.

- [ ] **Step 1: Add repeated share/revoke rows**

Create and revoke fifty distinct share IDs for one build. After each revoke, assert no public build/equipment/owned rows remain for that ID and the private build/history remains.

- [ ] **Step 2: Add immutable snapshot row**

Create a share at revision 50, advance the private build to revision 100, and assert the public share remains the revision-50 character snapshot.

- [ ] **Step 3: Add historical release arrival/rejection cases**

Assert a share shows loading until its exact release arrives, recovers when it arrives, and shows unavailable—not current advice—when the cache rejects or the release is absent.

- [ ] **Step 4: Run sharing suites**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run SharedBuildScreen.test.tsx DatasetProvider.test.tsx datasetCache.test.ts
npm run test:integration --prefix optimizer-v2
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add optimizer-v2/client/e2e/reliability-module.spec.ts optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx optimizer-v2/client/src/infrastructure/spacetime
git commit -m "test: stress immutable historical sharing"
```

### Task 9: Dataset Parser, Provenance, and Atomic Publication Stress

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/wikiProcedures.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/releaseValidation.test.ts`
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`
- Modify: `optimizer-v2/client/src/features/curation/wikiTableParser.test.ts`
- Modify only on reproduced failure: wiki parser, validation, procedure, reducer, or schema files.

**Interfaces:**
- Consumes: current allowlist, exact candidate provenance, carry-forward reducer.
- Produces: malformed-source matrix and second-release atomicity proof.

- [ ] **Step 1: Add malformed MediaWiki response table**

Cover invalid JSON, no query, zero/multiple pages, mismatched title, zero/multiple revisions, missing main slot, response above 2 MB, and control characters.

- [ ] **Step 2: Add malformed wikitext table rows**

Cover missing cells, nonnumeric stats, negative stats, duplicate headings, changed column order, unknown acquisition, and CRLF/LF variants. Assert unsafe rows become warnings and never proposals.

- [ ] **Step 3: Add publication validation table**

Cover every required formula/path, duplicate item/formula/source/candidate IDs, invalid gap grammar, wrong candidate page, mismatched revision, unaccepted candidate, missing source, and unsupported formula set.

- [ ] **Step 4: Add rollback and second-release integration**

For each invalid category, record public counts/current version before publish, expect rejection, and assert unchanged state afterward. Then carry forward the valid release, change one reviewed row, publish, and assert exactly one current release while both versions remain readable.

- [ ] **Step 5: Run parser, module, and integration tests**

Run:

```bash
npm run test:unit --prefix optimizer-v2
npm run test:integration --prefix optimizer-v2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add optimizer-v2/spacetimedb/src optimizer-v2/client/src/features/curation optimizer-v2/client/e2e/reliability-module.spec.ts
git commit -m "test: stress verified data publication"
```

### Task 10: Authentication UX and External Provider Boundaries

**Files:**
- Modify: `optimizer-v2/client/src/features/auth/SignInControl.tsx`
- Modify: `optimizer-v2/client/src/features/auth/authScreens.test.tsx`
- Modify: `optimizer-v2/client/src/features/home/HomeScreen.tsx`
- Modify: `optimizer-v2/README.md`

**Interfaces:**
- Consumes: current AuthSession and SpacetimeAuth redirect flow.
- Produces: clear magic-link/guest distinction without provider secrets.

- [ ] **Step 1: Add failing copy and behavior tests**

Assert guest mode remains fully usable, Sign in is described as optional cloud sync, anonymous SpacetimeAuth is not presented as durable registration inside the app, and auth errors explicitly preserve local builds.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run authScreens.test.tsx`

Expected: FAIL on missing explanatory copy.

- [ ] **Step 3: Implement minimal application copy**

Keep the hosted SpacetimeAuth page external. Add concise app-side text: email magic link is the configured durable method; local guest use needs no sign-in; social providers require future provider configuration. Do not display secrets or nonfunctional provider buttons.

- [ ] **Step 4: Document provider setup boundary**

List supported provider names and state that client ID/secret creation occurs in each provider console and SpacetimeAuth dashboard. Do not include example secrets.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run authScreens.test.tsx
git add optimizer-v2/client/src/features/auth optimizer-v2/client/src/features/home/HomeScreen.tsx optimizer-v2/README.md
git commit -m "fix: clarify optional authentication choices"
```

### Task 11: Findings Ledger, Performance Baseline, and Plan Amendments

**Files:**
- Create: `optimizer-v2/RELIABILITY.md`
- Modify: `optimizer-v2/scripts/run-reliability.mjs`
- Modify: this plan only when an unexpected defect requires a new repair task.

**Interfaces:**
- Consumes: all prior test outputs.
- Produces: durable table with `ID`, `severity`, `reproduction`, `root cause`, `regression`, `fix`, `status`, and measured thresholds.

- [ ] **Step 1: Record measured thresholds**

Document 1,000 optimizer iterations, 250 local builds, 100 cloud revisions, 50 share/revoke cycles, twenty route cycles, bundle chunk sizes, test durations, and browser viewports.

- [ ] **Step 2: Record every finding**

Use one row per finding. A finding is closed only when its focused regression and full relevant layer pass. External provider credentials and the Level-1 point baseline remain explicitly marked external, not silently “passed.”

- [ ] **Step 3: Amend the plan for unexpected failures**

Before changing production code for an unexpected finding, append a task containing the exact root cause, failing test code, RED command/output expectation, minimal implementation, GREEN command, layer regression command, and commit. Then execute that task.

- [ ] **Step 4: Add summary emission**

`run-reliability.mjs` prints test layer statuses and the measured thresholds, but never parses prose to decide pass/fail; child process exit codes remain authoritative.

- [ ] **Step 5: Commit**

```bash
git add optimizer-v2/RELIABILITY.md optimizer-v2/scripts/run-reliability.mjs docs/superpowers/plans/2026-08-29-sbo-rebirth-full-reliability-stress.md
git commit -m "docs: record optimizer reliability findings"
```

### Task 12: Clean Gate, Independent Review, Deployment, and Production Smoke

**Files:**
- Modify: `.github/workflows/optimizer-v2-ci.yml`
- Modify: `.github/workflows/optimizer-v2-deploy.yml`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`

**Interfaces:**
- Consumes: `npm run test:reliability` from Task 1 and all prior commits.
- Produces: reviewed main-branch deployment and read-only live evidence.

- [ ] **Step 1: Make the reliability command the single post-generation verification gate**

In both workflows, retain dependency installation, toolchain pinning, module build, binding generation, and binding-diff verification. Replace the duplicated unit/type/coverage/integration/Pages verification steps that follow with one `npm run test:reliability` step before any Maincloud publish or Pages upload. The command must use the fixed local database internally and must not receive production database credentials.

- [ ] **Step 2: Run a clean local gate**

```bash
cd optimizer-v2
npm ci
npm run check:toolchain
npm run test:reliability
git diff --exit-code -- client/src/module_bindings
```

Expected: zero failures and no generated-binding diff.

- [ ] **Step 3: Request independent code review**

Review the complete stress-pass range against the approved spec. Fix every Critical and Important issue with a new regression test before proceeding.

- [ ] **Step 4: Push the reliability branch and require green GitHub CI**

Record the successful run URL in `RELIABILITY.md`.

- [ ] **Step 5: Merge to the main integration branch and rerun the clean gate**

Do not remove the feature worktree until the merged tree passes.

- [ ] **Step 6: Deploy through `optimizer-v2-deploy.yml`**

The workflow must preserve Maincloud data, re-lock production OIDC, verify production config, test the production-shaped Pages artifact, and deploy.

- [ ] **Step 7: Perform read-only production browser QA**

Verify page identity, meaningful DOM, dataset source/version, no framework overlay, no console errors/warnings, Create Build interaction, direct Character refresh, missing-share behavior, desktop screenshot, and representative mobile layout when the browser surface supports it.

- [ ] **Step 8: Update acceptance evidence and commit**

Record exact counts, thresholds, CI/deploy links, live URL, and remaining external dependencies. This documentation-only push must also pass the guarded automatic deployment.

- [ ] **Step 9: Clean up the merged branch/worktree**

Verify it is registered under the repository `.worktrees` directory and clean before removal. Never force-delete uncommitted files.

### Task 13: Handle Draft-Save Rejection During Provider Unmount

**Finding:** Task 5 reproduced an unhandled promise rejection when `BuildDraftProvider` unmounts after a quota-limited store rejects `saveDraft`. The mounted autosave path surfaces `Draft storage failed` and preserves the in-memory draft, but the cleanup path calls `void store.saveDraft(draftRef.current)` without handling rejection.

**Files:**
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx`

**Root cause:** The effect cleanup starts an asynchronous save whose rejected promise is neither awaited nor caught, so Vitest observes an unhandled `QuotaExceededError` after all UI assertions pass.

- [ ] **Step 1: Preserve the focused RED**

The Task 5 quota regression mounts a store whose `saveDraft` rejects with `new DOMException('Storage quota exhausted', 'QuotaExceededError')`, updates the draft, verifies `Draft storage failed`, and lets Testing Library unmount during cleanup.

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run BuildDraftProvider.test.tsx`

Expected: four assertions pass, but Vitest exits nonzero with one unhandled `QuotaExceededError: Storage quota exhausted` originating from the unmount cleanup save.

- [ ] **Step 2: Add the minimal cleanup rejection handler**

Keep the best-effort unmount save, but terminate its promise chain with a rejection handler so cleanup cannot create an unhandled promise. Do not clear or replace the in-memory draft, do not add a retry loop, and do not suppress mounted autosave status reporting.

- [ ] **Step 3: Verify GREEN and the storage layer**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run BuildDraftProvider.test.tsx
npm run test:unit --workspace @sbo/optimizer-client -- --run guestBuildStore.test.ts datasetCache.test.ts pendingRevisionQueue.test.ts BuildDraftProvider.test.tsx
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS with no unhandled rejection and no loss of the in-memory Level-13 draft.

- [ ] **Step 4: Commit only the provider repair**

```bash
git add optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx
git commit -m "fix: handle draft cleanup save failures"
```

### Task 14: Reject Unsafe Control Characters in MediaWiki Revisions

**Finding:** Task 9's malformed MediaWiki matrix proved that `parseMediaWikiRevisionResponse` accepts a JSON-decoded NUL (`U+0000`) inside revision content and stages it as a valid candidate. Nine other malformed response categories reject correctly.

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/wikiRevision.ts`
- Modify: `optimizer-v2/spacetimedb/src/wikiProcedures.test.ts`

**Root cause:** `wikiRevision.ts` validates revision content only with `typeof content === 'string'`. It has no post-JSON guard for unsafe C0/DEL characters before `wikiProcedures.ts` persists the content.

- [ ] **Step 1: Preserve the focused RED**

The Task 9 matrix includes revision content `Stats\u0000fragment` and expects `MediaWiki revision fields are invalid`.

Run: `npm run test:unit --workspace @sbo/optimizer-module -- --run wikiProcedures.test.ts`

Expected: 14 pass, 1 fail because the NUL-containing revision is returned successfully.

- [ ] **Step 2: Add the minimal content guard**

Reject unsafe C0 controls and `U+007F` after JSON parsing but before returning the revision. Preserve legitimate wikitext whitespace: horizontal tab (`U+0009`), line feed (`U+000A`), and carriage return (`U+000D`) remain allowed. Do not normalize or rewrite revision content.

- [ ] **Step 3: Verify focused and module regressions**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-module -- --run wikiProcedures.test.ts
npm run test:unit --workspace @sbo/optimizer-module
npm run typecheck --workspace @sbo/optimizer-module
```

Expected: PASS, including explicit acceptance coverage for tab/LF/CR wikitext whitespace.

- [ ] **Step 4: Commit only the parser repair and its matrix**

```bash
git add optimizer-v2/spacetimedb/src/wikiRevision.ts optimizer-v2/spacetimedb/src/wikiProcedures.test.ts
git commit -m "fix: reject unsafe wiki revision controls"
```

### Task 15: Enforce Optimization Readiness at Every Entry Point

**Findings:** The final branch review proved that screen-only validation can be bypassed by shared/cloud profiles, optional weapon-skill input bypasses numeric validation, and a valid under-budget profile with fewer than thirty remaining stat slots can throw during allocation.

**Files:**
- Create or modify: `optimizer-v2/client/src/domain/optimizer/planReadiness.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Modify: `optimizer-v2/client/src/features/planner/CharacterScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/StatsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.tsx`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`

**Interfaces:**
- Produces a pure typed readiness result for `overspent` and `insufficient-stat-capacity` states.
- `optimizeBuild` must reject any non-ready profile before equipment recommendation or stat allocation.
- Results and shared-build views render a stable unavailable/explanation state rather than throwing.

- [ ] **Step 1: Add focused RED domain/UI tests**

Cover a Level-8 profile with 25 invested points, a Level-834 profile with all five stats at 500, and shared equivalents. Assert no authoritative recommendation is rendered and no React error escapes.

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run optimizeBuild.test.ts ResultsScreen.test.tsx SharedBuildScreen.test.tsx`

Expected: FAIL because overspent optimization continues and exhausted capacity throws.

- [ ] **Step 2: Add RED weapon-skill input rows**

Assert negative, fractional, nonnumeric/blank transitions, and values above 10000 do not enter the draft or navigate. Blank remains the valid optional omitted state. Invalid nonblank input retains `/character`, focuses Weapon Skill, and exposes an alert.

- [ ] **Step 3: Implement the minimal readiness and raw-input guards**

Preserve the current `level * pointsPerLevel` rule. A thirty-point plan requires at least thirty remaining stat slots across the five `0..500` stats. Do not clamp, silently discard, or redistribute points. Keep the optional skill bound aligned with `characterProfileSchema` (`0..10000`, integer).

- [ ] **Step 4: Verify focused/full client tests**

Run the focused suites, full client unit tests, and client typecheck.

- [ ] **Step 5: Commit**

```bash
git add optimizer-v2/client/src/domain/optimizer optimizer-v2/client/src/features/planner optimizer-v2/client/src/features/results optimizer-v2/client/src/features/share
git commit -m "fix: enforce optimization readiness boundaries"
```

### Task 16: Enforce Canonical Provenance in the Runtime Dataset Schema

**Finding:** The runtime client schema accepts any HTTPS source and optional revisions, so a corrupt cached row can claim `verified` and still drive advice even though publication and release-coverage validators are stricter.

**Files:**
- Modify: `optimizer-v2/client/src/domain/dataset/model.ts`
- Modify: `optimizer-v2/client/src/domain/dataset/schema.ts`
- Modify: `optimizer-v2/client/src/domain/dataset/schema.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts`
- Modify as needed: shared client-side provenance helper used by stress fixtures/schema.

- [ ] **Step 1: Add RED schema/cache cases**

Reject verified equipment/formulas/gaps with `https://example.com`, missing/blank revisions, a noncanonical wiki host/path, and an owner-attestation URL/revision on any formula except `points-per-level`. Accept the canonical Fandom wiki pattern plus the exact Roblox game URL only with `owner-gameplay-attestation:YYYY-MM-DD` for `points-per-level`.

- [ ] **Step 2: Implement one runtime provenance contract**

Make equipment/formula `sourceRevision` required in the model/schema. Apply the same canonical wiki, exact game URL, and owner-attestation rules already enforced by release validation. Do not weaken the verified dataset bundled release.

- [ ] **Step 3: Prove corrupt cache isolation**

Insert a structurally complete arbitrary-HTTPS `verified` cached release and assert it is rejected/isolated while a valid canonical neighbor remains readable.

- [ ] **Step 4: Verify and commit**

Run schema/cache/stress fixtures, full client unit tests, release coverage, and typecheck.

```bash
git add optimizer-v2/client/src/domain/dataset optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts optimizer-v2/client/src/test
git commit -m "fix: enforce runtime dataset provenance"
```

### Task 17: Preserve Unknown-Skill Confirmation Across Combined Requirements

**Finding:** `classifyCandidate` returns a level-only reason before checking omitted weapon skill, so a future-level skill-gated target loses the required `confirm in game` precision warning.

**Files:**
- Modify: `optimizer-v2/client/src/domain/optimizer/eligibility.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/eligibility.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`

- [ ] **Step 1: Add RED combined-requirement rows**

For an item within the ten-level window whose level and weapon-skill requirements are both unmet and `weaponSkill` is omitted, assert it remains future-only and its note includes both the level requirement and `Requires Weapon Skill N; confirm in game`. Cover the Dual Wield gate when combined with future level.

- [ ] **Step 2: Implement ordered requirement aggregation**

Keep hard ineligibility rules unchanged. For eligible future candidates, collect the level and applicable skill reasons before returning. Do not mark any unknown-skill item immediate or drop `confirm in game`.

- [ ] **Step 3: Verify and commit**

Run eligibility/optimizer/Results suites, full client unit tests, and typecheck.

```bash
git add optimizer-v2/client/src/domain/optimizer optimizer-v2/client/src/features/results/ResultsScreen.test.tsx
git commit -m "fix: retain combined skill eligibility notes"
```

### Task 18: Exercise True Same-Parent Concurrent Cloud Edits

**Finding:** The existing two-connection test alternates awaited reducer calls and never submits simultaneous edits from the same head, leaving latest-edit/full-history race behavior unproven.

**Files:**
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`
- Modify only on reproduced failure: cloud reducer/repository files through a separate appended repair task.

- [ ] **Step 1: Add a real concurrent RED/coverage row**

From two live connections sharing one identity, read the same current head and submit two distinct revision IDs/payloads without awaiting either first (`Promise.allSettled`). Assert both calls complete according to the intended latest-edit contract, both immutable revisions and child rows remain in history with the same parent, and the final head is exactly one of the two committed revisions with matching profile data.

- [ ] **Step 2: Repeat deterministic race coverage**

Run enough isolated pairs to exercise scheduling without assuming which valid edit wins. Use condition polling and exact count deltas; no sleeps or timeout inflation.

- [ ] **Step 3: Stop on a product defect**

If a revision is lost, child rows mismatch, or head points outside the committed pair, preserve table/reducer evidence and append a separate repair task before production changes.

- [ ] **Step 4: Verify and commit**

Run fixed-local integration and typecheck.

```bash
git add optimizer-v2/client/e2e/reliability-module.spec.ts
git commit -m "test: race same-parent cloud revisions"
```

### Task 19: Force a Fresh Fixed-Local Browser Server

**Finding:** Playwright reuses any process on port 4173 outside CI, so the reliability command can unknowingly exercise a stale production-configured dev server instead of the fixed-local environment.

**Files:**
- Modify: `optimizer-v2/client/playwright.config.ts`
- Create or modify: focused Playwright configuration test.
- Modify only if required: `optimizer-v2/scripts/run-local-integration.mjs`

- [ ] **Step 1: Add RED configuration proof**

Assert the integration Playwright config never reuses an existing server and always starts the app with the fixed loopback URI/test database. Prove an occupied app port fails closed rather than being reused.

- [ ] **Step 2: Force fresh-server behavior**

Set `reuseExistingServer: false` for the integration config. If an explicit port preflight is needed, reject occupied `127.0.0.1:4173` without connecting to or terminating the unknown process.

- [ ] **Step 3: Verify and commit**

Run the focused config test, fixed-local integration, Pages tests, and typecheck.

```bash
git add optimizer-v2/client/playwright.config.ts optimizer-v2/client/src/test optimizer-v2/scripts/run-local-integration.mjs
git commit -m "test: force fresh local browser server"
```

### Task 20: Reconcile Final Review Repairs and Rerun the Clean Gate

**Files:**
- Modify: `optimizer-v2/RELIABILITY.md`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/scripts/run-reliability.mjs` only when measured counts/chunks changed.

- [ ] **Step 1: Record all final-review findings**

Add the seven Critical/Important findings, their focused regressions/fixes/status, and the true-concurrency/fresh-server measurements. Do not erase prior findings or close unverified external dependencies.

- [ ] **Step 2: Run a fresh clean gate**

```bash
cd optimizer-v2
npm ci
npm run check:toolchain
npm run test:reliability
git diff --exit-code -- client/src/module_bindings
```

- [ ] **Step 3: Update exact evidence and commit**

Record test counts, timings, binding result, and any bundle-size changes without claiming CI/deploy/live success.

```bash
git add optimizer-v2/RELIABILITY.md optimizer-v2/ACCEPTANCE.md optimizer-v2/scripts/run-reliability.mjs
git commit -m "docs: reconcile final reliability review"
```

- [ ] **Step 4: Repeat whole-branch independent review**

All Critical/Important findings must be closed before requesting owner authorization for push/deploy.
