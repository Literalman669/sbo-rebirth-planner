# SBO:Rebirth QOL Release 2 Progress Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the existing Progress navigation with a build-scoped, offline-first dashboard that reconciles verified planner facts automatically, preserves manual journey history, and provides an optional verified-price Col budget.

**Architecture:** Advance `PlanProgress` to a strictly validated v2 contract, then keep task generation, reconciliation, and shopping arithmetic in deterministic domain modules. Extend the existing planner-state, IndexedDB, portable-backup, and SpacetimeDB boundaries instead of adding a parallel persistence system; expose the feature through a lazy `/progress` route composed from focused cards.

**Tech Stack:** React 19, TypeScript 7, React Router 7, Zod 4, IndexedDB via `idb`, SpacetimeDB 2.8.3, Vitest, Testing Library, Playwright, axe-core, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-01-sbo-qol-release-2-progress-dashboard-design.md`

## Global Constraints

- Keep SpacetimeDB CLI, npm SDK, module package, generated bindings, CI, and documentation pinned to 2.8.3.
- `/progress` defaults to the active build; inspecting `?build=<id>&source=<local|cloud>` must not replace the active draft.
- Use only verified dataset facts. Unknown prices and unavailable historical datasets remain explicit and are never guessed.
- Progress-only changes must not enter `fingerprintRecommendationInput` or invoke optimization after wallet, note, filter, disclosure, complete, skip, or reopen changes.
- Cap each build at 200 objective states and 1,000 detailed history events; reject overflow without silent truncation.
- Current Col is an optional non-negative JavaScript safe integer. Checking a task never deducts Col or mutates Inventory automatically.
- Preserve every valid v1 field; legacy events have unknown time rather than an invented timestamp.
- Public shares remain unchanged and receive no wallet, note, history, or owner data.
- Maintain local-first operation, sender identity, idempotent reconnect, strict portable validation, and atomic imports.
- Support keyboard/touch, reduced motion, zero serious/critical axe violations, and no document overflow at 1440x1000, 768x1024, 390x844, and 320x700.
- Keep `/progress` route-split when the production build emits a practical separate chunk.
- Preserve the user's unrelated root `.playwright-mcp/` directory.

---

### Task 1: PlanProgress v2 Model, Schema, and Migration

**Files:**
- Create: `optimizer-v2/client/src/domain/progress/model.ts`
- Create: `optimizer-v2/client/src/domain/progress/schema.ts`
- Create: `optimizer-v2/client/src/domain/progress/schema.test.ts`
- Modify: `optimizer-v2/client/src/domain/planner/state.ts`
- Modify: `optimizer-v2/client/src/domain/planner/stateSchema.ts`
- Modify: `optimizer-v2/client/src/domain/planner/stateSchema.test.ts`

**Interfaces:**
- Produces the progress enums, `ProgressObjectiveState`, `ProgressHistoryEvent`, `ProgressWallet`, and `PlanProgress`.
- Produces `MAX_PROGRESS_OBJECTIVES = 200`, `MAX_PROGRESS_HISTORY = 1000`, `planProgressSchema`, `createEmptyPlanProgress(buildId)`, and `migratePlanProgress(raw)`.
- Planner state files re-export the v2 API so existing imports continue to compile.

- [ ] **Step 1: Write failing v2 schema and v1 migration tests**

Cover strict keys, enum rejection, unique IDs/action keys, 200/1,000 caps, safe
Col, timestamp rules, invalid controls, legacy unknown time, and preservation of
`reconciledThroughLevel` plus `acknowledgedDatasetVersion`.

```ts
const migrated = migratePlanProgress({
  schemaVersion: 1,
  buildId: 'route-a',
  completedActionIds: ['spend-stats:level:8'],
  dismissedRecommendationIds: ['equipment:armor:fields-warrior'],
  reconciledThroughLevel: 8,
  acknowledgedDatasetVersion: '2026.08.30.1',
});
expect(migrated.schemaVersion).toBe(2);
expect(migrated.history[0]).toMatchObject({ source: 'legacy', occurredAt: undefined });
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress/schema.test.ts src/domain/planner/stateSchema.test.ts
```

Expected: FAIL because the progress domain and v2 migration do not exist.

- [ ] **Step 3: Implement the exact v2 types**

```ts
export type ProgressTaskCategory =
  | 'stat-allocation' | 'equipment-upgrade' | 'level-milestone'
  | 'floor-milestone' | 'manual-objective';
export type ProgressObjectiveStatus = 'pending' | 'completed' | 'skipped';
export type ProgressEventOutcome = 'completed' | 'skipped' | 'reopened' | 'superseded';
export type ProgressEventSource = 'automatic' | 'manual' | 'legacy';
export interface ProgressObjectiveState {
  actionKey: string;
  category: ProgressTaskCategory;
  status: ProgressObjectiveStatus;
  source: ProgressEventSource;
  planFingerprint: string;
  updatedAt?: string;
  note?: string;
}
export interface ProgressHistoryEvent {
  id: string;
  actionKey: string;
  category: ProgressTaskCategory;
  label: string;
  outcome: ProgressEventOutcome;
  source: ProgressEventSource;
  planFingerprint: string;
  datasetVersion?: string;
  occurredAt?: string;
  note?: string;
}
export interface ProgressWallet { balance: number; updatedAt: string }
export interface PlanProgress {
  schemaVersion: 2;
  buildId: string;
  wallet?: ProgressWallet;
  objectives: ProgressObjectiveState[];
  history: ProgressHistoryEvent[];
  currentPlanFingerprint?: string;
  reconciledThroughLevel?: number;
  acknowledgedDatasetVersion?: string;
}
```

- [ ] **Step 4: Implement strict validation and deterministic migration**

`planProgressSchema` accepts only v2. `migratePlanProgress` accepts v1 or v2,
returns deep v2 data, derives stable legacy IDs from build/action/outcome, and
never invents `occurredAt` or `updatedAt`.

```ts
export function createEmptyPlanProgress(buildId: string): PlanProgress {
  return { schemaVersion: 2, buildId, objectives: [], history: [] };
}
```

- [ ] **Step 5: Run schema and existing planner-state regressions**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress/schema.test.ts src/domain/planner/stateSchema.test.ts src/app/providers/PlannerStateProvider.test.tsx src/infrastructure/storage/guestBuildStore.test.ts
```

Expected: PASS after existing fixtures normalize to v2.

- [ ] **Step 6: Commit the progress contract**

```bash
git add optimizer-v2/client/src/domain/progress optimizer-v2/client/src/domain/planner
git commit -m "feat: define versioned progress history"
```

---

### Task 2: Deterministic Task Generation and Reconciliation

**Files:**
- Create: `optimizer-v2/client/src/domain/progress/tasks.ts`
- Create: `optimizer-v2/client/src/domain/progress/tasks.test.ts`
- Create: `optimizer-v2/client/src/domain/progress/reconcile.ts`
- Create: `optimizer-v2/client/src/domain/progress/reconcile.test.ts`
- Modify: `optimizer-v2/client/src/domain/results/actionChecklist.ts`
- Modify: `optimizer-v2/client/src/domain/results/actionChecklist.test.ts`

**Interfaces:**
- Consumes Task 1, `CharacterProfile`, `DatasetSnapshot`, `RecommendationPlan`, `PlanAction`, and `fingerprintRecommendationInput`.
- Produces `ProgressTask`, `generateProgressTasks(profile, plan, dataset, planFingerprint)`, `isProgressTaskAutomaticallyComplete(task, profile)`, `reconcileProgress(input)`, and `setManualTaskState(input)`.
- Reconciliation returns `{ progress, activeTasks, newlyCompleted, superseded }` with injected clock/UUID functions.

- [ ] **Step 1: Write failing task-generation tests**

Prove stable keys, stat targets, item/source/cost preservation, one basic
next-floor manual milestone, and no input mutation.

```ts
const tasks = generateProgressTasks(profile, plan, fallbackRelease, 'plan-abcd');
expect(tasks.find((task) => task.category === 'stat-allocation')).toMatchObject({
  actionKey: 'spend-stats:level:9',
  planFingerprint: 'plan-abcd',
  targetLevel: 9,
  targetStats: expect.any(Object),
});
expect(tasks.find((task) => task.category === 'floor-milestone')).toMatchObject({
  actionKey: `floor:unlock:${profile.maxFloor + 1}`,
  automatic: false,
});
```

- [ ] **Step 2: Write failing reconciliation tests**

Cover automatic level/stat/equipped/owned/floor completion, manual transitions,
notes, superseding unfinished tasks, duplicate-event prevention, limits, and
same-input idempotence.

```ts
const first = reconcileProgress({
  profile: { ...profile, level: 9 },
  progress: createEmptyPlanProgress(profile.id),
  tasks,
  planFingerprint: 'plan-abcd',
  datasetVersion: fallbackRelease.version,
  now: () => '2026-09-01T12:00:00.000Z',
  randomUUID: () => 'event-1',
});
const second = reconcileProgress({ ...input, progress: first.progress });
expect(first.newlyCompleted).toHaveLength(1);
expect(second.newlyCompleted).toHaveLength(0);
expect(second.progress.history).toHaveLength(first.progress.history.length);
```

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress/tasks.test.ts src/domain/progress/reconcile.test.ts src/domain/results/actionChecklist.test.ts
```

Expected: FAIL because target metadata and reconciliation do not exist.

- [ ] **Step 4: Extend PlanAction with optimizer-safe targets**

```ts
export interface ProgressTask extends PlanAction {
  actionKey: string;
  category: ProgressTaskCategory;
  planFingerprint: string;
  automatic: boolean;
  targetLevel?: number;
  targetFloor?: number;
  targetStats?: CharacterStats;
}
```

Add target metadata without changing Results copy or ordering.

- [ ] **Step 5: Implement task generation and automatic predicates**

Owned acquisition requires canonical ownership; equip requires the correct slot.
Floor unlock remains manual until `maxFloor` advances, then reconciliation
records automatic completion.

- [ ] **Step 6: Implement reconciliation and manual transition helpers**

```ts
export function setManualTaskState(input: {
  progress: PlanProgress;
  task: ProgressTask;
  status: 'completed' | 'skipped' | 'pending';
  note?: string;
  now: () => string;
  randomUUID: () => string;
}): PlanProgress;
```

Reopen records `reopened`; supersede only unfinished objectives absent from the
new generated task set.

- [ ] **Step 7: Run domain, Results, and fingerprint regressions**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress src/domain/results/actionChecklist.test.ts src/domain/optimizer/planFingerprint.test.ts src/features/results/ResultsScreen.test.tsx
```

Expected: PASS with Results/fingerprint behavior unchanged.

- [ ] **Step 8: Commit deterministic planning**

```bash
git add optimizer-v2/client/src/domain/progress optimizer-v2/client/src/domain/results
git commit -m "feat: reconcile deterministic progress tasks"
```

---

### Task 3: Shopping Budget and Next-Move Selection

**Files:**
- Create: `optimizer-v2/client/src/domain/progress/shopping.ts`
- Create: `optimizer-v2/client/src/domain/progress/shopping.test.ts`
- Create: `optimizer-v2/client/src/domain/progress/priority.ts`
- Create: `optimizer-v2/client/src/domain/progress/priority.test.ts`

**Interfaces:**
- Consumes `ProgressTask` and optional `ProgressWallet`.
- Produces `ShoppingPlanEntry`, `ShoppingPlan`, `buildShoppingPlan(tasks, wallet?)`, and `selectNextProgressTask(tasks, shoppingPlan)`.
- Mixed known currencies are unsupported rather than incorrectly summed.

- [ ] **Step 1: Write failing shopping tests**

Cover exact totals, unknown counts, absent wallet, exact affordability, remaining
Col, mixed currency, and safe-integer overflow.

```ts
expect(buildShoppingPlan(tasks, { balance: 10_000, updatedAt: now })).toMatchObject({
  currency: 'Col',
  knownTotal: 14_840,
  unknownPriceCount: 1,
  remainingNeeded: 4_840,
  affordability: 'needs-more',
});
```

- [ ] **Step 2: Write failing priority tests**

Assert current stat spending, owned equip-now, eligible verified purchase,
next-level allocation, then manual floor/acquisition. Equal priorities retain
deterministic task order.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress/shopping.test.ts src/domain/progress/priority.test.ts
```

Expected: FAIL because the modules are absent.

- [ ] **Step 4: Implement shopping projection**

```ts
export interface ShoppingPlan {
  entries: ShoppingPlanEntry[];
  currency?: string;
  knownTotal: number;
  unknownPriceCount: number;
  affordability: 'unknown' | 'affordable' | 'needs-more' | 'unsupported';
  remainingNeeded?: number;
}
```

Use checked safe-integer addition; unknown price is never displayed as zero.

- [ ] **Step 5: Implement explicit next-move selection**

Use a stable predicate chain, not a score, and return `ProgressTask | null`.

- [ ] **Step 6: Run all progress-domain tests and commit**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/progress
git add optimizer-v2/client/src/domain/progress
git commit -m "feat: project progress shopping and priorities"
```

Expected: PASS, followed by the focused domain commit.

---

### Task 4: Local Persistence and Arbitrary-Build Progress Operations

**Files:**
- Modify: `optimizer-v2/client/src/app/providers/PlannerStateContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/PlannerStateProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/PlannerStateProvider.test.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts`

**Interfaces:**
- Consumes Tasks 1–2.
- Adds `loadProgressForBuild(buildId)`, `saveProgressForBuild(progress)`, and `resetProgressForBuild(buildId)` to `PlannerStateContextValue`.
- Existing active-draft `progress`, `updateProgress`, and `resetProgress` delegate to the new methods.

- [ ] **Step 1: Write failing store tests for v1 reads and v2 writes**

Seed a v1 row in the existing `plan-progress` store, load it as v2, save it,
and prove the stored form is strict v2. Invalid rows must use existing recovery
behavior rather than disappear.

- [ ] **Step 2: Write failing provider tests for another saved build**

```tsx
await act(() => result.current.saveProgressForBuild({
  ...createEmptyPlanProgress('saved-build'),
  wallet: { balance: 9000, updatedAt: '2026-09-01T12:00:00.000Z' },
}));
expect(result.current.progress.buildId).toBe('active-build');
expect(draft.id).toBe('active-build');
```

Also prove no undo/fingerprint mutation.

- [ ] **Step 3: Run store/provider tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/guestBuildStore.test.ts src/infrastructure/storage/plannerDatabase.test.ts src/app/providers/PlannerStateProvider.test.tsx
```

Expected: FAIL because arbitrary-build operations are absent.

- [ ] **Step 4: Normalize every progress read and validate every write**

Keep IndexedDB v6 and the existing store. Run `migratePlanProgress` on reads and
strict v2 parsing before every write/import transaction.

- [ ] **Step 5: Extend PlannerStateProvider without duplicating state**

```ts
async function saveProgressForBuild(next: PlanProgress) {
  const valid = planProgressSchema.parse(next);
  await store.savePlanProgress(valid);
  if (valid.buildId === draftRef.current.id) {
    progressRef.current = valid;
    setProgress(valid);
  }
}
```

Preserve storage-error and blocked-upgrade notices.

- [ ] **Step 6: Run persistence/provider/fingerprint regressions**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/PlannerStateProvider.test.tsx src/app/providers/BuildDraftProvider.test.tsx src/infrastructure/storage/guestBuildStore.test.ts src/domain/optimizer/planFingerprint.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit local progress operations**

```bash
git add optimizer-v2/client/src/app/providers/PlannerStateContext.ts optimizer-v2/client/src/app/providers/PlannerStateProvider.tsx optimizer-v2/client/src/app/providers/PlannerStateProvider.test.tsx optimizer-v2/client/src/infrastructure/storage
git commit -m "feat: persist build progress history locally"
```

---

### Task 5: SpacetimeDB v2 Validation and Convergent Merge

**Files:**
- Create: `optimizer-v2/spacetimedb/src/progressMerge.ts`
- Create: `optimizer-v2/spacetimedb/src/progressMerge.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/plannerState.test.ts`

**Interfaces:**
- Produces `parseAndValidatePlanProgressJson(value, expectedBuildId)` and `mergePlanProgress(current, incoming)`.
- Keeps `upsertPlanProgress({ buildId, progressJson })` unchanged.
- History merges by immutable ID; objective/wallet state resolves by explicit timestamps.

- [ ] **Step 1: Write failing server validation tests**

Cover v1 rollout acceptance, strict v2 keys, safe Col, enums, unique IDs,
200/1,000 caps, text/control limits, build-ID match, and byte limit.

- [ ] **Step 2: Write failing merge tests**

Prove event union, identical retry, conflicting same-ID rejection,
timestamp-based state, legacy migration, order independence, post-merge limits,
and no input mutation.

```ts
const leftRight = mergePlanProgress(left, right);
const rightLeft = mergePlanProgress(right, left);
expect(leftRight).toEqual(rightLeft);
expect(leftRight.history.map((event) => event.id).sort()).toEqual(['event-a', 'event-b']);
```

- [ ] **Step 3: Run module tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-module -- --run src/progressMerge.test.ts src/validation.test.ts src/plannerState.test.ts
```

Expected: FAIL because server v2 parsing/merge is absent.

- [ ] **Step 4: Implement parsing and canonical serialization**

Reuse server safe-text utilities. Sort objectives by `actionKey` and history by
`occurredAt ?? ''`, then `id`, so identical state serializes identically.

- [ ] **Step 5: Merge inside the protected reducer**

```ts
const incoming = parseAndValidatePlanProgressJson(progressJson, buildId);
const existing = current
  ? parseAndValidatePlanProgressJson(current.progressJson, buildId)
  : undefined;
const mergedJson = JSON.stringify(mergePlanProgress(existing, incoming));
```

Keep sender ownership authoritative and identical merged retries as no-ops.

- [ ] **Step 6: Run module suite, typecheck, and build**

```bash
npm run test:unit --workspace @sbo/optimizer-module
npm run typecheck --workspace @sbo/optimizer-module
cd spacetimedb
spacetime build
```

Expected: PASS.

- [ ] **Step 7: Commit convergent server progress**

```bash
git add optimizer-v2/spacetimedb/src
git commit -m "feat: merge private progress history in spacetime"
```

---

### Task 6: Cloud Client, Queue, and Cross-Device Recovery

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.test.tsx`
- Modify: `optimizer-v2/client/e2e/cloud-module.spec.ts`

**Interfaces:**
- Consumes v2 progress and unchanged reducer signature.
- Produces normalized `cloudPlanProgress`; queue writes canonical v2 and retains failed work for retry.
- Verifies two same-account subscriptions converge while cross-identity access remains impossible.

- [ ] **Step 1: Write failing mapper/repository/queue tests**

Cover v1 row normalization, v2 serialization, offline retention, reconnect,
identical retry, and preservation of new server history after a stale queue.

- [ ] **Step 2: Extend cloud-module e2e with two-device races**

```ts
await Promise.all([
  deviceA.connection.reducers.upsertPlanProgress({
    buildId,
    progressJson: JSON.stringify(progressWithEventA),
  }),
  deviceB.connection.reducers.upsertPlanProgress({
    buildId,
    progressJson: JSON.stringify(progressWithEventB),
  }),
]);
await expect.poll(() => deviceAProgress().history.length).toBe(2);
await expect.poll(() => deviceBProgress().history.length).toBe(2);
```

Also reject cross-identity writes and conflicting event-ID reuse.

- [ ] **Step 3: Run focused cloud tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud/buildMappers.test.ts src/infrastructure/cloud/buildRepository.test.ts src/infrastructure/cloud/pendingPlannerStateQueue.test.ts src/app/providers/CloudBuildsProvider.test.tsx
```

Expected: FAIL on v2 fixtures/convergence.

- [ ] **Step 4: Normalize reads and canonicalize queued writes**

Every boundary calls `migratePlanProgress`; queued JSON is strict v2. Progress
actions never manufacture build revisions or alter recommendation fingerprints.

- [ ] **Step 5: Preserve local-first arbitrary-build sync**

The Progress route saves locally first, then calls the cloud repository only
for authenticated cloud/local+cloud entries and announces exactly one of
`saved-local`, `sync-queued`, `synced`, or `error`.

- [ ] **Step 6: Regenerate bindings and prove cleanliness**

```bash
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code -- client/src/module_bindings
```

Expected: no signature diff because schema/reducer arguments are unchanged.

- [ ] **Step 7: Run cloud units and fixed-local integration**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud src/app/providers/CloudBuildsProvider.test.tsx
npm run test:integration
```

Expected: PASS across units and four isolated phases.

- [ ] **Step 8: Commit cloud convergence**

```bash
git add optimizer-v2/client/src/infrastructure/cloud optimizer-v2/client/src/app/providers optimizer-v2/client/e2e/cloud-module.spec.ts optimizer-v2/client/src/module_bindings
git commit -m "feat: sync progress history across devices"
```

---

### Task 7: Progress Route, Build Switcher, and Orchestration

**Files:**
- Create: `optimizer-v2/client/src/features/progress/ProgressScreen.tsx`
- Create: `optimizer-v2/client/src/features/progress/ProgressScreen.test.tsx`
- Create: `optimizer-v2/client/src/features/progress/ProgressBuildSwitcher.tsx`
- Create: `optimizer-v2/client/src/features/progress/useProgressDashboard.ts`
- Create: `optimizer-v2/client/src/features/progress/useProgressDashboard.test.tsx`
- Modify: `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx`
- Modify: `optimizer-v2/client/src/features/shell/shell.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/app/App.test.tsx`

**Interfaces:**
- Consumes unified build library, dataset resolver, optimizer, Tasks 1–4, and optional cloud state.
- Produces lazy `/progress` and `useProgressDashboard()` with profile/source/dataset/tasks/progress/shopping/next move/status/mutations.
- Query contract is `?build=<id>&source=<local|cloud>`; absence means active draft.

- [ ] **Step 1: Write failing navigation/router tests**

Assert Progress becomes an enabled link, direct `/progress` lazy-loads, Pages
basename survives, and route focus/scroll matches other workspaces.

- [ ] **Step 2: Write failing switcher and hook tests**

Cover active default, mirror dedupe, source-qualified query, archive/preset
labels, missing selection, unavailable historical dataset, and no draft replace.

```tsx
await user.selectOptions(screen.getByLabelText('View progress for'), 'saved-a');
expect(mockReplaceDraft).not.toHaveBeenCalled();
expect(history.location.search).toContain('build=saved-a');
```

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/App.test.tsx src/features/shell/shell.test.tsx src/features/progress
```

Expected: FAIL because Progress is disabled and route/hook are absent.

- [ ] **Step 4: Implement lazy route and navigation**

```tsx
const ProgressScreen = lazy(() =>
  import('../features/progress/ProgressScreen').then((module) => ({
    default: module.ProgressScreen,
  })),
);
```

Use a Progress fallback and preserve route-shell scroll/focus reset.

- [ ] **Step 5: Implement non-mutating selection and dataset resolution**

Resolve active draft or selected library entry, exact dataset, fingerprint,
optimizer result, tasks, reconciliation, and explicit Load into Planner.

- [ ] **Step 6: Implement save/sync orchestration**

Manual updates save locally, then optionally cloud-sync source-qualified entries.
Reconciliation persists only when its canonical v2 output changes.

- [ ] **Step 7: Run route/hook/shell tests and commit**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/progress src/features/shell/shell.test.tsx src/app/App.test.tsx
git add optimizer-v2/client/src/features/progress optimizer-v2/client/src/features/shell optimizer-v2/client/src/app
git commit -m "feat: add routed progress workspace"
```

Expected: PASS, followed by the route commit.

---

### Task 8: Dashboard Cards, Manual Actions, and Responsive Styling

**Files:**
- Create: `optimizer-v2/client/src/features/progress/ProgressContextHeader.tsx`
- Create: `optimizer-v2/client/src/features/progress/NextMoveCard.tsx`
- Create: `optimizer-v2/client/src/features/progress/ProgressChecklist.tsx`
- Create: `optimizer-v2/client/src/features/progress/ShoppingPlan.tsx`
- Create: `optimizer-v2/client/src/features/progress/FloorMilestones.tsx`
- Create: `optimizer-v2/client/src/features/progress/JourneyHistory.tsx`
- Create: `optimizer-v2/client/src/features/progress/progressComponents.test.tsx`
- Create: `optimizer-v2/client/src/styles/progress.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Modify: `optimizer-v2/client/src/features/progress/ProgressScreen.tsx`
- Modify: `optimizer-v2/client/src/features/progress/ProgressScreen.test.tsx`

**Interfaces:**
- Consumes Task 7 view model; components receive typed props and never parse raw dataset/storage/cloud rows.
- Produces next move, five-item grouped route, wallet/shopping, floor milestones, and filtered/collapsed history.

- [ ] **Step 1: Write failing component tests**

Cover priority reason/link, five-item default, expansion, complete/skip/reopen/
note, wallet clear/edit, affordability, prices/links, floor boundaries, history
filters, legacy unknown time, status announcements, and cap recovery.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/progress/progressComponents.test.tsx src/features/progress/ProgressScreen.test.tsx
```

Expected: FAIL because cards do not exist.

- [ ] **Step 3: Implement context and next-move regions**

Use regions/headings. Label completion `Checklist progress`, never power,
strength, or readiness.

- [ ] **Step 4: Implement checklist controls and notes**

Complete, Skip, Reopen call typed transitions. Note save is explicit. Mark owned
navigates to Inventory without mutating ownership automatically.

- [ ] **Step 5: Implement shopping and floor cards**

Render `Price not verified`, known total, unknown count, affordability, exact
wiki sources, `maxFloor`, accessible sources, item eligibility, and manual next
floor unlock only.

- [ ] **Step 6: Implement bounded journey history**

Default collapsed; date-group timestamped events and put legacy entries under
`Before progress history`. Provide filters and confirmed reset. At limits keep
state and show Export/Reset choices.

- [ ] **Step 7: Implement progress.css**

```css
.progress-screen {
  display: grid;
  width: min(calc(100% - 2rem), var(--content-width));
  gap: 1rem;
  margin: 2rem auto 4rem;
}
@media (max-width: 48rem) {
  .progress-dashboard-grid { grid-template-columns: 1fr; }
}
```

Reuse parchment/brass/aether tokens, touch targets, focus, and reduced motion.

- [ ] **Step 8: Run rendered progress and shell tests**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/progress src/features/shell/shell.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit dashboard UI**

```bash
git add optimizer-v2/client/src/features/progress optimizer-v2/client/src/styles
git commit -m "feat: render actionable progress dashboard"
```

---

### Task 9: Portable Progress and Deletion Recovery

**Files:**
- Modify: `optimizer-v2/client/src/domain/build/portable.ts`
- Modify: `optimizer-v2/client/src/domain/build/portable.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.test.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildImportDialog.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildPortableDialogs.test.tsx`

**Interfaces:**
- Consumes v2 validator/migrator; keeps outer portable envelope schema version 1.
- Exports normalized v2; imports nested v1/v2 and rewrites progress `buildId` for duplicates.
- Deletion explicitly includes local progress and leaves Export available first.

- [ ] **Step 1: Write failing portable round-trip tests**

Cover nested v1 migration, v2 wallet/objective/history, duplicate ID rewrite,
privacy-extra-key rejection, 200/1,000 limits, overwrite, and rollback.

- [ ] **Step 2: Write failing deletion recovery tests**

Prove deletion removes its progress in the same transaction, offers Export, and
does not remove another build's progress.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/portable.test.ts src/infrastructure/storage/guestBuildStore.test.ts src/features/builds/BuildsScreen.test.tsx src/features/builds/BuildPortableDialogs.test.tsx
```

Expected: FAIL until normalization/deletion copy are updated.

- [ ] **Step 4: Normalize nested progress at the portable boundary**

Exports always emit v2. Parsing maps valid nested v1 through migration. Duplicate
import rewrites only container `buildId`; immutable action/event IDs remain.

- [ ] **Step 5: Make local deletion atomic and explicit**

Use one transaction over `builds`, `build-revisions`, and `plan-progress`.
Confirmation says the saved copy and progress history leave this device.

- [ ] **Step 6: Run regressions and commit**

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/portable.test.ts src/infrastructure/storage/guestBuildStore.test.ts src/features/builds
git add optimizer-v2/client/src/domain/build/portable.ts optimizer-v2/client/src/domain/build/portable.test.ts optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts optimizer-v2/client/src/features/builds
git commit -m "feat: preserve progress in build recovery"
```

Expected: PASS, followed by the recovery commit.

---

### Task 10: E2E, Accessibility, Reliability, Acceptance, and Deployment

**Files:**
- Create: `optimizer-v2/client/e2e/progress-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/qol-accessibility.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/cloud-module.spec.ts`
- Modify: `optimizer-v2/client/e2e-pages/deep-links.spec.ts`
- Modify: `optimizer-v2/scripts/integration-phase-plan.mjs`
- Modify: `optimizer-v2/scripts/integration-phase-plan.test.mjs`
- Modify: `optimizer-v2/scripts/run-reliability.mjs`
- Modify: `optimizer-v2/scripts/run-reliability.test.mjs`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`

**Interfaces:**
- Core integration includes `client/e2e/progress-flow.spec.ts` exactly once.
- Pages adds `/progress?build=proof-build&source=local`.
- Reliability records v1-to-v2 migration, 200 objectives, 1,000 events, four viewports, and Progress chunk size.

- [ ] **Step 1: Write failing complete guest progress journey**

Create a build, set Col, verify affordability, complete/skip, advance a level
for automatic completion, change a material input to supersede, reload, inspect
history, switch saved build without replacing draft, export/import, and reset.

```ts
await page.goto('/progress');
await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
await page.getByLabel('Current Col').fill('10000');
await expect(page.getByText(/Need .* more Col|Affordable now/)).toBeVisible();
await page.getByRole('button', { name: /Complete/ }).first().click();
await page.reload();
await expect(page.getByRole('region', { name: 'Journey history' })).toContainText('Completed');
```

- [ ] **Step 2: Add failing accessibility/containment coverage**

Audit default/selected build, expanded route, wallet, note editor, history
filters, cap recovery, and reset confirmation at all four viewports. Require
zero serious/critical axe issues, visible focus, focus return, reachable mobile
actions, and `scrollWidth <= innerWidth`.

- [ ] **Step 3: Add migration, stress, cloud, and Pages coverage**

Seed browser v1, stress 250 builds/200 objectives/1,000 events/20 plan changes,
prove reload idempotence, extend cloud convergence, and add direct route.

- [ ] **Step 4: Run focused e2e and verify RED**

```bash
cd optimizer-v2
npm run test:integration
npm run test:pages
```

Expected: FAIL until phase registration, fixtures, styling, and Pages route land.

- [ ] **Step 5: Register e2e and Pages routes**

Add the progress spec exactly once to core and assert the phase plan. Add:

```ts
'/progress?build=proof-build&source=local'
```

- [ ] **Step 6: Fix only evidence-backed rendered regressions**

Inspect desktop/mobile with Browser. For each observed focus, overflow, copy,
empty/loading, or interaction defect, add a focused regression before the fix.

- [ ] **Step 7: Update reliability and acceptance evidence**

Record exact test counts, migration, limits, cloud merge, viewports, timings,
Pages/chunk sizes, and remaining non-goals.

- [ ] **Step 8: Run the complete local verification gate**

```bash
npm run test:reliability
npm run test:pages
git diff --check
git diff --exit-code -- client/src/module_bindings
git status --short
```

Expected: every unit/module/script/wiki/typecheck/coverage/module-build,
four-phase integration, accessibility, stress, and Pages layer passes; only
intentional changes and untouched `.playwright-mcp/` remain.

- [ ] **Step 9: Commit final Progress evidence**

```bash
git add optimizer-v2 docs/superpowers/plans/2026-09-01-sbo-qol-release-2-progress-dashboard.md
git commit -m "test: verify progress dashboard release"
```

- [ ] **Step 10: Merge, rerun, push, and monitor both workflows**

Use `superpowers:finishing-a-development-branch`, merge to `main`, rerun full
reliability on the merged tree, then:

```bash
git push origin main
gh run list --branch main --limit 6
```

Wait for Optimizer V2 CI and Deploy Optimizer V2. Any failure requires exact
GitHub logs and an approved evidence-backed correction.

- [ ] **Step 11: Smoke production and clean disposable data**

With disposable local-only builds and no sign-in, verify Home → Progress,
switching, Col, manual/history, automatic reconciliation, backup/import, direct
route, mobile containment, exact sources, and zero app-origin console errors.
Remove every disposable record and record final evidence without redeploying an
identical app merely for documentation.

---

## Checkpoint Order

1. Tasks 1–3: review v2 contract, reconciliation, and shopping arithmetic.
2. Tasks 4–6: review local migration and convergent private cloud sync.
3. Tasks 7–9: review routed dashboard, rendered UX, and portable recovery.
4. Task 10: review reliability, deployment, and clean live smoke.

## Self-Review Record

- Spec coverage: routing, hybrid completion, priority, shopping/Col, floor
  limits, history, migration, local/cloud merge, portable recovery, privacy,
  accessibility, performance, CI, deployment, and smoke each map to a task.
- Scope: one progress subsystem sharing `PlanProgress` v2; boss readiness,
  account analytics, Roblox telemetry, and public progress sharing are excluded.
- Type consistency: `PlanProgress`, `ProgressTask`, `ProgressObjectiveState`,
  `ProgressHistoryEvent`, `ShoppingPlan`, `generateProgressTasks`,
  `reconcileProgress`, `setManualTaskState`, and provider methods have one name.
- Privacy: sender-filtered cloud, unchanged public shares, strict portable
  boundaries, and no wallet/notes/history in public snapshots.
- Placeholder scan: no unfinished markers, generic error/test steps, undefined
  interfaces, or deferred implementation steps remain.
