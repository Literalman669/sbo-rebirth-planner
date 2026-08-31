# SBO:Rebirth QOL Release 2 Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-first Inventory workspace that manages canonical ownership, favorites, comparison, notes, active-build equipment, backups, and optional SpacetimeDB synchronization without changing optimizer determinism.

**Architecture:** Add a versioned `InventoryState` beside build and plan-progress state, persisted in a new IndexedDB v5 store and mirrored as one private validated SpacetimeDB JSON row. `InventoryProvider` owns local interaction and resolves its owned set into the active draft; saved revisions retain that resolved set for reproducibility. The Inventory and Equipment Comparison routes reuse the verified catalog, query index, and equipment projection helpers, while UI-only inventory filters never enter the optimizer fingerprint.

**Tech Stack:** React 19.2.8, TypeScript 7.0.2, Vite 8.2.2, React Router 7.18.3, Zod 4.5.2, idb 8.0.3, SpacetimeDB 2.8.3, Vitest 4.1.11, Playwright 1.62.1, lucide-react 1.37.0, @axe-core/playwright 4.13.0

**Spec:** `docs/superpowers/specs/2026-08-30-sbo-qol-roadmap-design.md`

## Global Constraints

- Preserve `/character`, `/stats`, `/equipment`, and `/results` deep links.
- Add `/inventory` and `/compare/equipment`; do not combine the product into one page.
- Guest mode remains complete and sign-in remains optional.
- Only published verified catalog records may be browsed, compared, equipped, or linked.
- Unknown prices, requirements, effects, locations, and formulas remain explicit.
- Inventory filters, favorites, notes, and comparison membership do not change the optimizer fingerprint.
- Ownership affects recommendations only through the resolved `ownedItemIds` copied into the active draft.
- Existing local and cloud builds must migrate without silent deletion or substitution.
- IndexedDB changes require a version increment, a real v4 migration fixture, and quarantine for invalid inventory state.
- SpacetimeDB schema additions must be appended with non-destructive defaults/order and pass generated-binding cleanliness.
- Preserve the castle, Cinzel, parchment, brass, teal, and ornamental visual system.
- Use lucide-react for new utility icons.
- Support 320px and wider without horizontal page overflow.
- Implement with test-first red-green cycles and small commits.
- Execute inline with review checkpoints, matching the user's stated preference.

---

## File Structure

### Inventory domain and local state

- `optimizer-v2/client/src/domain/inventory/state.ts` — public inventory types, defaults, normalization, deterministic merge.
- `optimizer-v2/client/src/domain/inventory/stateSchema.ts` — strict Zod state and backup schemas plus migration.
- `optimizer-v2/client/src/domain/inventory/stateSchema.test.ts` — valid, corrupt, merge, shortlist-cap, and backup fixtures.
- `optimizer-v2/client/src/infrastructure/storage/inventoryStore.ts` — IndexedDB load/save/reset/import/export and quarantine adapter.
- `optimizer-v2/client/src/infrastructure/storage/inventoryStore.test.ts` — v4-to-v5 migration and corrupt-row recovery.
- `optimizer-v2/client/src/app/providers/InventoryContext.ts` — narrow consumer interface.
- `optimizer-v2/client/src/app/providers/InventoryProvider.tsx` — local-first mutations, active-draft ownership resolution, status.
- `optimizer-v2/client/src/app/providers/InventoryProvider.test.tsx` — hydration, merge, cap, draft sync, and error tests.

### Cloud inventory

- `optimizer-v2/spacetimedb/src/schema.ts` — append `userInventory` after deployed tables.
- `optimizer-v2/spacetimedb/src/validation.ts` — strict inventory JSON validation.
- `optimizer-v2/spacetimedb/src/playerReducers.ts` — `upsertUserInventory` reducer.
- `optimizer-v2/spacetimedb/src/playerViews.ts` — private `my_user_inventory` view.
- `optimizer-v2/spacetimedb/src/plannerState.test.ts` — inventory ownership/validation/idempotence reducer tests.
- `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts` — inventory row parser/selector.
- `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.ts` — durable `inventory` mutation variant.
- `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts` — save/retry inventory methods.
- `optimizer-v2/client/src/app/providers/CloudDataContext.ts` — validated cloud inventory field.
- `optimizer-v2/client/src/app/providers/CloudDataProvider.tsx` — subscribe to generated inventory view.
- `optimizer-v2/client/src/app/providers/CloudBuildsProvider.tsx` — merge once, mirror changes, and report queued state.

### Player workspaces

- `optimizer-v2/client/src/domain/inventory/catalog.ts` — inventory filtering, sorting, unresolved-ID reporting, comparison rows.
- `optimizer-v2/client/src/domain/inventory/catalog.test.ts` — 1,000-record determinism/performance and unknown-data cases.
- `optimizer-v2/client/src/features/inventory/InventoryScreen.tsx` — catalog toolbar, incremental cards, detail pane, notes, backups.
- `optimizer-v2/client/src/features/inventory/InventoryItemCard.tsx` — item summary and quick actions.
- `optimizer-v2/client/src/features/inventory/InventoryBackupDialog.tsx` — explicit import/export/reset flow.
- `optimizer-v2/client/src/features/inventory/EquipmentComparisonScreen.tsx` — two-to-four-item comparison and equip/remove actions.
- `optimizer-v2/client/src/features/inventory/inventory.test.tsx` — route, keyboard, filters, state, comparison, and backup behavior.
- `optimizer-v2/client/src/features/equipment/EquipmentPicker.tsx` — route Mark Owned/Favorite/Compare through canonical inventory.
- `optimizer-v2/client/src/features/equipment/EquipmentDetail.tsx` — add Favorite and Compare actions.
- `optimizer-v2/client/src/app/router.tsx` — add `/inventory` and `/compare/equipment`.
- `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx` — enable Inventory route.
- `optimizer-v2/client/src/main.tsx` — install `InventoryProvider` inside `BuildDraftProvider` and outside cloud sync.
- `optimizer-v2/client/src/styles/inventory.css` — route-specific responsive layout imported by global CSS.
- `optimizer-v2/client/e2e/inventory-flow.spec.ts` — guest, backup, comparison, equip, mobile, and cloud/offline flow.
- `optimizer-v2/scripts/integration-phase-plan.mjs` — include inventory flow in the core phase.

---

### Task 1: Versioned Inventory Domain

**Files:**
- Create: `optimizer-v2/client/src/domain/inventory/state.ts`
- Create: `optimizer-v2/client/src/domain/inventory/stateSchema.ts`
- Create: `optimizer-v2/client/src/domain/inventory/stateSchema.test.ts`

**Interfaces:**
- Produces: `InventoryState`, `InventoryBackup`, `EMPTY_INVENTORY`, `normalizeInventoryState`, `mergeInventoryStates`, `migrateInventoryState`, `parseInventoryBackup`.
- Constraints: at most 2,000 owned IDs, 2,000 favorite IDs, 4 comparison IDs, 500 notes, and 500 characters per note.

- [ ] **Step 1: Write failing schema, normalization, merge, and backup tests**

```ts
const local = inventory({ ownedItemIds: ['iron-greatsword'], comparisonItemIds: ['a', 'b'] });
const cloud = inventory({ ownedItemIds: ['beginner-armor'], comparisonItemIds: ['b', 'c'], notes: { c: 'Cloud note' } });
expect(mergeInventoryStates(local, cloud)).toEqual(expect.objectContaining({
  ownedItemIds: ['beginner-armor', 'iron-greatsword'],
  comparisonItemIds: ['a', 'b', 'c'],
  notes: { c: 'Cloud note' },
}));
expect(() => migrateInventoryState({ schemaVersion: 1, comparisonItemIds: ['1', '2', '3', '4', '5'] }))
  .toThrow('Stored inventory is invalid');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/inventory/stateSchema.test.ts`

Expected: FAIL because the inventory modules do not exist.

- [ ] **Step 3: Implement strict types and deterministic helpers**

```ts
export type InventoryState = {
  schemaVersion: 1;
  ownedItemIds: string[];
  favoriteItemIds: string[];
  comparisonItemIds: string[];
  notes: Record<string, string>;
};

export function mergeInventoryStates(local: InventoryState, cloud: InventoryState): InventoryState {
  return normalizeInventoryState({
    schemaVersion: 1,
    ownedItemIds: [...cloud.ownedItemIds, ...local.ownedItemIds],
    favoriteItemIds: [...cloud.favoriteItemIds, ...local.favoriteItemIds],
    comparisonItemIds: [...local.comparisonItemIds, ...cloud.comparisonItemIds].slice(0, 4),
    notes: { ...local.notes, ...cloud.notes },
  });
}
```

Normalization must trim IDs/notes, remove duplicates, sort owned/favorite IDs, preserve comparison order, remove blank notes, and clone all collections.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/inventory/stateSchema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the inventory domain**

```bash
git add optimizer-v2/client/src/domain/inventory
git commit -m "feat: add versioned inventory state"
```

### Task 2: IndexedDB v5 Inventory Persistence and Recovery

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/inventoryStore.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/inventoryStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`

**Interfaces:**
- Consumes: `InventoryState`, `InventoryBackup`, `migrateInventoryState`, `parseInventoryBackup`.
- Produces: `InventoryStore` with `load`, `save`, `reset`, `exportBackup`, and `importBackup`.

- [ ] **Step 1: Add failing v4-to-v5 and corrupt-row tests**

```ts
expect(GUEST_DATABASE_VERSION).toBe(5);
const database = await openPlannerDatabase(databaseName);
expect(database.objectStoreNames.contains('inventory')).toBe(true);
await database.put('inventory', { schemaVersion: 99 }, 'primary');
await expect(store.load()).rejects.toThrow('Stored inventory is invalid');
expect(await quarantineRows(databaseName)).toContainEqual(
  expect.objectContaining({ kind: 'inventory' }),
);
```

The Playwright fixture must open a real v4 database containing draft/build/progress rows, upgrade it, and assert those rows survive alongside the new empty inventory.

- [ ] **Step 2: Run persistence tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/inventoryStore.test.ts src/infrastructure/storage/plannerDatabase.test.ts`

Expected: FAIL with version 4 and missing `inventory` store.

- [ ] **Step 3: Implement the additive database migration and store**

```ts
export const GUEST_DATABASE_VERSION = 5;
const PLANNER_STORE_NAMES = [
  'draft', 'builds', 'pending-revisions', 'dataset-releases',
  'planner-preferences', 'plan-progress', 'pending-planner-state',
  'quarantine', 'inventory',
] as const;
```

`importBackup` validates before writing; corrupt imports never replace current state. `exportBackup` emits stable two-space JSON with one trailing newline and includes `schemaVersion`, `exportedAt`, `datasetVersion`, and `inventory`.

- [ ] **Step 4: Run persistence and migration tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/inventoryStore.test.ts src/infrastructure/storage/plannerDatabase.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit IndexedDB v5**

```bash
git add optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/e2e/reliability-flow.spec.ts
git commit -m "feat: persist inventory in indexeddb v5"
```

### Task 3: Inventory Provider and Active-Draft Ownership Resolution

**Files:**
- Create: `optimizer-v2/client/src/app/providers/InventoryContext.ts`
- Create: `optimizer-v2/client/src/app/providers/InventoryProvider.tsx`
- Create: `optimizer-v2/client/src/app/providers/InventoryProvider.test.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`
- Modify: `optimizer-v2/client/src/features/equipment/EquipmentScreen.tsx`

**Interfaces:**
- Produces: `useInventory()` and `useOptionalInventory()`.
- `InventoryContextValue`: `inventory`, `isHydrated`, `persistenceStatus`, `storageError`, `setOwned`, `toggleFavorite`, `toggleComparison`, `setNote`, `replaceInventory`, `resetInventory`.
- `toggleComparison(itemId)` returns `{ ok: true } | { ok: false; reason: 'comparison-full' }`.

- [ ] **Step 1: Write failing provider behavior tests**

```tsx
expect(screen.getByText('Owned iron-greatsword')).toBeVisible();
await user.click(screen.getByRole('button', { name: 'Own beginner-armor' }));
await waitFor(() => expect(store.save).toHaveBeenCalledWith(
  expect.objectContaining({ ownedItemIds: ['beginner-armor', 'iron-greatsword'] }),
));
expect(updateDraft).toHaveBeenCalledWith({
  ownedItemIds: ['beginner-armor', 'iron-greatsword'],
});
```

Cover first-hydration migration from the active draft, canonical inventory replacing ownership when another build loads, comparison cap, note removal, reset, and storage errors.

- [ ] **Step 2: Run provider tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/InventoryProvider.test.tsx`

Expected: FAIL because the provider is missing.

- [ ] **Step 3: Implement the provider with a bounded 250 ms local autosave**

The initial load merges existing `draft.ownedItemIds` once for migration. After hydration, the canonical owned list is copied to each active draft and later ownership changes call `updateDraft({ ownedItemIds })`. Favorites, notes, and comparison changes never call `updateDraft`.

- [ ] **Step 4: Install provider ordering and route Equipment ownership through it**

```tsx
<BuildDraftProvider>
  <InventoryProvider>
    <PlannerStateProvider>
      <CloudBuildsProvider>{children}</CloudBuildsProvider>
    </PlannerStateProvider>
  </InventoryProvider>
</BuildDraftProvider>
```

Replace `EquipmentScreen.markOwned` with `inventory.setOwned(itemId, true)` and leave equip changes on `CharacterProfile.equipped`.

- [ ] **Step 5: Run provider and planner tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/InventoryProvider.test.tsx src/features/planner/plannerScreens.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the provider integration**

```bash
git add optimizer-v2/client/src/app/providers optimizer-v2/client/src/main.tsx optimizer-v2/client/src/features/equipment/EquipmentScreen.tsx
git commit -m "feat: make inventory ownership canonical"
```

### Task 4: Additive SpacetimeDB Inventory Persistence

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerViews.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Modify: `optimizer-v2/spacetimedb/src/plannerState.test.ts`
- Modify: `optimizer-v2/scripts/schema-migration.test.mjs`

**Interfaces:**
- Adds private table `user_inventory(identity primary key, inventoryJson, updatedAt)` at the end of deployed schema order.
- Adds reducer `upsertUserInventory({ inventoryJson: string })`.
- Adds view `my_user_inventory` returning only the sender's row.
- Produces server helper `validateInventoryJson(value: string): string[]`.

- [ ] **Step 1: Write failing validation, identity-isolation, idempotence, and schema-order tests**

```ts
expect(validateInventoryJson(JSON.stringify(EMPTY_INVENTORY))).toEqual([]);
expect(validateInventoryJson(JSON.stringify({ ...EMPTY_INVENTORY, comparisonItemIds: ['1','2','3','4','5'] })))
  .toContain('Inventory comparison list is invalid');
```

The migration test must assert `userInventory` appears after `userPreference`; no deployed table or column is reordered.

- [ ] **Step 2: Run module and migration tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-module && node --test scripts/schema-migration.test.mjs`

Expected: FAIL because the table, reducer, view, and validator do not exist.

- [ ] **Step 3: Implement strict JSON validation and the protected upsert**

The reducer calls `assertAppUser`, validates exact schema version 1, array uniqueness/limits, comparison maximum 4, note keys/lengths, creates the user profile if needed, and returns without a write when JSON is unchanged.

- [ ] **Step 4: Append the schema table and export reducer/view**

```ts
export const userInventory = table(
  { name: 'user_inventory' },
  {
    identity: t.identity().primaryKey(),
    inventoryJson: t.string(),
    updatedAt: t.timestamp(),
  },
);
```

- [ ] **Step 5: Build and regenerate bindings**

Run:

```bash
cd optimizer-v2
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
```

Expected: build/generation succeed and only intentional inventory bindings change.

- [ ] **Step 6: Run module, migration, and binding-cleanliness checks**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-module
node --test optimizer-v2/scripts/schema-migration.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit the additive cloud schema**

```bash
git add optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings optimizer-v2/scripts/schema-migration.test.mjs
git commit -m "feat: add private cloud inventory state"
```

### Task 5: Cloud Merge, Offline Queue, and Real-Time Inventory Sync

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudDataContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudDataProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.test.tsx`
- Modify: `optimizer-v2/client/e2e/cloud-module.spec.ts`

**Interfaces:**
- `createInventorySelector().select(rows)` returns the last validated `InventoryState | null` and never replaces it with a malformed row.
- `BuildRepository.saveInventory(inventory)` returns `'cloud' | 'cloud-pending'`.
- `PendingPlannerStateMutation` gains `{ kind: 'inventory'; inventory: InventoryState; mutationId: 'inventory:primary' }`.
- `CloudDataState.inventory` is validated inventory or `null`.

- [ ] **Step 1: Write failing selector, queue coalescing, offline retry, and provider merge tests**

```ts
await queue.enqueue({
  kind: 'inventory', subject: 'account-a', mutationId: 'inventory:primary',
  inventory: owned('iron-greatsword'), enqueuedAt: first, attempts: 0,
});
await queue.enqueue({
  kind: 'inventory', subject: 'account-a', mutationId: 'inventory:primary',
  inventory: owned('beginner-armor'), enqueuedAt: second, attempts: 0,
});
expect(await queue.list('account-a')).toMatchObject([
  { kind: 'inventory', inventory: { ownedItemIds: ['beginner-armor'] } },
]);
```

Provider tests must prove first-auth merge preserves both local/cloud ownership, later cloud rows become current, offline changes queue, reconnect acknowledges, and UI-only favorite changes do not save a build revision.

- [ ] **Step 2: Run cloud tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud src/app/providers/CloudBuildsProvider.test.tsx`

Expected: FAIL on missing inventory variants and methods.

- [ ] **Step 3: Implement selector, queue variant, repository methods, and subscriptions**

`retryPendingPlannerState` dispatches by kind and acknowledges only after reducer success. Stable mutation IDs coalesce changes. The provider stores the merged state locally before uploading it, records the last cloud fingerprint to avoid loops, and exposes `sync-queued`, `synced`, or `error` through `InventoryProvider`.

- [ ] **Step 4: Add local SpacetimeDB integration coverage**

The browser module test must sign in two sessions, change ownership/favorite in session A, observe it in session B, go offline, change comparison/notes, reconnect, and observe the converged state without extra build revisions.

- [ ] **Step 5: Run cloud unit and module integration tests and verify GREEN**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud src/app/providers/CloudBuildsProvider.test.tsx
npm run test:integration
```

Expected: PASS.

- [ ] **Step 6: Commit cloud inventory sync**

```bash
git add optimizer-v2/client/src/infrastructure/cloud optimizer-v2/client/src/app/providers optimizer-v2/client/e2e/cloud-module.spec.ts
git commit -m "feat: sync inventory through spacetime"
```

### Task 6: Inventory Catalog Workspace

**Files:**
- Create: `optimizer-v2/client/src/domain/inventory/catalog.ts`
- Create: `optimizer-v2/client/src/domain/inventory/catalog.test.ts`
- Create: `optimizer-v2/client/src/features/inventory/InventoryItemCard.tsx`
- Create: `optimizer-v2/client/src/features/inventory/InventoryScreen.tsx`
- Create: `optimizer-v2/client/src/features/inventory/inventory.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/features/shell/GlobalNavigation.tsx`

**Interfaces:**
- `queryInventoryCatalog(index, profile, inventory, query)` returns deterministic `InventoryCatalogResult[]`.
- `InventoryCatalogQuery`: `search`, `slot | 'all'`, `ownership`, `favoriteOnly`, `missingUpgradeOnly`, `pricedOnly`, `sort`.
- Sort values: `name`, `slot`, `level`, `floor`, `price`, `value-per-col`, `projected-improvement`.

- [ ] **Step 1: Write failing catalog query and screen tests**

```ts
expect(queryInventoryCatalog(index, profile, inventory, {
  search: 'great', slot: 'main-hand', ownership: 'missing',
  favoriteOnly: false, missingUpgradeOnly: true, pricedOnly: true,
  sort: 'value-per-col',
}).map((row) => row.item.id)).toEqual(expectedIds);
```

Screen tests cover empty state reasons, 100-item incremental rendering, Owned/Favorite/Compare toggles, note editing, `Equip` availability, exact price/missing-price labels, exact wiki links, keyboard order, and status announcements.

- [ ] **Step 2: Run catalog/screen tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/inventory/catalog.test.ts src/features/inventory/inventory.test.tsx`

Expected: FAIL because catalog and screens are missing.

- [ ] **Step 3: Implement deterministic catalog query**

Reuse `buildEquipmentIndex`, `queryEquipment`, and `compareEquipment`. Memoize indexes by dataset snapshot. Unknown numeric data yields `null`, sorts after known values, and displays `Missing verified data` rather than zero.

- [ ] **Step 4: Implement responsive Inventory screen and item cards**

Desktop uses toolbar + list/detail workspace; mobile uses stacked cards and sticky comparison action. Render 100 records initially and add 100 per `Show more`. `Equip` updates the matching active draft slot only when path/level/floor/access checks yield `equip-now`.

- [ ] **Step 5: Enable route and global navigation**

```tsx
{ path: 'inventory', element: <InventoryScreen /> }
<NavLink to="/inventory"><Package aria-hidden="true" /><span>Inventory</span></NavLink>
```

- [ ] **Step 6: Run catalog, screen, shell, and router tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/inventory/catalog.test.ts src/features/inventory/inventory.test.tsx src/features/shell/shell.test.tsx`

Expected: PASS, including 100 searches over 1,000 records under 1,000 ms.

- [ ] **Step 7: Commit the Inventory workspace**

```bash
git add optimizer-v2/client/src/domain/inventory optimizer-v2/client/src/features/inventory optimizer-v2/client/src/app/router.tsx optimizer-v2/client/src/features/shell/GlobalNavigation.tsx
git commit -m "feat: add verified inventory workspace"
```

### Task 7: Equipment Comparison and Inventory Backups

**Files:**
- Create: `optimizer-v2/client/src/features/inventory/EquipmentComparisonScreen.tsx`
- Create: `optimizer-v2/client/src/features/inventory/InventoryBackupDialog.tsx`
- Modify: `optimizer-v2/client/src/features/inventory/inventory.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/features/equipment/EquipmentDetail.tsx`
- Modify: `optimizer-v2/client/src/features/equipment/EquipmentPicker.tsx`
- Modify: `optimizer-v2/client/src/features/planner/EquipmentScreen.tsx`
- Modify: `optimizer-v2/client/src/domain/results/planExport.ts`

**Interfaces:**
- Route: `/compare/equipment`.
- Comparison accepts two to four IDs; unresolved IDs remain removable and visibly unavailable.
- Backup file: `sbo-rebirth-inventory-v1.json` containing one `InventoryBackup` envelope.

- [ ] **Step 1: Write failing comparison, equip, and backup tests**

```tsx
expect(screen.getByRole('columnheader', { name: 'Iron Greatsword' })).toBeVisible();
expect(screen.getByRole('row', { name: /Price/ })).toHaveTextContent('Missing verified price');
await user.click(screen.getByRole('button', { name: 'Equip Steel Greatsword' }));
expect(updateDraft).toHaveBeenCalledWith({
  equipped: expect.objectContaining({ 'main-hand': 'steel-greatsword' }),
});
```

Import tests cover valid replace, valid merge, cancelled import, corrupt JSON, wrong schema, over-cap comparison, unknown IDs, and confirmation before reset/replace.

- [ ] **Step 2: Run comparison/backup tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/inventory/inventory.test.tsx src/domain/results/planExport.test.ts`

Expected: FAIL because comparison and backup components are missing.

- [ ] **Step 3: Implement comparison table/cards and explicit equip action**

Same-slot verified items show raw and projected deltas. Mixed-slot or incompatible items show `Not comparable for this active build`. Every item keeps its source link, verified/missing-data labels, remove action, and compatible Equip action.

- [ ] **Step 4: Implement backup dialog**

Export uses a Blob download and copy-as-text fallback. Import parses locally, previews counts/dataset version, then requires `Merge` or `Replace`; reset requires confirmation. No file content is sent to SpacetimeDB until validation and user confirmation complete.

- [ ] **Step 5: Wire Favorite and Compare into the existing picker**

`EquipmentDetail` receives `favorite`, `compared`, `onToggleFavorite`, and `onToggleComparison`. Comparison-full errors announce `Remove an item before adding another comparison` and link to `/compare/equipment`.

- [ ] **Step 6: Run comparison, backup, picker, and export tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/inventory src/features/equipment src/domain/results/planExport.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit comparison and backups**

```bash
git add optimizer-v2/client/src/features/inventory optimizer-v2/client/src/features/equipment optimizer-v2/client/src/features/planner/EquipmentScreen.tsx optimizer-v2/client/src/app/router.tsx optimizer-v2/client/src/domain/results
git commit -m "feat: compare and back up inventory"
```

### Task 8: Responsive Styling, Accessibility, Reliability, and Acceptance

**Files:**
- Create: `optimizer-v2/client/src/styles/inventory.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Create: `optimizer-v2/client/e2e/inventory-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/qol-accessibility.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/scripts/integration-phase-plan.mjs`
- Modify: `optimizer-v2/scripts/integration-phase-plan.test.mjs`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`
- Modify: `optimizer-v2/scripts/run-reliability.mjs`

**Interfaces:**
- Core integration phase includes `e2e/inventory-flow.spec.ts` exactly once.
- Reliability summary records IndexedDB `v4-to-v5-with-inventory-preservation` and inventory query thresholds.

- [ ] **Step 1: Write failing Playwright inventory journey**

The test must wait for dataset readiness, open `/inventory`, own/favorite/note/compare items, equip one, reload, export/import merge, validate active draft ownership, sign in, verify second-session sync, queue one offline mutation, reconnect, and confirm convergence without changing the plan fingerprint for favorite/note/comparison-only changes.

- [ ] **Step 2: Add failing accessibility and 320px containment assertions**

Run the Inventory and Comparison routes at 1440x1000, 768x1024, 390x844, and 320x700. Require zero serious/critical axe violations, visible focus, reachable dialogs/actions, and `scrollWidth <= clientWidth` for the page.

- [ ] **Step 3: Run focused e2e and verify RED**

Run: `npm run test:integration`

Expected: FAIL until routes, styles, generated bindings, and cloud flow are complete.

- [ ] **Step 4: Implement route-specific styling**

Use existing tokens and ornamental panel patterns. Desktop list/detail columns collapse below 900px; mobile cards remain single-column; comparison uses contained horizontal scrolling only inside its table region; sticky actions respect safe areas; buttons remain at least 44px high.

- [ ] **Step 5: Update integration phase and reliability evidence**

Update the exact production chunk names/sizes only after the final Pages build. Document unknown-data behavior, migration, cloud sync, recovery, and tested viewport evidence.

- [ ] **Step 6: Run the complete release gate**

Run:

```bash
npm run test:reliability
git diff --check
git status --short
```

Expected: all reliability layers pass, generated bindings are clean, and only intentional source/docs changes remain.

- [ ] **Step 7: Perform visual QA and live-like smoke locally**

Inspect Home, Character, Equipment picker, Inventory, Comparison, Results, and Builds at desktop/mobile widths. Require zero app console errors/warnings; GitHub Pages deep-link recovery remains the only known hosting-level 404 behavior.

- [ ] **Step 8: Commit Release 2 Inventory acceptance evidence**

```bash
git add optimizer-v2
git commit -m "test: verify release two inventory"
```

---

## Self-Review Record

- Spec coverage: canonical ownership, favorites, shortlist, notes, complete verified catalog, value-per-Col, explicit equip, backup, local-first recovery, cloud mirror, accessibility, performance, and deterministic fingerprint separation are assigned to Tasks 1–8.
- Deliberate decomposition: build-to-build comparison/presets/build backup and the Progress dashboard/floor tracker/shopping budget/dataset-impact report are separate follow-on plans because they are independent subsystems.
- Type consistency: all tasks use `InventoryState`, `InventoryBackup`, `InventoryStore`, `InventoryContextValue`, `createInventorySelector`, `saveInventory`, and the `inventory:primary` stable mutation ID consistently.
- Placeholder scan: no TBD/TODO steps or undefined implementation placeholders remain.
