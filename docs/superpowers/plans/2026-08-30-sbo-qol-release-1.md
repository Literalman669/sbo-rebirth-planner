# SBO:Rebirth QOL Release 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing four-step optimizer into a faster, clearer, local-first guided planner with persistent context, rich stat and equipment controls, action-focused results, and a dedicated saved-build workspace.

**Architecture:** Preserve the existing routed Character → Stats → Equipment → Results flow and deterministic optimizer. Add separate local UI/progress state, additive SpacetimeDB tables and reducers, focused domain helpers for stat/equipment/result presentation, and reusable shell/dialog/workspace components. Recommendation-affecting profile changes remain the only inputs to the optimizer; filters, disclosures, checklist progress, and display preferences stay outside `CharacterProfile`.

**Tech Stack:** React 19.2.8, TypeScript 7.0.2, Vite 8.2.2, React Router 7.18.3, Zod 4.5.2, idb 8.0.3, SpacetimeDB 2.8.3, Vitest 4.1.11, Playwright 1.62.1, lucide-react 1.37.0, @axe-core/playwright 4.13.0

**Spec:** `docs/superpowers/specs/2026-08-30-sbo-qol-roadmap-design.md`

## Global Constraints

- This plan implements Release 1 only. Inventory, Progress, bosses, farming, and skill timelines stay outside this plan.
- Preserve `/character`, `/stats`, `/equipment`, and `/results` deep links.
- Do not combine the product into one page.
- Guest mode remains complete and sign-in remains optional.
- Only published verified game records may appear as recommendations.
- Unknown prices, requirements, effects, locations, and formulas remain explicit.
- Identical recommendation-affecting inputs, policy, and dataset must produce identical plans.
- UI preferences, filters, disclosures, checklist completion, and recommendation dismissals must not change the optimizer fingerprint.
- Existing local and cloud builds must migrate without silent deletion or substitution.
- Keep the existing castle, Cinzel, parchment, brass, teal, and ornamental visual system.
- Use lucide-react for new utility icons; keep existing weapon-path artwork.
- Support 320px and wider without horizontal page overflow.
- Implement with test-first red-green cycles and small commits.
- Execute inline with review checkpoints, matching the user's stated preference.

---

## File Structure

### New domain and state files

- `optimizer-v2/client/src/domain/planner/state.ts` — preferences, plan progress, save state, defaults.
- `optimizer-v2/client/src/domain/planner/stateSchema.ts` — Zod schemas and migration entry points.
- `optimizer-v2/client/src/domain/planner/stateSchema.test.ts` — prior-version and invalid-row fixtures.
- `optimizer-v2/client/src/domain/optimizer/planFingerprint.ts` — stable recommendation-input fingerprint.
- `optimizer-v2/client/src/domain/optimizer/planFingerprint.test.ts` — relevant versus irrelevant input tests.
- `optimizer-v2/client/src/domain/optimizer/statWorkspace.ts` — stat adjustments, locks, recommendation application, metric previews.
- `optimizer-v2/client/src/domain/optimizer/statWorkspace.test.ts` — budget, caps, locks, and deterministic allocation tests.
- `optimizer-v2/client/src/domain/equipment/equipmentQuery.ts` — indexed filtering, sorting, eligibility reasons.
- `optimizer-v2/client/src/domain/equipment/equipmentQuery.test.ts` — full query matrix and performance fixture.
- `optimizer-v2/client/src/domain/equipment/equipmentComparison.ts` — raw and projected candidate comparison.
- `optimizer-v2/client/src/domain/equipment/equipmentComparison.test.ts` — equipped/candidate delta fixtures.
- `optimizer-v2/client/src/domain/results/actionChecklist.ts` — grouped plan actions, dismissal replacement, cost totals.
- `optimizer-v2/client/src/domain/results/actionChecklist.test.ts` — stable IDs, groups, replacement, and cost tests.
- `optimizer-v2/client/src/domain/results/planExport.ts` — text and JSON serializers.
- `optimizer-v2/client/src/domain/results/planExport.test.ts` — literal export fixtures.
- `optimizer-v2/client/src/domain/results/datasetImpact.ts` — relevant old/new dataset differences.
- `optimizer-v2/client/src/domain/results/datasetImpact.test.ts` — equipped, formula, and missing-history cases.

### New providers and reusable UI

- `optimizer-v2/client/src/app/providers/PlannerStateContext.ts` — planner state contract.
- `optimizer-v2/client/src/app/providers/PlannerStateProvider.tsx` — preferences/progress hydration and persistence.
- `optimizer-v2/client/src/app/providers/PlannerStateProvider.test.tsx` — separation and hydration tests.
- `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx` — Planner and Builds navigation.
- `optimizer-v2/client/src/features/shell/BuildSummaryBar.tsx` — persistent profile and save state.
- `optimizer-v2/client/src/features/shell/StickyPlannerActions.tsx` — shared responsive action footer.
- `optimizer-v2/client/src/features/shell/shell.test.tsx` — navigation, summary, and focus tests.
- `optimizer-v2/client/src/features/equipment/EquipmentPicker.tsx` — accessible dialog/sheet picker.
- `optimizer-v2/client/src/features/equipment/EquipmentPicker.test.tsx` — search/filter/select/compare tests.
- `optimizer-v2/client/src/features/equipment/EquipmentDetail.tsx` — source, requirements, stats, and comparison pane.
- `optimizer-v2/client/src/features/results/ActionChecklist.tsx` — progress-aware grouped action list.
- `optimizer-v2/client/src/features/results/PlanExportActions.tsx` — copy, print, and JSON download actions.
- `optimizer-v2/client/src/features/builds/SaveBuildDialog.tsx` — one save flow with cancel and mode choice.
- `optimizer-v2/client/src/features/builds/SaveBuildDialog.test.tsx` — new, overwrite, duplicate, and cancellation tests.
- `optimizer-v2/client/src/features/builds/BuildsScreen.tsx` — dedicated saved-build workspace.
- `optimizer-v2/client/src/features/builds/BuildsScreen.test.tsx` — local/cloud actions, search, sort, archive tests.

### Existing files with focused changes

- Build/profile: `domain/build/model.ts`, `domain/build/schema.ts`
- Local persistence: `infrastructure/storage/guestBuildStore.ts`
- Draft provider: `app/providers/BuildDraftContext.ts`, `BuildDraftProvider.tsx`
- Cloud: `infrastructure/cloud/buildMappers.ts`, `buildRepository.ts`, `useCloudBuilds.ts`
- SpacetimeDB: `spacetimedb/src/schema.ts`, `playerReducers.ts`, `playerViews.ts`, related tests
- Shell/routes: `app/App.tsx`, `app/router.tsx`, `features/home/HomeScreen.tsx`, `features/planner/PlannerFrame.tsx`
- Planner screens: `CharacterScreen.tsx`, `StatsScreen.tsx`, `EquipmentScreen.tsx`
- Results: `ResultsScreen.tsx`, `LevelAllocationTable.tsx`
- Styles: `styles/tokens.css`, `styles/global.css`, `styles/planner.css`
- Browser tests: `client/e2e/acceptance.spec.ts`, `guest-flow.spec.ts`, `reliability-flow.spec.ts`

---

### Task 1: Local Planner State and Migrations

**Files:**
- Create: `optimizer-v2/client/src/domain/planner/state.ts`
- Create: `optimizer-v2/client/src/domain/planner/stateSchema.ts`
- Create: `optimizer-v2/client/src/domain/planner/stateSchema.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts`

**Interfaces:**
- Produces: `PlannerPreferences`, `PlanProgress`, `DraftPersistenceStatus`, `migratePlannerPreferences`, `migratePlanProgress`
- Produces `openPlannerDatabase(databaseName)` as the only IndexedDB opener and store upgrader
- Produces store methods: `loadPreferences`, `savePreferences`, `loadPlanProgress`, `savePlanProgress`, `deletePlanProgress`, `listQuarantinedRecords`, `exportQuarantinedRecord`, `deleteQuarantinedRecord`
- Produces `QuarantinedRecord = { id: string; kind: string; rawJson: string; quarantinedAt: string }`
- Keeps `CharacterProfile.schemaVersion` at `2`; Release 1 adds separate versioned state instead of changing verified cloud revision shape.

- [ ] **Step 1: Write failing state-schema tests**

```ts
it('migrates missing preferences to version one defaults', () => {
  expect(migratePlannerPreferences(undefined)).toEqual({
    schemaVersion: 1,
    mode: 'beginner',
    density: 'comfortable',
    showAllLevels: false,
    compactWeaponPathsAfterFirstUse: false,
  });
});

it('rejects malformed progress without deleting neighboring state', () => {
  expect(() => migratePlanProgress({ schemaVersion: 1, completedActionIds: 'bad' }))
    .toThrow('Stored plan progress is invalid');
});
```

- [ ] **Step 2: Run the state-schema test and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/planner/stateSchema.test.ts`  
Expected: FAIL because the planner state modules do not exist.

- [ ] **Step 3: Define planner state contracts and defaults**

```ts
export type PlannerPreferences = {
  schemaVersion: 1;
  mode: 'beginner' | 'detailed';
  density: 'comfortable' | 'compact';
  showAllLevels: boolean;
  compactWeaponPathsAfterFirstUse: boolean;
};

export type PlanProgress = {
  schemaVersion: 1;
  buildId: string;
  completedActionIds: string[];
  dismissedRecommendationIds: string[];
  reconciledThroughLevel?: number;
  acknowledgedDatasetVersion?: string;
};

export type DraftPersistenceStatus =
  | 'idle'
  | 'saving'
  | 'saved-local'
  | 'sync-queued'
  | 'synced'
  | 'error';
```

- [ ] **Step 4: Implement Zod parsing and migrations**

Use strict object schemas, unique ID refinement, level bounds `1..10_000`, and default factories that return fresh arrays.

- [ ] **Step 5: Write failing IndexedDB v4 tests**

```ts
it('adds preference and plan-progress stores without losing v3 builds', async () => {
  const v3 = await createVersionThreeFixture(databaseName, profile);
  v3.close();
  const store = createGuestBuildStore({ databaseName });
  expect(await store.loadDraft()).toEqual(profile);
  expect(await store.loadPreferences()).toEqual(DEFAULT_PLANNER_PREFERENCES);
});
```

Define `createVersionThreeFixture` in the test file by opening the named database at version 3, creating `draft`, `builds`, `pending-revisions`, and `dataset-releases`, and inserting the supplied profile at key `active`. Do not call production upgrade code from this fixture.

- [ ] **Step 6: Run the guest-store test and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/guestBuildStore.test.ts`  
Expected: FAIL because database version 4 and the new methods are absent.

- [ ] **Step 7: Upgrade `GUEST_DATABASE_VERSION` to 4**

Create object stores `planner-preferences`, `plan-progress`, `pending-planner-state`, and `quarantine`. Store preferences at key `primary`; store progress by `buildId`. Invalid preference/progress rows are copied to `quarantine` before returning a recoverable error.

Move the repeated upgrade callback from `guestBuildStore`, `datasetCache`, and `pendingRevisionQueue` into `openPlannerDatabase`. All three adapters must use the same version and store list so adapter construction order cannot omit stores.

- [ ] **Step 8: Run local persistence tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/planner/stateSchema.test.ts src/infrastructure/storage/guestBuildStore.test.ts`  
Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add optimizer-v2/client/src/domain/planner optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue*
git commit -m "feat: add versioned local planner state"
```

---

### Task 2: Draft Save Status, Undo, Preferences, and Progress Provider

**Files:**
- Create: `optimizer-v2/client/src/app/providers/PlannerStateContext.ts`
- Create: `optimizer-v2/client/src/app/providers/PlannerStateProvider.tsx`
- Create: `optimizer-v2/client/src/app/providers/PlannerStateProvider.test.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`

**Interfaces:**
- Consumes: Task 1 `PlannerPreferences`, `PlanProgress`, `DraftPersistenceStatus`
- Produces `usePlannerState()` with `preferences`, `updatePreferences`, `progress`, `updateProgress`, `resetProgress`
- Extends `BuildDraftContextValue` with `persistenceStatus`, `canUndo`, `undoLastChange`
- Extends `updateDraft(patch, options?: { recordUndo?: boolean })`

- [ ] **Step 1: Write failing provider separation tests**

```tsx
it('does not change the draft when only display density changes', async () => {
  const before = store.loadDraft();
  await user.click(screen.getByRole('button', { name: 'Use compact density' }));
  expect(await store.loadDraft()).toEqual(await before);
});

it('reports saving then saved-local around the debounced write', async () => {
  await user.click(screen.getByRole('button', { name: 'Level up' }));
  expect(screen.getByText('Saving')).toBeVisible();
  await vi.advanceTimersByTimeAsync(250);
  expect(screen.getByText('Saved locally')).toBeVisible();
});
```

- [ ] **Step 2: Run provider tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/PlannerStateProvider.test.tsx src/app/providers/BuildDraftProvider.test.tsx`  
Expected: FAIL because the new provider and status contract do not exist.

- [ ] **Step 3: Implement `PlannerStateProvider`**

Hydrate preferences once, load progress when `draft.id` changes, persist each through the Task 1 store, and expose storage failures through an `error` state without discarding in-memory changes.

- [ ] **Step 4: Add bounded undo to `BuildDraftProvider`**

Keep the previous ten `CharacterProfile` states in a ref. Record an undo state only when the next profile is structurally different. `undoLastChange` replaces the active draft, schedules persistence, and never modifies named-build history directly.

- [ ] **Step 5: Add visible persistence state transitions**

Set `saving` before the 250ms local write, `saved-local` after success, and `error` after failure. Cloud state is overlaid later by Task 4.

- [ ] **Step 6: Mount the provider in `main.tsx`**

Place it inside `BuildDraftProvider` and outside route rendering so every planner and build workspace route shares the same state.

- [ ] **Step 7: Run provider and storage tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/PlannerStateProvider.test.tsx src/app/providers/BuildDraftProvider.test.tsx src/infrastructure/storage/guestBuildStore.test.ts`  
Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add optimizer-v2/client/src/app/providers optimizer-v2/client/src/main.tsx
git commit -m "feat: expose planner save status and undo"
```

---

### Task 3: Additive SpacetimeDB QOL State

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerViews.ts`
- Modify: `optimizer-v2/spacetimedb/src/sharing.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.test.ts`
- Create: `optimizer-v2/spacetimedb/src/plannerState.test.ts`
- Regenerate: `optimizer-v2/client/src/module_bindings/**`

**Interfaces:**
- Produces private tables `build_plan_progress` and `user_preference`
- Adds optional `archivedAt` to `build`
- Adds optional `accessPreferences` to `build_revision` and `shared_build`
- Produces reducers `upsert_plan_progress`, `upsert_user_preferences`, `rename_build`, `set_build_archived`
- Produces identity-filtered views `my_plan_progress` and `my_user_preferences`

- [ ] **Step 1: Write failing reducer validation tests**

```ts
it('rejects plan progress for another identity build', () => {
  expect(validatePlanProgressOwnership(otherOwnerBuild, sender)).toEqual([
    'Build not found for this identity',
  ]);
});

it('accepts version one preference JSON only', () => {
  expect(validatePreferenceJson('{"schemaVersion":1,"mode":"beginner","density":"comfortable","showAllLevels":false,"compactWeaponPathsAfterFirstUse":false}')).toEqual([]);
});
```

- [ ] **Step 2: Run module tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-module -- --run src/plannerState.test.ts`  
Expected: FAIL because the planner-state validators and reducers are absent.

- [ ] **Step 3: Add additive tables**

```ts
export const buildPlanProgress = table(
  { name: 'build_plan_progress', indexes: [{
    accessor: 'buildPlanProgressOwner',
    name: 'build_plan_progress_owner',
    algorithm: 'btree',
    columns: ['owner'],
  }] },
  {
    buildId: t.string().primaryKey(),
    owner: t.identity(),
    progressJson: t.string(),
    updatedAt: t.timestamp(),
  },
);

export const userPreference = table(
  { name: 'user_preference' },
  {
    identity: t.identity().primaryKey(),
    preferencesJson: t.string(),
    updatedAt: t.timestamp(),
  },
);
```

Add `archivedAt: t.timestamp().optional()` to `build`. Add `accessPreferences: t.string().optional()` to `buildRevision` and `sharedBuild`. Keep every new field/table optional or additive so publishing never deletes existing data.

- [ ] **Step 4: Implement protected reducers**

Validate ownership, JSON size at or below 20,000 characters, exact schema version, unique action ID arrays, build name length `1..60`, archived boolean transitions, and the comma-separated access tokens `active-event`, `gamepass`, `badge`, and `limited`. Reducer retries with identical content are no-ops.

Extend `cloudProfileInput`, `insertRevision`, idempotent retry comparison, restore, and share snapshot creation so access preferences round-trip through local save, cloud history, restore, and public snapshots.

- [ ] **Step 5: Add identity-filtered views**

Return only rows whose `owner` or `identity` equals `ctx.sender`.

- [ ] **Step 6: Extend delete behavior**

Delete `build_plan_progress` for the owned build before deleting its revisions. Do not delete user preferences when deleting a build.

- [ ] **Step 7: Run module tests and build**

Run: `npm run test:unit --workspace @sbo/optimizer-module && spacetime build`  
Expected: PASS.

- [ ] **Step 8: Regenerate and verify TypeScript bindings**

```bash
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code --check client/src/module_bindings
```

Expected: generated reducers, tables, and views include the new contracts and contain no manual edits.

- [ ] **Step 9: Commit Task 3**

```bash
git add optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings
git commit -m "feat: add cloud planner progress and preferences"
```

---

### Task 4: Cloud Mapping and Synchronization for QOL State

**Files:**
- Modify: `optimizer-v2/client/src/app/providers/CloudDataContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudDataProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/useCloudBuilds.ts`

**Interfaces:**
- Consumes Task 3 generated bindings and Task 1 state schemas
- Adds repository methods `savePlanProgress`, `savePreferences`, `rename`, `archive`
- Produces combined status `saved-local | sync-queued | synced | error`

- [ ] **Step 1: Write failing cloud mapper tests**

```ts
it('maps identity-filtered progress JSON through the shared schema', () => {
  expect(planProgressFromCloudRow({
    buildId: 'build-1',
    progressJson: JSON.stringify(progress),
  })).toEqual(progress);
});

it('preserves the last validated preference row after a malformed update', () => {
  const selector = createPreferenceSelector();
  expect(selector.select(validRows)).toEqual(preferences);
  expect(selector.select(malformedRows)).toEqual(preferences);
});
```

- [ ] **Step 2: Run cloud tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud/buildMappers.test.ts src/infrastructure/cloud/buildRepository.test.ts`  
Expected: FAIL because the new mapping and repository methods are absent.

- [ ] **Step 3: Subscribe to new views**

Add `myPlanProgress` and `myUserPreferences` to `CloudDataProvider`; keep validated previous rows when a malformed subscription update arrives.

Extend `CloudBuildRowLike` with optional `archivedAt`, expose it on `CloudBuildRecord`, and add a test proving archived rows remain selectable for the archived filter but not the default active list.

- [ ] **Step 4: Implement repository writes**

```ts
savePlanProgress(progress: PlanProgress): Promise<'cloud' | 'cloud-pending'>;
savePreferences(preferences: PlannerPreferences): Promise<'cloud' | 'cloud-pending'>;
rename(buildId: string, name: string): Promise<void>;
archive(buildId: string, archived: boolean): Promise<void>;
```

Queue progress/preferences with stable idempotency IDs. Stop replay after the first failure, matching revision queue behavior.

Implement the queue in `pendingPlannerStateQueue.ts` using the Task 1 `pending-planner-state` object store and a discriminated union:

```ts
type PendingPlannerStateMutation =
  | { kind: 'progress'; subject: string; mutationId: string; progress: PlanProgress; enqueuedAt: string; attempts: number }
  | { kind: 'preferences'; subject: string; mutationId: string; preferences: PlannerPreferences; enqueuedAt: string; attempts: number };
```

- [ ] **Step 5: Overlay cloud status in `CloudBuildsProvider`**

Local persistence remains independent. Show `sync-queued` while any current-account queue item exists and `synced` only after the relevant build, progress, and preference writes are acknowledged.

Track the last synchronized recommendation fingerprint for each enrolled build. Cloud autosave and explicit Save must not create two revisions for identical profile content.

- [ ] **Step 6: Run cloud provider and repository tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud src/app/providers/CloudDataProvider.test.tsx src/app/providers/CloudBuildsProvider.test.tsx`  
Expected: PASS.

- [ ] **Step 7: Run focused local integration**

Run: `npm run test:integration`  
Expected: every current integration phase passes with additive schema publication.

- [ ] **Step 8: Commit Task 4**

```bash
git add optimizer-v2/client/src/app/providers optimizer-v2/client/src/infrastructure/cloud
git commit -m "feat: sync planner progress and preferences"
```

---

### Task 5: Product Shell, Build Summary, and Home Hub

**Files:**
- Modify: `optimizer-v2/client/package.json`
- Modify: `optimizer-v2/package-lock.json`
- Create: `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx`
- Create: `optimizer-v2/client/src/features/shell/BuildSummaryBar.tsx`
- Create: `optimizer-v2/client/src/features/shell/StickyPlannerActions.tsx`
- Create: `optimizer-v2/client/src/features/shell/shell.test.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Create: `optimizer-v2/client/src/features/home/exampleBuild.ts`
- Create: `optimizer-v2/client/src/features/home/exampleBuild.test.ts`
- Modify: `optimizer-v2/client/src/app/App.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/features/home/HomeScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/PlannerFrame.tsx`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**
- Consumes Task 2 state and Task 4 cloud status
- Adds route `/builds`
- Produces reusable `StickyPlannerActions({ back, next, nextDisabled })`

- [ ] **Step 1: Add exact utility-icon dependency**

Run: `npm install --workspace @sbo/optimizer-client --save-exact lucide-react@1.37.0`  
Expected: client package and root lockfile record exactly `1.37.0`.

- [ ] **Step 2: Write failing shell tests**

```tsx
it('separates global navigation from planner progress', async () => {
  await renderRoute('/stats');
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Planner progress' })).toBeVisible();
});

it('shows profile context and local save status on every planner step', async () => {
  await renderRoute('/equipment', { saved: profile });
  expect(screen.getByText('Level 10 · Floor 2 · Melee · Balanced')).toBeVisible();
  expect(screen.getByText('Saved locally')).toBeVisible();
});
```

- [ ] **Step 3: Run shell tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/shell/shell.test.tsx`  
Expected: FAIL because the shell components do not exist.

- [ ] **Step 4: Implement global navigation**

Render Planner and Builds links. Reserve Inventory and Progress labels for Release 2 without linking to nonexistent routes. Use text labels in addition to lucide icons.

- [ ] **Step 5: Implement persistent build summary**

Show build name, level/floor/path/goal, required-equipment completion, dataset version, and save/sync status. Collapse to two lines below 48rem.

- [ ] **Step 6: Create the base Builds route**

Move existing local/cloud build lists from Home into `BuildsScreen`. Preserve Load, History, and Delete behavior; Task 11 expands the workspace.

- [ ] **Step 7: Refocus Home**

Render a Resume card with modified state, next incomplete step, Create Build, recent build links, and a collapsed optional-cloud explanation. Do not show the full authentication essay by default.

Implement `createVerifiedExampleBuild(snapshot)` in `exampleBuild.ts`. It selects the verified Level-1 two-handed starter and starter armor from the active dataset, returns zero invested stats and three unspent points, and returns an unavailable reason instead of guessing when either starter is absent.

- [ ] **Step 8: Add sticky action shell**

Refactor planner screens to receive or render `StickyPlannerActions`. Desktop behavior remains visually equivalent; below 48rem the action row sticks to the viewport bottom with safe-area padding.

- [ ] **Step 9: Run shell and route tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/shell/shell.test.tsx src/features/planner/plannerScreens.test.tsx src/app/App.test.tsx`  
Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```bash
git add optimizer-v2/client/package.json optimizer-v2/package-lock.json optimizer-v2/client/src/app optimizer-v2/client/src/features/shell optimizer-v2/client/src/features/home optimizer-v2/client/src/features/builds/BuildsScreen.tsx optimizer-v2/client/src/features/planner/PlannerFrame.tsx optimizer-v2/client/src/styles
git commit -m "feat: add planner shell and build hub"
```

---

### Task 6: Character Goal Cards and Contextual Inputs

**Files:**
- Modify: `optimizer-v2/client/src/features/planner/CharacterScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/GoalCard.tsx`
- Create: `optimizer-v2/client/src/features/planner/GoalCard.test.tsx`
- Modify: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**
- Consumes existing `OptimizationGoal` and Task 2 undo/status
- Produces `GOAL_PRESENTATION: Record<OptimizationGoal, { label; description; metrics }>`

- [ ] **Step 1: Write failing Character interaction tests**

```tsx
it('explains the selected goal without changing its stored value', async () => {
  await renderRoute('/character');
  await user.click(screen.getByRole('radio', { name: 'Mobility' }));
  expect(screen.getByText(/emphasizes movement speed and stamina/i)).toBeVisible();
  expect((await store.loadDraft())?.goal).toBe('mobility');
});

it('accepts an optional build name at the start', async () => {
  await user.type(screen.getByLabelText('Build Name'), 'Floor 2 Melee');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect((await store.loadDraft())?.name).toBe('Floor 2 Melee');
});
```

- [ ] **Step 2: Run Character tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/planner/GoalCard.test.tsx src/features/planner/plannerScreens.test.tsx`  
Expected: FAIL because goal cards and the name field are absent.

- [ ] **Step 3: Implement goal cards**

Use radio semantics and literal descriptions derived from `goalConfig.ts`. Do not promise unsupported metrics. Keep Balanced selected by default.

- [ ] **Step 4: Add optional name and contextual hints**

Validate a nonblank entered name at 60 characters. Keep empty as unnamed. Show level/floor guidance as advisory text; only the existing numeric bounds block Continue.

- [ ] **Step 5: Surface weapon skill when relevant**

Keep the disclosure, automatically open it for Dual Wield or when the loaded build contains `weaponSkill`.

- [ ] **Step 6: Run planner tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/planner/GoalCard.test.tsx src/features/planner/plannerScreens.test.tsx`  
Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add optimizer-v2/client/src/features/planner optimizer-v2/client/src/styles/planner.css
git commit -m "feat: clarify character goals and build identity"
```

---

### Task 7: Stats Allocation Workspace

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/statWorkspace.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/statWorkspace.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/allocateStats.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/allocateStats.test.ts`
- Modify: `optimizer-v2/client/src/features/planner/StatsScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/StatControl.tsx`
- Create: `optimizer-v2/client/src/features/planner/StatControl.test.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**
- Produces `adjustStat(profile, stat, delta, pointsPerLevel)`, `resetStats`, `maxAvailableForStat`, `recommendUnspentAllocation`, `previewStatChange`
- Adds optional `lockedStats?: ReadonlySet<StatName>` to allocation helpers used only by the workspace recommendation action

- [ ] **Step 1: Write failing stat-domain tests**

```ts
it('adds five without exceeding the earned budget or stat cap', () => {
  expect(adjustStat(profile, 'str', 5, 3)).toEqual({
    ...profile.stats,
    str: profile.stats.str + 3,
  });
});

it('applies the deterministic recommendation around locked stats', () => {
  const result = recommendUnspentAllocation(profile, dataset, new Set(['def']));
  expect(result.def).toBe(profile.stats.def);
  expect(Object.values(result).reduce((sum, value) => sum + value, 0))
    .toBe(profile.level * 3);
});
```

- [ ] **Step 2: Run stat-domain tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer/statWorkspace.test.ts`  
Expected: FAIL because the workspace helpers do not exist.

- [ ] **Step 3: Implement bounded stat helpers**

Every helper returns a fresh `StatBlock`, enforces `0..500`, and never permits total invested points above `level * pointsPerLevel`.

- [ ] **Step 4: Extend allocation with workspace-only locks**

Skip locked stats in `chooseNextStat` only when `lockedStats` is provided. Existing optimizer calls omit it and must retain byte-for-byte deterministic serialized output fixtures.

- [ ] **Step 5: Write failing StatControl tests**

```tsx
it('supports +1, +5, max, decrement, lock, reset, and undo', async () => {
  await user.click(screen.getByRole('button', { name: 'Add 5 STR' }));
  expect(screen.getByLabelText('STR')).toHaveValue(5);
  await user.click(screen.getByRole('button', { name: 'Lock STR' }));
  await user.click(screen.getByRole('button', { name: 'Apply recommended current points' }));
  expect(screen.getByLabelText('STR')).toHaveValue(5);
});
```

- [ ] **Step 6: Run StatControl tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/planner/StatControl.test.tsx`  
Expected: FAIL because the component does not exist.

- [ ] **Step 7: Build the Stats workspace**

Render stat descriptions, direct inputs, adjustment buttons, lock toggles, budget meter, Reset, Undo, `Apply recommended current points`, and verified live metric deltas. Label unsupported projections `Not numerically verified`.

- [ ] **Step 8: Add cap and plan-match states**

Warn at 490+, label 500 as capped, and compare current stats against the saved plan row for the current level when that exact plan fingerprint is available.

- [ ] **Step 9: Run stat and optimizer suites**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer/allocateStats.test.ts src/domain/optimizer/statWorkspace.test.ts src/features/planner/StatControl.test.tsx src/features/planner/plannerScreens.test.tsx`  
Expected: PASS.

- [ ] **Step 10: Commit Task 7**

```bash
git add optimizer-v2/client/src/domain/optimizer optimizer-v2/client/src/features/planner optimizer-v2/client/src/styles/planner.css
git commit -m "feat: add guided stat allocation workspace"
```

---

### Task 8: Equipment Query and Comparison Domain

**Files:**
- Create: `optimizer-v2/client/src/domain/equipment/equipmentQuery.ts`
- Create: `optimizer-v2/client/src/domain/equipment/equipmentQuery.test.ts`
- Create: `optimizer-v2/client/src/domain/equipment/equipmentComparison.ts`
- Create: `optimizer-v2/client/src/domain/equipment/equipmentComparison.test.ts`
- Modify: `optimizer-v2/client/src/features/planner/completeness.ts`
- Modify: `optimizer-v2/client/src/features/planner/completeness.test.ts`

**Interfaces:**

```ts
export type EquipmentSort =
  | 'projected-improvement'
  | 'raw-strength'
  | 'price'
  | 'value-per-col'
  | 'level'
  | 'floor'
  | 'name';

export interface EquipmentQuery {
  slot: EquipmentSlot;
  search: string;
  sort: EquipmentSort;
  showFuture: boolean;
  ownedOnly: boolean;
  pricedOnly: boolean;
}
```

- Produces `buildEquipmentIndex(snapshot)`, `queryEquipment(index, profile, query)`, `compareEquipment(profile, slot, candidate, snapshot)`

- [ ] **Step 1: Write failing query tests**

```ts
it('matches canonical names and aliases while preserving eligibility reasons', () => {
  const result = queryEquipment(index, profile, {
    slot: 'armor', search: 'midnight', sort: 'name',
    showFuture: true, ownedOnly: false, pricedOnly: false,
  });
  expect(result[0]).toMatchObject({
    item: { id: 'midnight-platemail' },
    state: 'equip-now',
  });
});
```

- [ ] **Step 2: Run query tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/equipment/equipmentQuery.test.ts src/domain/equipment/equipmentComparison.test.ts`  
Expected: FAIL because the equipment domain modules do not exist.

- [ ] **Step 3: Build immutable dataset indexes**

Index catalog aliases, acquisitions, optimizer-safe projection rows, and lowercased search text by dataset version. Do not rebuild the index for UI filter changes.

- [ ] **Step 4: Implement explicit item states**

Return `state: 'equip-now' | 'unlock-later' | 'unavailable'` plus `owned: boolean`, allowing Owned and Equip Now badges to coexist. Include literal reasons such as `Requires Level 18`, `Requires Floor 3`, `Enable gamepass access`, or `Acquisition floor is not verified`.

- [ ] **Step 5: Implement verified sorts**

Unknown prices sort after known prices. Value per Col excludes unknown or zero price from the numeric ranking and labels the value unavailable.

- [ ] **Step 6: Implement equipped comparison**

Reuse `aggregateGearEffects`, `compareGearEffects`, `projectMetrics`, and compiled mechanics. Return raw deltas, supported projected deltas, source effects, and price/source metadata.

- [ ] **Step 7: Add a 1,000-record performance fixture**

Measure 100 repeated queries after one index build and assert elapsed time stays below the existing CI budget of 1,000ms. The test must assert result correctness as well as time.

- [ ] **Step 8: Run equipment domain tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/equipment src/features/planner/completeness.test.ts`  
Expected: PASS.

- [ ] **Step 9: Commit Task 8**

```bash
git add optimizer-v2/client/src/domain/equipment optimizer-v2/client/src/features/planner/completeness.ts optimizer-v2/client/src/features/planner/completeness.test.ts
git commit -m "feat: add indexed equipment search and comparison"
```

---

### Task 9: Accessible Equipment Picker

**Files:**
- Create: `optimizer-v2/client/src/features/equipment/EquipmentPicker.tsx`
- Create: `optimizer-v2/client/src/features/equipment/EquipmentDetail.tsx`
- Create: `optimizer-v2/client/src/features/equipment/EquipmentPicker.test.tsx`
- Modify: `optimizer-v2/client/src/features/planner/EquipmentScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**
- Consumes Task 8 query/comparison API
- Produces `EquipmentPicker({ slot, label, required, profile, snapshot, value, onSelect })`
- Renders at most 100 rows initially and reveals the next 100 with `Show more results`

- [ ] **Step 1: Write failing picker tests**

```tsx
it('searches, compares, and equips from one focused dialog', async () => {
  await user.click(screen.getByRole('button', { name: 'Choose Armor' }));
  await user.type(screen.getByRole('searchbox', { name: 'Search Armor' }), 'Combat');
  expect(screen.getByText('DEF +3 · DEX +15')).toBeVisible();
  expect(screen.getByText('3,360 Col')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Equip Combat Armor' }));
  expect(screen.getByRole('button', { name: 'Change Armor' })).toHaveTextContent('Combat Armor');
});
```

- [ ] **Step 2: Run picker tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/equipment/EquipmentPicker.test.tsx`  
Expected: FAIL because the picker does not exist.

- [ ] **Step 3: Implement dialog and sheet semantics**

Use native `<dialog>` when supported through a focused wrapper, trap focus while open, restore focus to the trigger on close, close on Escape, and render a full-height fixed sheet below 48rem.

- [ ] **Step 4: Implement list/filter/detail behavior**

Render search, state filter, sort, candidate count, incremental results, selected row, and `EquipmentDetail`. All filter controls use visible labels.

- [ ] **Step 5: Integrate required and optional slots**

Replace native selects in `EquipmentScreen`. Auto-select only unambiguous verified starter equipment. Continue still focuses the first missing required slot.

- [ ] **Step 6: Remove the inline owned-items checkbox wall**

Keep quick Mark Owned and Open Wiki actions inside item detail. The comparison pane always compares the candidate against equipped gear; favorites and comparison shortlists remain Release 2. Link to the future Inventory workspace with disabled explanatory copy reserved for Release 2; do not add the `/inventory` route yet.

- [ ] **Step 7: Run picker and planner tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/equipment/EquipmentPicker.test.tsx src/features/planner/plannerScreens.test.tsx`  
Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add optimizer-v2/client/src/features/equipment optimizer-v2/client/src/features/planner/EquipmentScreen.tsx optimizer-v2/client/src/features/planner/plannerScreens.test.tsx optimizer-v2/client/src/styles/planner.css
git commit -m "feat: replace equipment selects with rich picker"
```

---

### Task 10: Action-Focused Results and Exports

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/planFingerprint.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/planFingerprint.test.ts`
- Create: `optimizer-v2/client/src/domain/results/actionChecklist.ts`
- Create: `optimizer-v2/client/src/domain/results/actionChecklist.test.ts`
- Create: `optimizer-v2/client/src/domain/results/planExport.ts`
- Create: `optimizer-v2/client/src/domain/results/planExport.test.ts`
- Create: `optimizer-v2/client/src/domain/results/datasetImpact.ts`
- Create: `optimizer-v2/client/src/domain/results/datasetImpact.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.test.ts`
- Create: `optimizer-v2/client/src/features/results/ActionChecklist.tsx`
- Create: `optimizer-v2/client/src/features/results/PlanExportActions.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`
- Modify: `optimizer-v2/client/src/features/results/LevelAllocationTable.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**

```ts
export interface PlanAction {
  id: string;
  group: 'do-now' | 'next-level' | 'next-floor' | 'later';
  kind: 'spend-stats' | 'equip' | 'buy' | 'farm' | 'unlock';
  title: string;
  detail: string;
  itemId?: string;
  level?: number;
  verifiedCost?: { amount: number; currency: string };
  sourceUrl?: string;
}
```

- Produces `fingerprintRecommendationInput`, `buildActionChecklist`, `replaceDismissedRecommendations`, `sumVerifiedCosts`, `reconcileProfileToLevel`, `summarizeDatasetImpact`, `serializePlanText`, `serializePlanJson`
- Exports `rankEquipmentUpgradeCandidates(profile, dataset)` from `recommendEquipment.ts` for presentation-only replacement selection; the existing optimizer consumes the same ordered candidates.

- [ ] **Step 1: Write failing fingerprint tests**

```ts
it('ignores UI and checklist state but changes for a build input', () => {
  expect(fingerprintRecommendationInput(profile, dataset)).toBe(
    fingerprintRecommendationInput(profile, dataset),
  );
  expect(fingerprintRecommendationInput({ ...profile, level: 11 }, dataset))
    .not.toBe(fingerprintRecommendationInput(profile, dataset));
});
```

- [ ] **Step 2: Write failing action and export tests**

Use literal expected action IDs, group order, Combat Armor cost totals, and complete exported text. Do not compute expected values with production helpers.

Add literal fixtures proving `reconcileProfileToLevel(profile, plan, 13)` applies rows 11 through 13 exactly once and rejects levels outside the plan. Add dataset-impact fixtures for an equipped-item change, a formula change, no relevant change, and an unavailable historical snapshot.

- [ ] **Step 3: Run domain tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer/planFingerprint.test.ts src/domain/results`  
Expected: FAIL because the new modules do not exist.

- [ ] **Step 4: Implement stable fingerprinting**

Serialize a canonical object containing level, floor, path, goal, weapon skill, ordered stats, ordered equipped slots, sorted owned IDs, access preferences, dataset version, and strategy policy version. Hash with a deterministic non-cryptographic string hash implemented locally; no browser crypto timing enters the result.

- [ ] **Step 5: Build the action checklist**

Immediate action appears first. Current stat spending, next-level rows, and equipment targets produce stable IDs. Dismissed targets are replaced from `rankEquipmentUpgradeCandidates` without changing the stored plan fingerprint.

- [ ] **Step 6: Add compact level detail**

Render three rows by default and ten when `preferences.showAllLevels` is true. Mobile uses cards; desktop retains the table. Keep the exact per-level additions and totals.

- [ ] **Step 7: Add cost and source grouping**

Show verified known-cost total by currency and a separate count for unknown-price actions. Group item tasks by immediate, level, and floor/source.

- [ ] **Step 8: Add completion, dismissal, and replacement interactions**

Write only `PlanProgress` through Task 2. Completion and dismissal must not call `optimizeBuild`. Announce changes through a polite live region and offer Undo.

- [ ] **Step 9: Add text, print, and JSON actions**

Use Clipboard API with an explicit success/error message, `window.print()` for print, and a Blob download for JSON. Exported JSON includes schema version, profile, dataset version, fingerprint, and generated plan; it contains no account identity.

- [ ] **Step 10: Add level reconciliation and dataset impact confirmation**

Add `Advance to Level N` beside eligible rows. `reconcileProfileToLevel` updates level and stats from the selected row totals, records `reconciledThroughLevel`, and calls `updateDraft` once so local autosave and enrolled cloud revision behavior remain recoverable.

Before dataset recalculation, compare the exact historical and current snapshots. Show changes to equipped items, recommended items, formulas used by compiled mechanics, and strategy policy. When the historical snapshot is unavailable, say so and require explicit recalculation confirmation; never substitute silently.

- [ ] **Step 11: Run Results and optimizer tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/results src/domain/optimizer/planFingerprint.test.ts src/features/results/ResultsScreen.test.tsx`  
Expected: PASS.

- [ ] **Step 12: Commit Task 10**

```bash
git add optimizer-v2/client/src/domain/results optimizer-v2/client/src/domain/optimizer/planFingerprint* optimizer-v2/client/src/domain/optimizer/recommendEquipment* optimizer-v2/client/src/features/results optimizer-v2/client/src/styles/planner.css
git commit -m "feat: turn results into an actionable plan"
```

---

### Task 11: Focused Save Dialog and Builds Workspace

**Files:**
- Create: `optimizer-v2/client/src/features/builds/SaveBuildDialog.tsx`
- Create: `optimizer-v2/client/src/features/builds/SaveBuildDialog.test.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildsScreen.test.tsx`
- Modify: `optimizer-v2/client/src/features/builds/LocalBuildList.tsx`
- Modify: `optimizer-v2/client/src/features/builds/CloudBuildList.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`

**Interfaces:**

```ts
export type SaveBuildRequest = {
  name: string;
  mode: 'overwrite' | 'duplicate';
  destination: 'local' | 'cloud';
};
```

- Adds draft operations `saveBuild`, `renameSavedBuild`, `duplicateSavedBuild`, `setBuildArchived`
- Adds store methods `renameBuild`, `duplicateBuild`, `setBuildArchived`, `exportQuarantinedRecord`

- [ ] **Step 1: Write failing save-dialog tests**

Verify one dialog, one primary Save button, Cancel focus restoration, overwrite preserving ID, duplicate creating a new ID, local/cloud destination labeling, and empty-name validation.

- [ ] **Step 2: Run dialog tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/builds/SaveBuildDialog.test.tsx`  
Expected: FAIL because the dialog does not exist.

- [ ] **Step 3: Implement explicit save modes**

Overwrite uses `draft.id` and creates a revision for cloud builds. Duplicate uses a fresh UUID and clears parent revision. A never-before-saved draft defaults to overwrite because its UUID already represents the future build identity.

- [ ] **Step 4: Remove inline duplicate Save form**

Results owns one `Save Build` trigger. Opening the dialog hides no other result content and closing it leaves the plan unchanged.

- [ ] **Step 5: Write failing Builds workspace tests**

```tsx
it('searches, sorts, renames, duplicates, archives, and safely deletes', async () => {
  await renderRoute('/builds', { named: fixtures });
  await user.type(screen.getByRole('searchbox', { name: 'Search builds' }), 'Melee');
  expect(screen.getByText('Floor 2 Melee')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Duplicate Floor 2 Melee' }));
  expect(await screen.findByText('Floor 2 Melee copy')).toBeVisible();
});
```

- [ ] **Step 6: Run Builds tests and verify red**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/builds/BuildsScreen.test.tsx`  
Expected: FAIL because advanced workspace actions are absent.

- [ ] **Step 7: Implement local build lifecycle methods**

Preserve `createdAt`, update `updatedAt`, quarantine malformed rows, and never delete revisions through rename/archive. Duplicate deep-copies arrays and nested objects.

- [ ] **Step 8: Build the unified workspace**

Search by name/path/goal, sort by modified/name/level/floor, filter active/archived/local/cloud, and show dataset, completion, sync state, and next action. Use explicit Load, Rename, Duplicate, History, Archive, Export, Share, and Delete controls.

Add a `Recovered data` section for quarantined rows. It exposes Export raw record and Delete quarantined record; it never attempts an automatic lossy repair.

- [ ] **Step 9: Add safe delete confirmation**

The confirmation states whether local data, cloud history, and active shares are affected. Cancel is initial focus. Confirm calls existing local/cloud delete behavior and reports completion.

- [ ] **Step 10: Run build, provider, and storage tests**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/builds src/app/providers/BuildDraftProvider.test.tsx src/infrastructure/storage/guestBuildStore.test.ts`  
Expected: PASS.

- [ ] **Step 11: Commit Task 11**

```bash
git add optimizer-v2/client/src/features/builds optimizer-v2/client/src/features/results/ResultsScreen.tsx optimizer-v2/client/src/app/providers optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/src/styles/planner.css
git commit -m "feat: add focused save and build management"
```

---

### Task 12: Responsive and Accessibility Completion

**Files:**
- Modify: `optimizer-v2/client/src/styles/tokens.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Modify: `optimizer-v2/client/src/styles/planner.css`
- Modify: `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx`
- Modify: `optimizer-v2/client/src/features/shell/BuildSummaryBar.tsx`
- Modify: `optimizer-v2/client/src/features/shell/StickyPlannerActions.tsx`
- Modify: `optimizer-v2/client/src/features/planner/GoalCard.tsx`
- Modify: `optimizer-v2/client/src/features/planner/StatControl.tsx`
- Modify: `optimizer-v2/client/src/features/equipment/EquipmentPicker.tsx`
- Modify: `optimizer-v2/client/src/features/equipment/EquipmentDetail.tsx`
- Modify: `optimizer-v2/client/src/features/results/ActionChecklist.tsx`
- Modify: `optimizer-v2/client/src/features/results/PlanExportActions.tsx`
- Modify: `optimizer-v2/client/src/features/builds/SaveBuildDialog.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Create: `optimizer-v2/client/e2e/qol-accessibility.spec.ts`
- Modify: `optimizer-v2/client/e2e/acceptance.spec.ts`

**Interfaces:**
- Consumes every Release 1 component
- Produces shared CSS utility classes `.focus-ring`, `.status-badge`, `.sticky-planner-actions`, `.compact-density`

- [ ] **Step 1: Add exact accessibility test dependency**

Run: `npm install --workspace @sbo/optimizer-client --save-dev --save-exact @axe-core/playwright@4.13.0`  
Expected: package and lockfile record exactly `4.13.0`.

- [ ] **Step 2: Write failing responsive/accessibility browser tests**

```ts
import AxeBuilder from '@axe-core/playwright';

test('Release 1 routes have no serious axe violations or horizontal overflow', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/character');
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});
```

- [ ] **Step 3: Run the browser test and verify red**

Run: `npm run test:e2e --workspace @sbo/optimizer-client -- e2e/qol-accessibility.spec.ts`  
Expected: FAIL on the first unaddressed accessibility or overflow issue.

- [ ] **Step 4: Standardize focus, badges, targets, and live regions**

Use at least 44px comfortable targets, visible `:focus-visible`, text labels with state colors, polite live regions for nonblocking changes, assertive alerts only for blocking errors, and dialog focus restoration.

- [ ] **Step 5: Complete mobile composition**

Sticky actions include safe-area padding. Goal/path tiles compact after preference is set. Equipment picker fills the viewport. Results cards default to three levels. No fixed element obscures focused content.

- [ ] **Step 6: Add reduced-motion and zoom checks**

Disable nonessential transitions under `prefers-reduced-motion`. Run Playwright at 200% equivalent CSS viewport and verify controls remain reachable and text does not clip.

- [ ] **Step 7: Run accessibility and focused UI tests**

Run: `npm run test:e2e --workspace @sbo/optimizer-client -- e2e/qol-accessibility.spec.ts e2e/acceptance.spec.ts`  
Expected: PASS at desktop, mobile, and 320px projects.

- [ ] **Step 8: Commit Task 12**

```bash
git add optimizer-v2/client/package.json optimizer-v2/package-lock.json optimizer-v2/client/src/styles optimizer-v2/client/src/features optimizer-v2/client/e2e
git commit -m "feat: complete responsive accessible QOL flow"
```

---

### Task 13: Release 1 Reliability, Visual QA, and Deployment

**Files:**
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/guest-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/cloud-flow.spec.ts`
- Modify: `optimizer-v2/scripts/run-reliability.mjs`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`

**Interfaces:**
- Consumes all Release 1 behavior
- Extends reliability evidence with migrations, UI-state fingerprint stability, save dialog, Builds workspace, equipment query stress, and accessibility results

- [ ] **Step 1: Write failing end-to-end Release 1 scenarios**

Cover:

- v3 IndexedDB upgrade to v4 without build loss
- Preferences and checklist changes leaving the fingerprint unchanged
- Stats quick controls and recommended allocation
- Equipment search, comparison, and equip
- Results completion, dismissal replacement, cost total, and export
- Save overwrite/duplicate/cancel
- Builds rename/archive/search/sort/delete cancellation
- Offline save and reconnect sync
- Desktop 1440x1000, tablet 768x1024, mobile 390x844, and 320x700

- [ ] **Step 2: Run focused E2E and verify red**

Run: `npm run test:e2e --workspace @sbo/optimizer-client -- e2e/guest-flow.spec.ts e2e/cloud-flow.spec.ts e2e/reliability-flow.spec.ts e2e/qol-accessibility.spec.ts`  
Expected: FAIL until all Release 1 routes and state transitions are wired.

- [ ] **Step 3: Complete integration wiring found by E2E**

Fix only observed contract gaps. Do not weaken assertions, remove accessibility checks, or ignore console warnings.

- [ ] **Step 4: Run full unit and type gates**

```bash
npm run test:unit
npm run typecheck
npm run validate:coverage
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code -- client/src/module_bindings
```

Expected: zero failures, valid dataset `2026.08.30.1` or newer published verified release, and clean generated bindings.

- [ ] **Step 5: Run full local integration and Pages gates**

```bash
npm run test:integration
npm run test:pages
```

Expected: every integration phase and all Pages deep-link tests pass.

- [ ] **Step 6: Capture and inspect visual evidence**

Capture Home, Character, Stats, Equipment picker, Results checklist, Save dialog, Builds workspace, and their mobile states. Compare them with the accepted existing visual language at matching viewports. Reject blank, loading, cropped, overflowing, or mismatched screenshots.

- [ ] **Step 7: Run the complete reliability command on the final tree**

Run: `npm run test:reliability`  
Expected: JSON summary with `status: "passed"` for unit, typecheck, coverage, SpacetimeDB build, integration, and Pages.

- [ ] **Step 8: Update acceptance evidence**

Record exact test counts, viewport checks, migration fixtures, catalog query timing, screenshots, known limitations, and commit hash in `ACCEPTANCE.md` and `RELIABILITY.md`.

- [ ] **Step 9: Commit Task 13**

```bash
git add optimizer-v2/client/e2e optimizer-v2/scripts/run-reliability.mjs optimizer-v2/ACCEPTANCE.md optimizer-v2/RELIABILITY.md
git commit -m "test: verify QOL release one"
```

- [ ] **Step 10: Integrate only after user approval**

Merge the verified branch into `main`, rerun `npm run test:reliability` from merged `main`, then push `main`. Watch both GitHub workflows to completion and smoke-test the live GitHub Pages app before reporting the release complete.
