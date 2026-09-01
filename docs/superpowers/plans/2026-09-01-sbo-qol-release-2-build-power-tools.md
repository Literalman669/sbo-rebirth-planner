# SBO:Rebirth QOL Release 2 Build Power Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two-build comparison, verified curated and private personal presets, versioned individual exports, and atomic full-library backups with recoverable local/SpacetimeDB history.

**Architecture:** Introduce one saved-record model that keeps record kind and immutable revisions outside `CharacterProfile`, migrate IndexedDB v5 to v6, and append kind metadata to the deployed SpacetimeDB build/revision rows. A unified local-first library selector feeds dedicated Compare and Presets routes. Pure comparison and portable-file modules keep optimizer work deterministic and import validation atomic, while the existing queue mirrors approved records to SpacetimeDB.

**Tech Stack:** React 19.2.8, TypeScript 7.0.2, Vite 8.2.2, React Router 7.18.3, Zod 4.5.2, idb 8.0.3, SpacetimeDB 2.8.3, Vitest 4.1.11, Playwright 1.62.1, lucide-react 1.37.0, @axe-core/playwright 4.13.0

**Spec:** `docs/superpowers/specs/2026-09-01-sbo-qol-release-2-build-power-tools-design.md`

## Global Constraints

- Compare exactly two builds; do not add an overall winner or fabricated power score.
- Default comparison reproduces each build with its pinned verified dataset.
- Current-dataset comparison is an in-memory preview until the player explicitly creates a new draft.
- Curated presets define safe intent/defaults and never hard-code invented stat allocations or equipment.
- Applying any preset creates a new draft ID and never overwrites the active draft silently.
- Import conflicts duplicate by default; overwrite requires a second confirmation and preserves recovery history.
- Portable files exclude identity, credentials, share-owner data, internal cloud row IDs, and synchronization queues.
- Guest mode remains complete; cloud synchronization and sign-in remain optional.
- Existing IndexedDB v5 data and deployed SpacetimeDB rows must migrate without silent deletion or substitution.
- SpacetimeDB columns are appended after every deployed column with non-destructive defaults.
- Comparison selection, sorting, disclosures, and preset browsing do not change the optimizer fingerprint.
- Preserve the existing castle, Cinzel, parchment, brass, teal, and ornamental visual language.
- Use lucide-react for new utility icons; do not add handcrafted SVG utility icons.
- Support keyboard/touch interaction and 320 px or wider without document overflow.
- Implement every behavior with a failing test first, observe RED, add the minimum implementation, observe GREEN, then commit.
- Execute inline with review checkpoints, matching the user's stated preference.
- Preserve the user-owned untracked `.playwright-mcp/` directory unchanged.

---

## File Structure

### Saved records, history, and local persistence

- `optimizer-v2/client/src/domain/build/record.ts` — saved-record kind, current record, and immutable revision types.
- `optimizer-v2/client/src/domain/build/recordSchema.ts` — strict schemas and v5-row migration helpers.
- `optimizer-v2/client/src/domain/build/recordSchema.test.ts` — legacy/default-kind, revision-chain, and invalid-row tests.
- `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.ts` — IndexedDB v6 and `build-revisions` store.
- `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts` — local current records, history, atomic import, and deletion.
- `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts` — migration, revision, transaction, and recovery tests.
- `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts` — real v5-to-v6 preservation fixture.
- `optimizer-v2/client/src/app/providers/BuildDraftContext.ts` — local build/preset/history/import operations.
- `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx` — operation implementations and refreshed library state.
- `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx` — kind, history, preset, and atomic-import provider tests.

### Private SpacetimeDB records

- `optimizer-v2/spacetimedb/src/schema.ts` — appended `kind` columns on build and revision rows.
- `optimizer-v2/spacetimedb/src/playerReducers.ts` — validate, save, restore, and preserve record kind.
- `optimizer-v2/spacetimedb/src/sharing.ts` — reject direct sharing of personal presets.
- `optimizer-v2/spacetimedb/src/plannerState.test.ts` — authorization, idempotence, restore-kind, and invalid-kind tests.
- `optimizer-v2/scripts/schema-migration.test.mjs` — deployed-column order/default assertions.
- `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.ts` — durable saved-record kind on queued revisions.
- `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts` — legacy default and retry preservation.
- `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts` — kind-aware reducer args and cloud selectors.
- `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts` — current/head kind consistency tests.
- `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts` — kind-aware save and revision-chain import.
- `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts` — local-first preset and imported-history queue tests.
- `optimizer-v2/client/src/infrastructure/cloud/useCloudBuilds.ts` — generated reducer adapter.
- `optimizer-v2/client/src/module_bindings/**` — regenerated SpacetimeDB 2.8.3 TypeScript bindings.

### Unified library and comparison

- `optimizer-v2/client/src/domain/build/library.ts` — deduplicate local/cloud mirrors into local-first entries.
- `optimizer-v2/client/src/domain/build/library.test.ts` — merge, archive, kind, source, and history ordering tests.
- `optimizer-v2/client/src/domain/optimizer/equipmentTotals.ts` — shared verified equipped-stat totals.
- `optimizer-v2/client/src/domain/optimizer/equipmentTotals.test.ts` — missing/current equipment totals.
- `optimizer-v2/client/src/domain/build/comparison.ts` — evaluate one build and produce explicit per-metric differences.
- `optimizer-v2/client/src/domain/build/comparison.test.ts` — ready, unavailable, incomplete, equal, leading, and unknown cases.
- `optimizer-v2/client/src/features/builds/BuildWorkspaceNav.tsx` — Library/Compare/Presets subnavigation.
- `optimizer-v2/client/src/features/builds/BuildComparisonScreen.tsx` — route selection, dataset resolution, preview, and draft creation.
- `optimizer-v2/client/src/features/builds/BuildComparisonTable.tsx` — semantic desktop table and labeled mobile groups.
- `optimizer-v2/client/src/features/builds/BuildComparisonScreen.test.tsx` — selection, refresh, preview, partial failure, and no-mutation tests.

### Presets

- `optimizer-v2/client/src/data/buildPresets.ts` — six versioned balanced path starts with reviewed copy.
- `optimizer-v2/client/src/domain/build/presets.ts` — curated and personal preset application helpers.
- `optimizer-v2/client/src/domain/build/presets.test.ts` — baseline, copied profile, new ID, and immutability tests.
- `optimizer-v2/client/src/features/builds/BuildPresetsScreen.tsx` — curated/personal sections and application flow.
- `optimizer-v2/client/src/features/builds/BuildPresetsScreen.test.tsx` — local/cloud creation, application, archive, and source preservation.

### Portable formats and build-library UI

- `optimizer-v2/client/src/domain/build/portable.ts` — strict v1 envelope, stable serializer, parser, and import planner.
- `optimizer-v2/client/src/domain/build/portable.test.ts` — round trip, limits, privacy, duplicate, overwrite, and revision remapping.
- `optimizer-v2/client/src/features/builds/BuildBackupDialog.tsx` — individual/library export scope and download.
- `optimizer-v2/client/src/features/builds/BuildImportDialog.tsx` — file validation preview, duplicate default, and overwrite confirmation.
- `optimizer-v2/client/src/features/builds/BuildPortableDialogs.test.tsx` — focus, preview, errors, rollback, and download tests.
- `optimizer-v2/client/src/features/builds/BuildsScreen.tsx` — subnavigation, kind filter, compare/preset/import/export actions.
- `optimizer-v2/client/src/features/builds/LocalBuildList.tsx` — kind badges and new card actions.
- `optimizer-v2/client/src/features/builds/CloudBuildList.tsx` — kind badges, safe preset actions, and no preset sharing.
- `optimizer-v2/client/src/features/builds/BuildHistoryScreen.tsx` — local/cloud revision display and restore.
- `optimizer-v2/client/src/app/router.tsx` — `/builds/compare`, `/builds/presets`, and `/compare/builds` redirect.
- `optimizer-v2/client/src/styles/builds.css` — route-specific responsive build-tool styling.
- `optimizer-v2/client/src/styles/global.css` — import `builds.css`.

### Acceptance and deployment

- `optimizer-v2/client/e2e/build-power-tools.spec.ts` — complete guest/local/cloud build-tool journey.
- `optimizer-v2/client/e2e/qol-accessibility.spec.ts` — four-viewport accessibility and containment coverage.
- `optimizer-v2/client/e2e/reliability-flow.spec.ts` — real v5-to-v6 browser migration.
- `optimizer-v2/client/e2e-pages/deep-links.spec.ts` — new Pages deep-link recovery.
- `optimizer-v2/scripts/integration-phase-plan.mjs` — include build-power-tools flow once in core phase.
- `optimizer-v2/scripts/integration-phase-plan.test.mjs` — non-overlapping phase assertion.
- `optimizer-v2/ACCEPTANCE.md` — final Build Power Tools acceptance evidence.
- `optimizer-v2/RELIABILITY.md` — migration, performance, privacy, cloud, and live-smoke evidence.

---

### Task 1: Saved-Record Kind and Immutable Revision Domain

**Files:**
- Create: `optimizer-v2/client/src/domain/build/record.ts`
- Create: `optimizer-v2/client/src/domain/build/recordSchema.ts`
- Create: `optimizer-v2/client/src/domain/build/recordSchema.test.ts`

**Interfaces:**
- Produces: `SavedBuildKind`, `SavedBuildRecord`, `BuildRevisionSnapshot`, `savedBuildKindSchema`, `savedBuildRecordSchema`, `buildRevisionSnapshotSchema`, `migrateSavedBuildRecord`.
- `CharacterProfile` remains recommendation input and does not gain persistence-only kind/history fields.

- [ ] **Step 1: Write failing saved-record and migration tests**

```ts
const legacy = {
  profile: profile({ id: 'legacy-build' }),
  createdAt: '2026-08-30T10:00:00.000Z',
  updatedAt: '2026-08-30T11:00:00.000Z',
};
expect(migrateSavedBuildRecord(legacy)).toMatchObject({
  kind: 'build',
  headRevisionId: 'legacy:legacy-build',
});
expect(() => savedBuildRecordSchema.parse({ ...legacy, kind: 'marketplace' }))
  .toThrow();
expect(buildRevisionSnapshotSchema.parse({
  id: 'revision-1',
  buildId: 'legacy-build',
  kind: 'personal-preset',
  profile: profile({ id: 'legacy-build' }),
  createdAt: '2026-08-30T10:00:00.000Z',
})).toBeDefined();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/recordSchema.test.ts`

Expected: FAIL because the saved-record modules do not exist.

- [ ] **Step 3: Implement the strict types and migration**

```ts
export type SavedBuildKind = 'build' | 'personal-preset';

export interface BuildRevisionSnapshot {
  id: string;
  buildId: string;
  parentRevisionId?: string;
  kind: SavedBuildKind;
  profile: CharacterProfile;
  createdAt: string;
}

export interface SavedBuildRecord {
  profile: CharacterProfile;
  kind: SavedBuildKind;
  headRevisionId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
```

`migrateSavedBuildRecord` accepts only the exact deployed v5 row shape or the
new strict shape. Legacy rows receive `kind: 'build'` and deterministic
`headRevisionId: 'legacy:' + profile.id`; malformed rows throw instead of
inventing profile values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/recordSchema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the saved-record domain**

```bash
git add optimizer-v2/client/src/domain/build/record.ts optimizer-v2/client/src/domain/build/recordSchema.ts optimizer-v2/client/src/domain/build/recordSchema.test.ts
git commit -m "feat: add saved build record model"
```

### Task 2: IndexedDB v6 Build History and Recovery

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`

**Interfaces:**
- Consumes: Task 1 record/revision schemas.
- Extends `GuestBuildStore` with `saveBuild(profile, options?)`, `listBuildHistory(buildId)`, and `restoreBuildRevision(buildId, revisionId, newRevisionId)`.
- `SaveStoredBuildOptions`: `{ kind?: SavedBuildKind; revisionId?: string; parentRevisionId?: string }`.

- [ ] **Step 1: Add failing v5-to-v6 and immutable-history tests**

```ts
expect(GUEST_DATABASE_VERSION).toBe(6);
expect(database.objectStoreNames.contains('build-revisions')).toBe(true);

await store.saveBuild(profile({ id: 'build-a', level: 8 }), {
  revisionId: 'revision-1',
});
await store.saveBuild(profile({ id: 'build-a', level: 9 }), {
  revisionId: 'revision-2',
});
expect((await store.listBuildHistory('build-a')).map((row) => row.id))
  .toEqual(['revision-1', 'revision-2']);
```

The browser fixture must create a real v5 database with draft, builds,
inventory, preferences, and plan progress; open v6; then prove every row is
preserved and the legacy build has one synthesized `build` revision.

- [ ] **Step 2: Run storage tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/plannerDatabase.test.ts src/infrastructure/storage/guestBuildStore.test.ts`

Expected: FAIL with database version 5 and missing `build-revisions` behavior.

- [ ] **Step 3: Add the v6 store and legacy-row migration**

```ts
export const GUEST_DATABASE_VERSION = 6;
const PLANNER_STORE_NAMES = [
  'draft', 'builds', 'pending-revisions', 'dataset-releases',
  'planner-preferences', 'plan-progress', 'pending-planner-state',
  'quarantine', 'inventory', 'build-revisions',
] as const;
```

On the first read of a valid v5 build row, one read-write transaction rewrites
the row with `kind` and `headRevisionId` and inserts the synthesized baseline
revision. An invalid row remains listed as unavailable and is never rewritten.

- [ ] **Step 4: Implement history-safe save, duplicate, restore, and delete**

```ts
async saveBuild(profile, options = {}) {
  const revisionId = options.revisionId ?? crypto.randomUUID();
  const transaction = database.transaction(
    ['builds', 'build-revisions'],
    'readwrite',
  );
  // Parse before writes, insert one immutable revision, update current head,
  // then await transaction.done.
}
```

Identical profile/kind saves are idempotent and do not create duplicate
revisions. Duplicate creates a new build ID and one baseline revision. Restore
copies the selected revision into a new revision whose parent is the current
head. Delete removes current row, revisions, and plan progress in one
transaction.

- [ ] **Step 5: Run storage and migration tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/plannerDatabase.test.ts src/infrastructure/storage/guestBuildStore.test.ts`

Expected: PASS, including v5 preservation and blocked-upgrade recovery.

- [ ] **Step 6: Commit IndexedDB v6 history**

```bash
git add optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/e2e/reliability-flow.spec.ts
git commit -m "feat: persist local build revision history"
```

### Task 3: Kind-Aware SpacetimeDB Revisions and Cloud Queue

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/sharing.ts`
- Modify: `optimizer-v2/spacetimedb/src/plannerState.test.ts`
- Modify: `optimizer-v2/scripts/schema-migration.test.mjs`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/useCloudBuilds.ts`
- Regenerate: `optimizer-v2/client/src/module_bindings/**`

**Interfaces:**
- `saveBuildRevision` gains top-level `kind: 'build' | 'personal-preset'`.
- `BuildRepository.save(profile, options?: { kind?: SavedBuildKind })` defaults to `build`.
- `PendingRevision.kind` defaults to `build` when reading a legacy queued row.
- `CloudBuildRecord` and `CloudBuildHistoryItem` expose `kind`.

- [ ] **Step 1: Write failing schema-order, reducer, mapper, and queue tests**

```ts
expect(toSaveBuildRevisionArgs(profile, 'personal-preset', 'revision-1'))
  .toMatchObject({ kind: 'personal-preset' });
expect(selector.select(snapshot)[0]).toMatchObject({
  kind: 'personal-preset',
  history: [expect.objectContaining({ kind: 'personal-preset' })],
});
await expect(createShareForPreset()).rejects.toThrow(
  'Personal presets must be copied to a build before sharing',
);
```

`schema-migration.test.mjs` must require `kind` after deployed `archivedAt` on
`build` and after deployed `accessPreferences` on `buildRevision`, both with
`default('build')`.

- [ ] **Step 2: Run cloud/module tests and verify RED**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-module -- --run src/plannerState.test.ts
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud/pendingRevisionQueue.test.ts src/infrastructure/cloud/buildMappers.test.ts src/infrastructure/cloud/buildRepository.test.ts
node --test optimizer-v2/scripts/schema-migration.test.mjs
```

Expected: FAIL because kind is absent from deployed rows, reducer input, queue,
and mappers.

- [ ] **Step 3: Append kind columns and enforce the two allowed values**

```ts
// Append after archivedAt in build.
kind: t.string().default('build'),

// Append after accessPreferences in buildRevision.
kind: t.string().default('build'),
```

`saveBuildRevision` validates the kind, writes it to the immutable revision,
and updates the current build row. Idempotence compares kind. Restore copies
the source revision kind back to the new head/current row. Direct share rejects
`personal-preset`; build shares remain unchanged.

- [ ] **Step 4: Make the client queue, mapper, and repository kind-aware**

```ts
export function toSaveBuildRevisionArgs(
  input: CharacterProfile,
  kind: SavedBuildKind,
  revisionId: string,
  parentRevisionId?: string,
) {
  const profile = characterProfileSchema.parse(input);
  return {
    buildId: profile.id,
    revisionId,
    kind,
    name: profile.name?.trim() || 'Untitled build',
    ...(parentRevisionId ? { parentRevisionId } : {}),
    profile: {
      schemaVersion: profile.schemaVersion,
      level: profile.level,
      maxFloor: profile.maxFloor,
      weaponPath: profile.weaponPath,
      goal: profile.goal,
      weaponSkill: profile.weaponSkill,
      str: profile.stats.str,
      def: profile.stats.def,
      agi: profile.stats.agi,
      vit: profile.stats.vit,
      luk: profile.stats.luk,
      datasetVersion: profile.datasetVersion,
      accessPreferences: serializeAccessPreferences(profile.accessPreferences),
    },
    equipment: Object.entries(profile.equipped).map(([slot, itemId]) => ({ slot, itemId })),
    ownedItemIds: [...profile.ownedItemIds],
  };
}
```

Queue parsing migrates missing kind to `build`. Repository fingerprinting
includes kind so a preset cannot be mistaken for an identical normal build.
Active-draft autosave calls `save(draft, { kind: 'build' })`; explicit preset
saves pass `personal-preset`.

- [ ] **Step 5: Regenerate bindings and verify generated cleanliness**

Run:

```bash
cd optimizer-v2/spacetimedb
spacetime build
cd ..
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run typecheck
```

Expected: module builds, bindings contain both kind fields/reducer argument,
and TypeScript passes.

- [ ] **Step 6: Run focused module/client tests and verify GREEN**

Run:

```bash
npm run test:unit --workspace @sbo/optimizer-module -- --run src/plannerState.test.ts
npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud/pendingRevisionQueue.test.ts src/infrastructure/cloud/buildMappers.test.ts src/infrastructure/cloud/buildRepository.test.ts
node --test optimizer-v2/scripts/schema-migration.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit private preset history support**

```bash
git add optimizer-v2/spacetimedb optimizer-v2/client/src/infrastructure/cloud optimizer-v2/client/src/module_bindings optimizer-v2/scripts/schema-migration.test.mjs
git commit -m "feat: sync build kinds through spacetime"
```

### Task 4: Unified Local-First Build Library

**Files:**
- Create: `optimizer-v2/client/src/domain/build/library.ts`
- Create: `optimizer-v2/client/src/domain/build/library.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx`

**Interfaces:**
- Produces: `BuildLibraryEntry`, `mergeBuildLibrary`, `findBuildLibraryEntry`.
- `BuildLibraryEntry`: `{ id, profile, kind, source, archivedAt?, updatedAt, headRevisionId, history }` where source is `local`, `cloud`, or `local+cloud`.
- Adds context methods: `savePersonalPreset`, `loadSavedBuildHistory`, `restoreSavedBuildRevision`.

- [ ] **Step 1: Write failing library merge and provider tests**

```ts
expect(mergeBuildLibrary([localRecord], [cloudRecord])).toEqual([
  expect.objectContaining({
    id: 'build-a',
    source: 'local+cloud',
    profile: localRecord.profile,
    kind: 'build',
  }),
]);
await result.current.savePersonalPreset(sourceProfile, 'Melee farming start');
expect((await store.listBuilds())[0]).toMatchObject({
  ok: true,
  value: { kind: 'personal-preset' },
});
```

Cover cloud-only/local-only records, archived state, newest-first history, local
profile preference for a mirror with queued edits, invalid local rows, and
stable name sorting.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/library.test.ts src/app/providers/BuildDraftProvider.test.tsx`

Expected: FAIL because the library selector and provider methods do not exist.

- [ ] **Step 3: Implement deterministic mirror deduplication**

```ts
export function mergeBuildLibrary(
  local: readonly GuestBuildListResult[],
  cloud: readonly CloudBuildRecord[],
): BuildLibraryEntry[] {
  // One entry per logical profile.id. Local current state wins for a mirror;
  // cloud history is merged by revision ID and sorted by createdAt then ID.
}
```

The function never mutates input records and does not invoke the optimizer.
Invalid local records remain separate unavailable entries in the Builds screen
and are not returned as comparison/preset candidates.

- [ ] **Step 4: Add provider operations with refreshed local state**

`savePersonalPreset` clones the source profile, assigns a new ID/name, saves it
with `kind: 'personal-preset'`, and refreshes `savedBuilds`. Restore uses a new
revision ID and then replaces the active draft only when the restored record is
a normal build.

```ts
const savePersonalPreset = useCallback(async (source: CharacterProfile, name: string) => {
  const preset = characterProfileSchema.parse({
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: name.trim(),
  });
  await store.saveBuild(preset, { kind: 'personal-preset' });
  setSavedBuilds(await store.listBuilds());
  return preset;
}, [store]);
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/library.test.ts src/app/providers/BuildDraftProvider.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the unified library**

```bash
git add optimizer-v2/client/src/domain/build/library.ts optimizer-v2/client/src/domain/build/library.test.ts optimizer-v2/client/src/app/providers/BuildDraftContext.ts optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx
git commit -m "feat: unify local and cloud build records"
```

### Task 5: Deterministic Build Comparison Domain

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/equipmentTotals.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/equipmentTotals.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`
- Create: `optimizer-v2/client/src/domain/build/comparison.ts`
- Create: `optimizer-v2/client/src/domain/build/comparison.test.ts`

**Interfaces:**
- Produces: `equipmentTotalsForProfile`, `evaluateBuildForComparison`, `compareBuildEvaluations`, `BuildComparisonEvaluation`, `BuildComparisonMetricRow`.
- Evaluation statuses: `ready`, `dataset-unavailable`, `profile-incomplete`, `equipment-incomplete`, `optimizer-unavailable`.
- Metric leaders: `left`, `right`, `equal`, `unknown`.

- [ ] **Step 1: Write failing equipped-total and comparison tests**

```ts
expect(equipmentTotalsForProfile(profile, dataset)).toEqual({
  attack: 7.5,
  defense: 1.5,
  dexterity: 6,
});
expect(compareBuildEvaluations(left, right).metrics).toContainEqual({
  id: 'attackPerHit',
  label: 'Damage per hit',
  left: 15,
  right: 12,
  leader: 'left',
  format: 'number',
});
expect(compareBuildEvaluations(unknownLeft, unknownRight).metrics)
  .toContainEqual(expect.objectContaining({ leader: 'unknown' }));
```

Add literal tests for equal values, missing historical dataset, invalid current
equipment, known shopping totals with unknown-price counts, ten-level stat
totals, and no overall winner field.

- [ ] **Step 2: Run focused domain tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer/equipmentTotals.test.ts src/domain/build/comparison.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Extract verified equipped totals and reuse them in optimizer**

```ts
export function equipmentTotalsForProfile(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): GearTotals {
  return dataset.equipment.reduce((totals, item) => {
    if (!Object.values(profile.equipped).includes(item.id)) return totals;
    return {
      attack: totals.attack + item.attack,
      defense: totals.defense + item.defense,
      dexterity: totals.dexterity + item.dexterity,
    };
  }, { attack: 0, defense: 0, dexterity: 0 });
}
```

Replace the inline reducer in `optimizeBuild` without changing optimizer output.

- [ ] **Step 4: Implement explicit evaluation and per-metric comparison**

`evaluateBuildForComparison` validates profile/equipment/readiness, calls
`optimizeBuild`, projects current metrics, builds action checklist and verified
cost totals, and returns stored fields even when derived output is unavailable.
`compareBuildEvaluations` compares only supported numeric values and never
creates an aggregate score.

```ts
export function evaluateBuildForComparison(
  profile: CharacterProfile,
  dataset: DatasetSnapshot | null,
): BuildComparisonEvaluation {
  if (!dataset) return { status: 'dataset-unavailable', profile };
  if (firstIncompleteProfileStep(profile)) {
    return { status: 'profile-incomplete', profile, dataset };
  }
  if (firstIncompleteEquipmentStep(profile, dataset)) {
    return { status: 'equipment-incomplete', profile, dataset };
  }
  const readiness = assessOptimizationReadiness(profile, dataset.pointsPerLevel);
  if (readiness.status !== 'ready') {
    return { status: 'optimizer-unavailable', profile, dataset, explanation: readiness.explanation };
  }
  const plan = optimizeBuild(profile, dataset);
  const metrics = projectMetrics(
    { level: profile.level, stats: profile.stats, gear: equipmentTotalsForProfile(profile, dataset) },
    compileMechanics(dataset),
  );
  const names = new Map(dataset.catalog.map((item) => [item.id, item.name]));
  const actions = buildActionChecklist(profile, plan, names);
  return { status: 'ready', profile, dataset, plan, metrics, actions, costs: sumVerifiedCosts(actions) };
}
```

- [ ] **Step 5: Run comparison plus optimizer regression tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer/equipmentTotals.test.ts src/domain/build/comparison.test.ts src/domain/optimizer/optimizeBuild.test.ts src/domain/optimizer/optimizerStress.test.ts`

Expected: PASS with unchanged deterministic stress output.

- [ ] **Step 6: Commit the comparison domain**

```bash
git add optimizer-v2/client/src/domain/optimizer optimizer-v2/client/src/domain/build/comparison.ts optimizer-v2/client/src/domain/build/comparison.test.ts
git commit -m "feat: evaluate builds for comparison"
```

### Task 6: Dedicated Two-Build Comparison Route

**Files:**
- Create: `optimizer-v2/client/src/features/builds/BuildWorkspaceNav.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildComparisonTable.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildComparisonScreen.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildComparisonScreen.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/builds/LocalBuildList.tsx`
- Modify: `optimizer-v2/client/src/features/builds/CloudBuildList.tsx`

**Interfaces:**
- Canonical route: `/builds/compare?left=<buildId>&right=<buildId>`.
- Compatibility route: `/compare/builds` redirects to `/builds/compare` while preserving search parameters.
- Consumes Task 4 library entries and Task 5 evaluation functions.

- [ ] **Step 1: Write failing route and rendered comparison tests**

```tsx
expect(screen.getByRole('heading', { name: 'Compare Builds' })).toBeVisible();
await user.selectOptions(screen.getByLabelText('First build'), 'build-a');
await user.selectOptions(screen.getByLabelText('Second build'), 'build-b');
expect(router.state.location.search).toBe('?left=build-a&right=build-b');
expect(screen.getByRole('row', { name: /Damage per hit/ }))
  .toHaveTextContent('Higher verified value: First build');
```

Cover identical selection rejection, swap, remove, deleted query selection,
mixed historical releases, one unavailable release, current-dataset preview,
preview equipment invalidation, create-new-draft action, refresh persistence,
and unchanged stored records/fingerprints.

- [ ] **Step 2: Run screen/router tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/builds/BuildComparisonScreen.test.tsx src/features/builds/BuildsScreen.test.tsx src/app/App.test.tsx`

Expected: FAIL because routes and components are absent.

- [ ] **Step 3: Implement subnavigation and query-backed selection**

```tsx
<nav aria-label="Build tools">
  <NavLink end to="/builds">Library</NavLink>
  <NavLink to="/builds/compare">Compare</NavLink>
  <NavLink to="/builds/presets">Presets</NavLink>
</nav>
```

The screen resolves each pinned dataset independently with
`resolveDatasetSnapshot`. `Preview both with dataset X` clones profiles in
memory with `datasetVersion: X`; it does not call any save/update method.

- [ ] **Step 4: Implement semantic differences table and mobile groups**

Rows include character fields, five stats, spend-now/future allocations,
equipped slots, item requirements/prices/sources, supported projected metrics,
immediate action, and known/unknown shopping costs. Every leader label names a
specific metric; equal and unknown states use text, not color alone.

```tsx
function formatComparisonValue(value: number | null, format: 'number' | 'percent') {
  if (value === null) return 'Missing verified data';
  return format === 'percent'
    ? `${(value * 100).toFixed(2)}%`
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function leaderLabel(leader: BuildComparisonMetricRow['leader']) {
  if (leader === 'left') return 'Higher verified value: First build';
  if (leader === 'right') return 'Higher verified value: Second build';
  if (leader === 'equal') return 'Equal verified value';
  return 'Comparison unavailable';
}

<tbody>
  {comparison.metrics.map((row) => (
    <tr key={row.id}>
      <th scope="row">{row.label}</th>
      <td>{formatComparisonValue(row.left, row.format)}</td>
      <td>{formatComparisonValue(row.right, row.format)}</td>
      <td>{leaderLabel(row.leader)}</td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 5: Add safe create-draft-from-preview action**

The action assigns a new ID and distinct name, calls `replaceDraft`, and routes
to `/character`. It is disabled when current-preview equipment is invalid. It
never saves automatically or mutates either source record.

```ts
const createDraftFromPreview = (entry: BuildLibraryEntry) => {
  const next = characterProfileSchema.parse({
    ...structuredClone(entry.profile),
    id: crypto.randomUUID(),
    name: `${entry.profile.name ?? `Level ${entry.profile.level} build`} preview`.slice(0, 60),
    datasetVersion: snapshot.version,
  });
  replaceDraft(next);
  navigate('/character');
};
```

- [ ] **Step 6: Run screen/router tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/builds/BuildComparisonScreen.test.tsx src/features/builds/BuildsScreen.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the comparison workspace**

```bash
git add optimizer-v2/client/src/features/builds optimizer-v2/client/src/app/router.tsx
git commit -m "feat: add two build comparison workspace"
```

### Task 7: Verified Curated and Private Personal Presets

**Files:**
- Create: `optimizer-v2/client/src/data/buildPresets.ts`
- Create: `optimizer-v2/client/src/domain/build/presets.ts`
- Create: `optimizer-v2/client/src/domain/build/presets.test.ts`
- Create: `optimizer-v2/client/src/features/builds/BuildPresetsScreen.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildPresetsScreen.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/builds/LocalBuildList.tsx`
- Modify: `optimizer-v2/client/src/features/builds/CloudBuildList.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildHistoryScreen.tsx`

**Interfaces:**
- Produces: `CuratedBuildPreset`, `CURATED_PRESET_POLICY_VERSION`, `curatedBuildPresets`, `createDraftFromCuratedPreset`, `createDraftFromPersonalPreset`.
- Curated set contains one balanced start for each of the six existing weapon paths.
- Personal presets are saved records with `kind: 'personal-preset'`.

- [ ] **Step 1: Write failing preset domain and screen tests**

```ts
expect(curatedBuildPresets.map((preset) => preset.weaponPath)).toEqual([
  'two-handed', 'one-handed', 'rapier', 'dagger', 'dual-wield', 'melee',
]);
expect(createDraftFromCuratedPreset(curatedBuildPresets[0], {
  id: 'new-id', datasetVersion: '2026.08.30.1',
})).toMatchObject({
  id: 'new-id', level: 1, maxFloor: 1,
  stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
  equipped: {}, ownedItemIds: [], goal: 'balanced',
});
expect(createDraftFromPersonalPreset(source, 'copy-id').id).toBe('copy-id');
expect(source.id).toBe('preset-id');
```

Screen tests cover separate curated/personal headings, path preview, Apply
routing to Character, new IDs, save-as-preset local/cloud destination, no
direct personal-preset share button, archive, rename, duplicate, history, and
source immutability.

- [ ] **Step 2: Run preset tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/presets.test.ts src/features/builds/BuildPresetsScreen.test.tsx`

Expected: FAIL because preset data/helpers/route are absent.

- [ ] **Step 3: Add six versioned curated starts without stat advice**

```ts
export const CURATED_PRESET_POLICY_VERSION = 'sbo-presets-v1' as const;
export const curatedBuildPresets: readonly CuratedBuildPreset[] = [
  { id: 'balanced-two-handed', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Two-Handed Start', weaponPath: 'two-handed',
    goal: 'balanced', description: 'A guided balanced start for two-handed weapons.' },
  { id: 'balanced-one-handed', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced One-Handed Start', weaponPath: 'one-handed',
    goal: 'balanced', description: 'A guided balanced start for one-handed weapons.' },
  { id: 'balanced-rapier', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Rapier Start', weaponPath: 'rapier',
    goal: 'balanced', description: 'A guided balanced start for rapier weapons.' },
  { id: 'balanced-dagger', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Dagger Start', weaponPath: 'dagger',
    goal: 'balanced', description: 'A guided balanced start for dagger weapons.' },
  { id: 'balanced-dual-wield', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Dual Wield Start', weaponPath: 'dual-wield',
    goal: 'balanced', description: 'A guided balanced start for dual-wield weapons.' },
  { id: 'balanced-melee', policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Melee Start', weaponPath: 'melee',
    goal: 'balanced', description: 'A guided balanced start for melee.' },
];
```

Every generated draft starts at the verified new-character baseline and leaves
equipment empty for the existing verified starter rule. The data file contains
no stat totals, item IDs, prices, or unsupported game claims.

- [ ] **Step 4: Implement personal preset creation and application**

Saving as preset assigns a new ID and kind, writes locally first, and passes
`personal-preset` to cloud repository when cloud destination is selected.
Applying clones the full profile, assigns a new ID/name, changes the active
draft only, and routes to Character for review.

```ts
const preset = await savePersonalPreset(source.profile, presetName);
if (destination === 'cloud' && cloud?.isAuthenticated) {
  await cloud.repository.save(preset, { kind: 'personal-preset' });
}

const nextDraft = createDraftFromPersonalPreset(preset, crypto.randomUUID());
replaceDraft(nextDraft);
navigate('/character');
```

- [ ] **Step 5: Enable route, card actions, and local/cloud history**

```tsx
{ path: 'builds/presets', element: <BuildPresetsScreen /> }
```

Normal build cards gain `Save as preset`; preset cards gain `Use preset`.
`BuildHistoryScreen` resolves local history first, then cloud history, and
marks current/restored revisions without exposing a Share action for presets.

- [ ] **Step 6: Run preset/build/history tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/presets.test.ts src/features/builds/BuildPresetsScreen.test.tsx src/features/builds/BuildsScreen.test.tsx src/features/builds/BuildHistoryScreen.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit presets**

```bash
git add optimizer-v2/client/src/data/buildPresets.ts optimizer-v2/client/src/domain/build/presets.ts optimizer-v2/client/src/domain/build/presets.test.ts optimizer-v2/client/src/features/builds optimizer-v2/client/src/app/router.tsx
git commit -m "feat: add curated and personal build presets"
```

### Task 8: Versioned Portable Build and Library Format

**Files:**
- Create: `optimizer-v2/client/src/domain/build/portable.ts`
- Create: `optimizer-v2/client/src/domain/build/portable.test.ts`

**Interfaces:**
- Produces: `PortableBuildEnvelope`, `PortableBuildRecord`, `BuildImportMode`, `BuildImportPlan`, `createBuildBackup`, `serializeBuildBackup`, `parseBuildBackup`, `planBuildImport`.
- Format discriminator: `sbo-rebirth-build-library`.
- Schema version: `1`.
- Limits: 10 MiB UTF-8 input, 250 records, 100 revisions per record, 60-character names, existing profile bounds.
- `BuildImportPlan`: `{ mode, records, preview }`, where each preview row contains source ID, target ID, name, kind, dataset version, revision count, conflict, and action.

- [ ] **Step 1: Write failing round-trip, privacy, limit, and conflict tests**

```ts
const serialized = serializeBuildBackup(createBuildBackup({
  scope: 'library', exportedAt: '2026-09-01T12:00:00.000Z', records,
}));
expect(parseBuildBackup(serialized)).toEqual(expectedEnvelope);
expect(serialized.endsWith('\n')).toBe(true);
expect(serialized).not.toMatch(/identity|idToken|shareId|pendingQueue|owner/i);
expect(() => parseBuildBackup(oversizedText)).toThrow('Build backup exceeds 10 MiB');
```

Conflict tests prove duplicate mode remaps build/revision/parent/progress IDs,
overwrite mode attaches the imported first revision to the existing head, and
unsupported future schemas or extra private keys fail strict parsing.

- [ ] **Step 2: Run portable-format tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/portable.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement strict envelope and stable serialization**

```ts
export type PortableBuildEnvelope = {
  format: 'sbo-rebirth-build-library';
  schemaVersion: 1;
  scope: 'single' | 'library';
  exportedAt: string;
  records: PortableBuildRecord[];
};
```

`PortableBuildRecord` contains kind, current profile, head revision, timestamps,
archive state, optional plan progress, and validated revision snapshots. The
serializer sorts records by ID and revisions by created time then ID, emits
two-space JSON, and adds exactly one trailing newline.

- [ ] **Step 4: Implement import planning with duplicate as default**

```ts
export function planBuildImport(
  envelope: PortableBuildEnvelope,
  existing: ReadonlyMap<string, { headRevisionId: string }>,
  options: { mode?: BuildImportMode; randomUUID(): string },
): BuildImportPlan {
  const mode = options.mode ?? 'duplicate';
  const records = envelope.records.map((source) => {
    const conflict = existing.get(source.profile.id);
    const overwriting = mode === 'overwrite' && Boolean(conflict);
    const targetBuildId = overwriting ? source.profile.id : options.randomUUID();
    const revisionIds = new Map(
      source.revisions.map((revision) => [revision.id, options.randomUUID()]),
    );
    const revisions = source.revisions.map((revision, index) => ({
      ...structuredClone(revision),
      id: revisionIds.get(revision.id)!,
      buildId: targetBuildId,
      profile: { ...structuredClone(revision.profile), id: targetBuildId },
      parentRevisionId:
        index === 0 && overwriting
          ? conflict!.headRevisionId
          : revision.parentRevisionId
            ? revisionIds.get(revision.parentRevisionId)
            : undefined,
    }));
    const sourceName = source.profile.name ?? `Level ${source.profile.level} build`;
    const importedName = overwriting ? sourceName : `${sourceName} imported`.slice(0, 60);
    return {
      ...structuredClone(source),
      profile: { ...structuredClone(source.profile), id: targetBuildId, name: importedName },
      headRevisionId: revisionIds.get(source.headRevisionId)!,
      revisions,
      ...(source.planProgress
        ? { planProgress: { ...structuredClone(source.planProgress), buildId: targetBuildId } }
        : {}),
    };
  });
  return {
    mode,
    records,
    preview: records.map((record, index) => ({
      sourceId: envelope.records[index]!.profile.id,
      targetId: record.profile.id,
      name: record.profile.name ?? `Level ${record.profile.level} build`,
      kind: record.kind,
      datasetVersion: record.profile.datasetVersion,
      revisionCount: record.revisions.length,
      conflict: existing.has(envelope.records[index]!.profile.id),
      action: mode === 'overwrite' && existing.has(envelope.records[index]!.profile.id)
        ? 'overwrite'
        : 'duplicate',
    })),
  };
}
```

Default mode is `duplicate`. Overwrite never discards the existing head: the
first imported revision is reparented to it. Planning is pure and performs all
validation/remapping before a storage transaction starts.

- [ ] **Step 5: Run portable-format tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/portable.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the portable format**

```bash
git add optimizer-v2/client/src/domain/build/portable.ts optimizer-v2/client/src/domain/build/portable.test.ts
git commit -m "feat: add versioned build backup format"
```

### Task 9: Atomic Import, Export, and Build-Library Integration

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildBackupDialog.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildImportDialog.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildPortableDialogs.test.tsx`
- Modify: `optimizer-v2/client/src/features/builds/BuildsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/builds/LocalBuildList.tsx`
- Modify: `optimizer-v2/client/src/features/builds/CloudBuildList.tsx`

**Interfaces:**
- Adds `GuestBuildStore.exportBuildRecords(ids?)` and `importBuildPlan(plan)`.
- Adds `BuildRepository.importBuildRecords(records)` for queued revision-chain replay.
- Dialogs consume Task 8 parser/planner and never parse inside render.

- [ ] **Step 1: Write failing atomic-store, queue-chain, and dialog tests**

```ts
await store.importBuildPlan(plan);
expect((await store.listBuilds()).filter((row) => row.ok)).toHaveLength(2);
expect(await store.listBuildHistory(plan.records[0].profile.id))
  .toHaveLength(plan.records[0].revisions.length);

await repository.importBuildRecords([recordWithThreeRevisions]);
expect((await pendingQueue.list(subject)).map((row) => row.parentRevisionId))
  .toEqual([undefined, 'revision-1', 'revision-2']);
```

Dialog tests cover single/library download, local-only scope warning when cloud
is unavailable, valid preview counts, missing dataset warning, rejected record
reasons, duplicate preselection, explicit overwrite second confirmation,
cancelled file choice, future schema, oversize input, status announcements,
focus return, and no writes after any validation failure.

- [ ] **Step 2: Run focused storage/repository/dialog tests and verify RED**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/guestBuildStore.test.ts src/infrastructure/cloud/buildRepository.test.ts src/features/builds/BuildPortableDialogs.test.tsx`

Expected: FAIL because atomic import/export methods and dialogs are absent.

- [ ] **Step 3: Implement one local transaction for each import plan**

```ts
const transaction = database.transaction(
  ['builds', 'build-revisions', 'plan-progress'],
  'readwrite',
);
for (const record of plan.records) {
  await transaction.objectStore('builds').put({
    profile: record.profile,
    kind: record.kind,
    headRevisionId: record.headRevisionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  }, record.profile.id);
  for (const revision of record.revisions) {
    await transaction.objectStore('build-revisions').put(
      revision,
      `${revision.buildId}:${revision.id}`,
    );
  }
}
await transaction.done;
```

All records are parsed before opening the transaction. Any write exception
aborts the transaction. Overwrite preserves existing history; duplicate uses
the remapped plan IDs. Export reads current/history/progress in one consistent
read-only transaction.

- [ ] **Step 4: Implement durable cloud revision-chain import**

Repository enqueues every revision in parent order before sending the first
reducer call. Retry replays in the same deterministic order and stops after the
first failure, leaving the remainder durable. Imported records are local and
usable even while cloud synchronization is pending.

```ts
async function importBuildRecords(records: readonly PortableBuildRecord[]) {
  if (!accountSubject) throw new Error('Sign in is required for cloud import');
  for (const record of records) {
    for (const revision of record.revisions) {
      await pendingQueue.enqueue({
        subject: accountSubject,
        revisionId: revision.id,
        buildId: revision.buildId,
        parentRevisionId: revision.parentRevisionId,
        kind: revision.kind,
        profile: revision.profile,
        enqueuedAt: revision.createdAt,
        attempts: 0,
      });
    }
  }
  await retryPending();
}
```

- [ ] **Step 5: Implement focused backup and import dialogs**

Use a hidden labeled file input, local UTF-8 read, strict preview, and Blob
download. `Import as duplicates` is the primary action. `Overwrite matching
builds` first opens an alertdialog naming the count and recovery behavior. No
import action shares a build or sends file contents before confirmation.

```tsx
<label>
  <span>Choose build backup</span>
  <input
    type="file"
    accept="application/json,.json"
    onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      void file.text()
        .then(parseBuildBackup)
        .then((envelope) => setPreview(planBuildImport(envelope, existing, {
          mode: 'duplicate',
          randomUUID: () => crypto.randomUUID(),
        })))
        .catch((error: unknown) => setError(error instanceof Error ? error.message : 'Build import failed'));
    }}
  />
</label>
```

- [ ] **Step 6: Wire library/card actions and remove raw profile export**

Build cards use the versioned individual envelope. Builds toolbar adds `Import
builds` and `Back up library`. Cloud and local mirrors are exported once.
Personal preset cards never show Share. Status text distinguishes saved local,
cloud queued, cloud synced, and local-only backup scope.

```tsx
<div className="build-library-tools">
  <button type="button" onClick={() => setImportOpen(true)}>Import builds</button>
  <button type="button" onClick={() => setBackupOpen(true)}>Back up library</button>
</div>
```

- [ ] **Step 7: Run storage/repository/dialog/build tests and verify GREEN**

Run: `npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/storage/guestBuildStore.test.ts src/infrastructure/cloud/buildRepository.test.ts src/features/builds/BuildPortableDialogs.test.tsx src/features/builds/BuildsScreen.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit portable build operations**

```bash
git add optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts optimizer-v2/client/src/app/providers optimizer-v2/client/src/features/builds
git commit -m "feat: import and back up build libraries"
```

### Task 10: Responsive Styling, Accessibility, Reliability, and Release Acceptance

**Files:**
- Create: `optimizer-v2/client/src/styles/builds.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Create: `optimizer-v2/client/e2e/build-power-tools.spec.ts`
- Modify: `optimizer-v2/client/e2e/qol-accessibility.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e-pages/deep-links.spec.ts`
- Modify: `optimizer-v2/scripts/integration-phase-plan.mjs`
- Modify: `optimizer-v2/scripts/integration-phase-plan.test.mjs`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`

**Interfaces:**
- Core integration includes `client/e2e/build-power-tools.spec.ts` exactly once.
- New Pages deep links: `/builds/compare?left=proof-a&right=proof-b` and `/builds/presets`.
- Reliability evidence records `v5-to-v6-with-build-history-preservation`.

- [x] **Step 1: Write the failing end-to-end guest build-tools journey**

Create two valid saved builds, compare them on their pinned release, switch to
current preview, prove no source fingerprint changes, create a new draft from
one preview, save a personal preset, apply it to a new ID, export an individual
build and full library, import duplicates, confirm overwrite recovery, reload,
and restore a local revision.

```ts
test('compares, presets, backs up, imports, and restores guest builds', async ({ page }) => {
  await page.goto('/builds');
  await page.getByRole('button', { name: 'Compare First Route' }).click();
  await page.getByRole('button', { name: 'Compare Second Route' }).click();
  await expect(page).toHaveURL(/\/builds\/compare\?left=.+&right=.+/);
  await expect(page.getByRole('heading', { name: 'Compare Builds' })).toBeVisible();
  await page.getByRole('button', { name: /Preview both with dataset/ }).click();
  await page.getByRole('link', { name: 'Presets' }).click();
  await page.getByRole('button', { name: 'Use Balanced Melee Start' }).click();
  await expect(page).toHaveURL(/\/character$/);
});
```

- [x] **Step 2: Extend cloud-module coverage**

Save a personal preset, verify sender-only views, create 100 revisions with
kind retained, reject cross-identity mutation, reject direct preset sharing,
export/import a three-revision chain, interrupt after one reducer failure,
reconnect, and prove ordered convergence to the same head.

```ts
await userA.connection.reducers.saveBuildRevision({
  buildId: 'preset-build',
  revisionId: 'revision-1',
  name: 'Private Melee Preset',
  kind: 'personal-preset',
  profile: firstProfile,
  equipment: [{ slot: 'main-hand', itemId: 'fists' }],
  ownedItemIds: ['fists'],
});
await expect(
  userA.connection.reducers.createBuildShare({ buildId: 'preset-build', shareId: 'preset-share' }),
).rejects.toThrow(/copied to a build before sharing/i);
expect([...userB.connection.db.myBuilds.iter()]).toHaveLength(0);
```

- [x] **Step 3: Add failing accessibility and containment coverage**

Run Library, Compare, selectors, Presets, Backup, Import Preview, and Overwrite
Confirmation at 1440x1000, 768x1024, 390x844, and 320x700. Require zero
serious/critical axe violations, visible focus, correct dialog focus return,
reachable mobile actions, and document `scrollWidth <= innerWidth`.

```ts
for (const route of ['/builds', '/builds/compare', '/builds/presets']) {
  await page.goto(route);
  await expectAccessibleAndContained(page, route);
}
await page.getByRole('button', { name: 'Import builds' }).click();
await expectAccessibleAndContained(page, 'build import dialog');
```

- [x] **Step 4: Run focused e2e and verify RED**

Run:

```bash
cd optimizer-v2
npm run test:integration
npm run test:pages
```

Expected: FAIL until build-tool styling, route phases, migration fixtures, and
Pages deep links are complete.

- [x] **Step 5: Implement route-specific responsive styling**

Import `builds.css` from `global.css`. Desktop comparison uses aligned columns;
below 800 px it becomes labeled stacked groups. Only a contained comparison
table region may scroll horizontally. Dialog actions stay visible at 320x700,
touch targets remain at least the existing token minimum, and ornamental
surfaces reuse current tokens instead of new colors.

```css
.build-comparison-table {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

@media (max-width: 800px) {
  .build-comparison-columns {
    grid-template-columns: 1fr;
  }
}
```

- [x] **Step 6: Register the e2e phase and Pages routes**

Add `build-power-tools.spec.ts` once to the core phase and assert phase
non-overlap. Add the two deep-link cases to the built Pages artifact tests.

```ts
const deepLinks = [
  '/builds/compare?left=proof-a&right=proof-b',
  '/builds/presets',
];
```

- [x] **Step 7: Run the complete local verification gate**

Run:

```bash
cd optimizer-v2
npm run test:reliability
npm run test:pages
git diff --check
git status --short
```

Expected: all client/module/script/wiki/integration/stress/publication/share and
Pages layers pass; generated bindings are clean; only intentional source/docs
changes and the untouched root `.playwright-mcp/` directory remain.

- [x] **Step 8: Perform rendered browser QA before documenting acceptance**

Using the Browser workflow, verify page identity, nonblank content, no framework
overlay, zero relevant app warnings/errors, one complete interaction loop, and
screenshots for Library, Compare historical/current, Presets, Import Preview,
and mobile 390x844. Confirm exact source links and explicit missing-data labels.

- [x] **Step 9: Record acceptance and reliability evidence**

Update `ACCEPTANCE.md` with the eleven spec criteria and exact test evidence.
Update `RELIABILITY.md` with test counts, v5-to-v6 migration proof, import byte
and record limits, cloud ordering/recovery, accessibility viewports, query/
optimizer timings, Pages asset names/sizes, and remaining known boundaries.

- [x] **Step 10: Commit final Release 2 Build Power Tools evidence**

```bash
git add optimizer-v2
git commit -m "test: verify build power tools release"
```

- [x] **Step 11: Push, monitor both workflows, and smoke production**

```bash
git push origin main
gh run list --branch main --limit 6
```

Wait for Optimizer V2 CI and Deploy Optimizer V2 to complete successfully.
Then verify the live Library → Compare → Presets → export/import loop against
the deployed asset with zero relevant app console errors. Do not modify or
publish user builds during the smoke; use disposable local test records.

---

## Checkpoint Order

1. Tasks 1–3: review saved-record migration and SpacetimeDB compatibility.
2. Tasks 4–6: review library deduplication and two-build comparison.
3. Tasks 7–9: review presets and portable backup/import safety.
4. Task 10: review rendered QA, complete reliability evidence, and production deployment.

## Self-Review Record

- Spec coverage: dedicated routes, two-build historical/current comparison,
  per-metric evidence, curated/personal presets, duplicate-first import,
  recoverable overwrite, portable privacy, IndexedDB migration, SpacetimeDB
  history, accessibility, performance, and deployment are assigned to Tasks
  1–10.
- Shared migration decision: comparison, presets, and backups stay in one plan
  because presets and imports both require the same saved-record kind/history
  model; each subsystem still ends in its own reviewable commit/checkpoint.
- Type consistency: `SavedBuildKind`, `SavedBuildRecord`,
  `BuildRevisionSnapshot`, `BuildLibraryEntry`, `BuildComparisonEvaluation`,
  `PortableBuildEnvelope`, and `BuildImportPlan` keep identical names across
  producer and consumer tasks.
- Privacy check: only the strict portable schemas can serialize; identity,
  auth, share-owner, cloud row, and queue fields are absent and strict extra
  keys are rejected.
- Placeholder scan: no TBD/TODO markers, undefined follow-up tasks, or generic
  “add tests/error handling” steps remain.
