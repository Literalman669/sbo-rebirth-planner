# Dataset Update Impact Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global verified-data update notice and a deterministic `/updates` workspace that explains facts-first build impacts and applies dataset-pin-only revisions safely.

**Architecture:** A hybrid local-first engine fingerprints published snapshots, selects outdated player-owned builds without eager optimization, and generates fact/plan reports only for selected builds. IndexedDB and private SpacetimeDB rows store compact review receipts, while dedicated local and server apply operations guarantee that an update changes only `datasetVersion` and preserves revision recovery.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Zod 4, IndexedDB/idb, SpacetimeDB 2.8.3, Vitest 4, Playwright 1.62, axe-core, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-01-sbo-qol-release-2-dataset-impact-reports-design.md`

## Global Constraints

- Historical builds never silently substitute or adopt another dataset.
- Applying changes only `datasetVersion`; every other profile field remains identical.
- Reports use published verified records only and expose exact unknown/unavailable states.
- The notice acknowledges a report only after explicit Keep pinned or successful Apply.
- Candidate discovery never runs the optimizer for every saved build.
- Impact-key/report fingerprints are deterministic and exclude UI-only state.
- Guests retain the complete workflow; cloud synchronization remains optional and private.
- Receipts never enter public shares, portable build files, or optimizer inputs.
- IndexedDB v6 migrates additively to v7 without silent loss.
- SpacetimeDB CLI, module, SDK, bindings, and CI remain pinned to 2.8.3.
- The verified catalog, 250 builds, and all four viewports remain bounded.
- Use test-first RED/GREEN cycles and commit after every task.
- At execution start, create `codex/dataset-impact-reports` through `superpowers:using-git-worktrees`; preserve `.playwright-mcp/`.

---

### Task 1: Canonical Build and Release Fingerprints

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/canonical.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/fingerprint.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/fingerprint.test.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/releaseIndex.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/releaseIndex.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/planFingerprint.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/planFingerprint.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/PublicDataProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/DatasetProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/DatasetProvider.test.tsx`

**Interfaces:**
- Produces `fingerprintBuildInputs`, `fingerprintDatasetSnapshot`, `buildImpactKeyFingerprint`, `DatasetReleaseDescriptor`, and `DatasetContextValue.listReleases()`.
- Existing `fingerprintRecommendationInput(profile, dataset)` retains its exact output.

- [x] **Step 1: Write failing canonical fingerprint tests**

```ts
const first = fingerprintDatasetSnapshot(snapshot);
const reordered = fingerprintDatasetSnapshot({
  ...snapshot,
  catalog: [...snapshot.catalog].reverse(),
  formulas: [...snapshot.formulas].reverse(),
});
expect(reordered).toBe(first);
expect(fingerprintBuildInputs({ ...profile, name: 'UI-only rename' }))
  .toBe(fingerprintBuildInputs(profile));
expect(fingerprintBuildInputs({ ...profile, level: profile.level + 1 }))
  .not.toBe(fingerprintBuildInputs(profile));
```

Prove the build-input fingerprint excludes `datasetVersion` but includes every other recommendation input. Lock the existing plan-fingerprint output for a known fixture.

- [x] **Step 2: Run fingerprint tests and verify RED**

```bash
  cd optimizer-v2
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/fingerprint.test.ts src/domain/optimizer/planFingerprint.test.ts
```

Expected: FAIL because dataset-impact fingerprint functions do not exist.

- [x] **Step 3: Implement canonical values and hashes**

```ts
export const DATASET_IMPACT_CONTRACT_VERSION = 1 as const;
export function fingerprintBuildInputs(profile: CharacterProfile): string;
export function fingerprintDatasetSnapshot(snapshot: DatasetSnapshot): string;
export function buildImpactKeyFingerprint(input: {
  inputFingerprint: string;
  pinned: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
}): string;
```

Canonicalize keys and sort entity arrays by stable IDs. Preserve zero and `null` distinctly. Refactor the shared build-input projection without changing the legacy plan hash.

- [x] **Step 4: Write failing release-index/cache tests**

Cover publication ordering, bundled/cached/live deduplication, invalid snapshots, content fingerprints, and `DatasetCache.list()`.

```ts
expect(index.map((release) => release.version)).toEqual([
  '2026.08.30.1',
  '2026.09.01.1',
]);
```

- [x] **Step 5: Implement the bounded release index**

```ts
export interface DatasetReleaseDescriptor {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  formulaSetVersion: DatasetSnapshot['formulaSetVersion'];
  strategyPolicyVersion: DatasetSnapshot['strategyPolicyVersion'];
  contentFingerprint: string;
  availability: 'bundled' | 'cached' | 'live';
}
```

Extend `DatasetCache` with `list()` and dataset/public providers with `listReleases()`. Order by publication timestamps, never lexical versions.

- [x] **Step 6: Run focused tests and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact src/domain/optimizer/planFingerprint.test.ts src/infrastructure/storage/datasetCache.test.ts src/app/providers/DatasetProvider.test.tsx
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/domain/datasetImpact optimizer-v2/client/src/domain/optimizer/planFingerprint.ts optimizer-v2/client/src/domain/optimizer/planFingerprint.test.ts optimizer-v2/client/src/infrastructure/storage/datasetCache.ts optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts optimizer-v2/client/src/infrastructure/spacetime/PublicDataProvider.tsx optimizer-v2/client/src/app/providers/DatasetProvider.tsx optimizer-v2/client/src/app/providers/DatasetProvider.test.tsx
  git commit -m "feat: fingerprint dataset impact endpoints"
```

---

### Task 2: Versioned Review Receipts and IndexedDB v7

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/reviewReceipt.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/reviewReceipt.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/datasetReviewStore.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/datasetReviewStore.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/plannerDatabase.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`

**Interfaces:**
- Consumes Task 1 fingerprints.
- Produces `DatasetReviewReceipt`, `DatasetReviewImpactKey`, `datasetReviewReceiptSchema`, `receiptMatchesImpact`, and `DatasetReviewStore`.

- [x] **Step 1: Write failing strict receipt tests**

```ts
const receipt: DatasetReviewReceipt = {
  schemaVersion: 1,
  buildId: 'build-a',
  inputFingerprint: 'build-input-00000001',
  pinnedDatasetVersion: '2026.08.30.1',
  targetDatasetVersion: '2026.09.01.1',
  impactKeyFingerprint: 'impact-00000002',
  reportFingerprint: 'impact-report-00000003',
  status: 'reviewed',
  reviewedAt: '2026-09-01T12:00:00.000Z',
};
expect(datasetReviewReceiptSchema.parse(receipt)).toEqual(receipt);
expect(receiptMatchesImpact(receipt, matchingImpactKey)).toBe(true);
```

Reject unknown keys, controls, invalid timestamps/enums, overlong IDs, mismatched build IDs, and unsupported versions.

- [x] **Step 2: Run receipt tests and verify RED**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/reviewReceipt.test.ts
```

- [x] **Step 3: Implement receipt validation and matching**

Match build ID, input fingerprint, pinned/target versions, and impact key. Require the report fingerprint for audit/apply validation without using it for notice counting.

```ts
export interface DatasetReviewImpactKey {
  buildId: string;
  inputFingerprint: string;
  pinnedVersion: string;
  targetVersion: string;
  impactKeyFingerprint?: string;
}

export function receiptMatchesImpact(
  receipt: DatasetReviewReceipt,
  impact: DatasetReviewImpactKey,
): boolean {
  return receipt.buildId === impact.buildId &&
    receipt.inputFingerprint === impact.inputFingerprint &&
    receipt.pinnedDatasetVersion === impact.pinnedVersion &&
    receipt.targetDatasetVersion === impact.targetVersion &&
    receipt.impactKeyFingerprint === impact.impactKeyFingerprint;
}
```

- [x] **Step 4: Write failing v6-to-v7/store tests**

Test `dataset-review-receipts` creation while preserving every prior store. Cover list/load/save/delete, strict writes, corrupt-row quarantine, and one current receipt per build.

```ts
expect(GUEST_DATABASE_VERSION).toBe(7);
expect(upgraded.objectStoreNames).toContain('dataset-review-receipts');
await store.save(receipt);
await expect(store.load('build-a')).resolves.toEqual(receipt);
```

- [x] **Step 5: Add IndexedDB v7 and store**

```ts
export interface DatasetReviewStore {
  list(): Promise<DatasetReviewReceipt[]>;
  load(buildId: string): Promise<DatasetReviewReceipt | null>;
  save(receipt: DatasetReviewReceipt): Promise<void>;
  delete(buildId: string): Promise<void>;
}
```

Set `GUEST_DATABASE_VERSION = 7`, append the store, and leave old records unchanged.

- [x] **Step 6: Make build deletion remove its receipt atomically**

Extend the build/revision/progress delete transaction to include the receipt. Prove all four record groups disappear together.

- [x] **Step 7: Extend browser migration coverage**

Seed v6 with build/progress/inventory/revisions, open the app, and assert v7 plus preserved records and the new store.

- [x] **Step 8: Run persistence tests and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/reviewReceipt.test.ts src/infrastructure/storage/datasetReviewStore.test.ts src/infrastructure/storage/plannerDatabase.test.ts src/infrastructure/storage/guestBuildStore.test.ts
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/domain/datasetImpact optimizer-v2/client/src/infrastructure/storage optimizer-v2/client/e2e/reliability-flow.spec.ts
  git commit -m "feat: persist dataset review receipts locally"
```

---

### Task 3: Outdated-Build Candidate Selection

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/candidates.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/candidates.test.ts`
- Modify: `optimizer-v2/client/src/domain/build/library.ts`
- Modify: `optimizer-v2/client/src/domain/build/library.test.ts`

**Interfaces:**
- Consumes unified `BuildLibraryEntry`, Task 1 descriptors, and Task 2 receipts.
- Produces `DatasetImpactCandidate` and `selectDatasetImpactCandidates(input)`.

- [x] **Step 1: Write failing candidate tests**

Cover active unsaved draft, saved build, personal preset, archive, mirror dedupe, current exclusion, matching/invalid receipts, target/edit invalidation, unavailable pin, and stable ordering.

```ts
expect(candidates.find((item) => item.id === 'mirror')?.source)
  .toBe('local+cloud');
```

- [x] **Step 2: Run tests and verify RED**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/candidates.test.ts src/domain/build/library.test.ts
```

- [x] **Step 3: Implement selection without optimization**

```ts
export interface DatasetImpactCandidate {
  id: string;
  profile: CharacterProfile;
  source: 'active' | BuildLibrarySource;
  kind: 'active-draft' | SavedBuildKind;
  headRevisionId?: string;
  archivedAt?: string;
  pinned?: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
  inputFingerprint: string;
  impactKeyFingerprint?: string;
  status: 'unreviewed' | 'reviewed-pinned' | 'blocked';
}
```

Never call `optimizeBuild`. A missing pinned descriptor remains Blocked and counted as unreviewed.

- [x] **Step 4: Run and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/candidates.test.ts src/domain/build/library.test.ts
  git add optimizer-v2/client/src/domain/datasetImpact/candidates.ts optimizer-v2/client/src/domain/datasetImpact/candidates.test.ts optimizer-v2/client/src/domain/build/library.ts optimizer-v2/client/src/domain/build/library.test.ts
  git commit -m "feat: select outdated player builds"
```

---

### Task 4: Verified Dataset Fact Diff

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/factProjection.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/factProjection.test.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/factDiff.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/factDiff.test.ts`

**Interfaces:**
- Consumes two validated `DatasetSnapshot` values.
- Produces canonical `DatasetFactChange[]` across equipment, acquisitions, formulas, mechanics, gaps, policy, and sources.

- [x] **Step 1: Write failing normalized projection tests**

Prove catalog-v2 rows are not double-counted through `equipment`, legacy rows map into the same shape, arrays sort deterministically, acquisition IDs retain cost/currency/source, and zero differs from null/missing.

```ts
expect(projectDatasetFacts(v2Snapshot).filter((row) => row.entityId === 'combat-armor'))
  .toHaveLength(1);
expect(diffDatasetFacts(zeroSnapshot, missingSnapshot))
  .toContainEqual(expect.objectContaining({ before: 0, after: null }));
```

- [x] **Step 2: Define fact-change contracts**

```ts
export type DatasetFactEntity =
  | 'equipment' | 'acquisition' | 'resistance' | 'special-effect'
  | 'formula' | 'mechanic' | 'known-gap' | 'release-policy';

export interface DatasetFactChange {
  id: string;
  entity: DatasetFactEntity;
  entityId: string;
  field: string;
  change: 'added' | 'removed' | 'changed';
  before: string | number | boolean | null | readonly string[];
  after: string | number | boolean | null | readonly string[];
  beforeSourceUrl?: string;
  afterSourceUrl?: string;
}
```

- [x] **Step 3: Run projection/diff tests and verify RED**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/factProjection.test.ts src/domain/datasetImpact/factDiff.test.ts
```

- [x] **Step 4: Implement complete field-path diffing**

Compare raw stats, aliases, variants, slots, paths, requirements, acquisitions, access/availability, cost/currency, resistances, effects, verification, provenance, formulas, mechanics/parameters, known gaps, formula/policy versions, points per level, and dual-wield gate. Sort by entity/entityId/field.

```ts
export function diffDatasetFacts(
  pinned: DatasetSnapshot,
  target: DatasetSnapshot,
): DatasetFactChange[] {
  return diffCanonicalFactRows(
    projectDatasetFacts(pinned),
    projectDatasetFacts(target),
  ).sort(compareDatasetFactChanges);
}
```

- [x] **Step 5: Add matrix/no-mutation tests and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/factProjection.test.ts src/domain/datasetImpact/factDiff.test.ts
  git add optimizer-v2/client/src/domain/datasetImpact/factProjection.ts optimizer-v2/client/src/domain/datasetImpact/factProjection.test.ts optimizer-v2/client/src/domain/datasetImpact/factDiff.ts optimizer-v2/client/src/domain/datasetImpact/factDiff.test.ts
  git commit -m "feat: diff verified dataset facts"
```

---

### Task 5: Recommendation Impact and Release Trail

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/planDiff.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/planDiff.test.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/relevance.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/relevance.test.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/report.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/report.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`

**Interfaces:**
- Consumes Tasks 1, 3, and 4 plus `optimizeBuild`.
- Produces `RecommendationPlanImpact`, `DatasetImpactReport`, and `buildDatasetImpactReport`.

- [x] **Step 1: Write failing plan-diff tests**

Test immediate action, spend-now, future rows, upgrade order, price/unknown totals, warnings/requirements/eligibility, unchanged plans, and readiness blockers.

```ts
expect(diffRecommendationPlans(before, after)).toMatchObject({
  status: 'changed',
  changedLevelRows: [10, 12],
});
```

- [x] **Step 2: Implement typed plan projection/diff**

Project only user-visible deterministic fields. Represent optimizer failures as `{ status: 'blocked', explanation }` without discarding usable fact changes.

```ts
export interface ShoppingImpact {
  beforeKnownTotal: number;
  afterKnownTotal: number;
  beforeUnknownCount: number;
  afterUnknownCount: number;
  currency?: string;
}

export interface PlanFieldChange {
  id: string;
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export type PlanEndpointResult =
  | { status: 'ready'; plan: RecommendationPlan }
  | { status: 'blocked'; explanation: string };

export type RecommendationPlanImpact =
  | { status: 'unchanged'; shopping: ShoppingImpact }
  | { status: 'changed'; changes: PlanFieldChange[]; changedLevelRows: number[]; shopping: ShoppingImpact }
  | { status: 'blocked'; pinnedReason?: string; targetReason?: string };

export function diffRecommendationPlans(
  pinned: PlanEndpointResult,
  target: PlanEndpointResult,
): RecommendationPlanImpact;
```

- [x] **Step 3: Write failing relevance/report tests**

Cover equipped, owned, before/after recommended, eligible-at-either-endpoint, consumed formula/mechanic/policy facts, omitted counts, exact sources, direct summary, intermediate ordering/gaps, stable report fingerprints, and exactly two endpoint optimizer calls.

```ts
const optimize = vi.fn(optimizeBuild);
const report = buildDatasetImpactReport({ ...input, optimize });
expect(optimize).toHaveBeenCalledTimes(2);
expect(report.facts.map((fact) => fact.entityId)).toContain('combat-armor');
expect(report.omittedFactChangeCount).toBeGreaterThan(0);
```

- [x] **Step 4: Implement report generation**

```ts
export interface DatasetReleaseImpactStep {
  fromVersion: string;
  toVersion: string;
  status: 'available' | 'gap';
  factChanges: DatasetFactChange[];
  plan: RecommendationPlanImpact | null;
}

export interface DatasetImpactReport {
  contractVersion: 1;
  buildId: string;
  inputFingerprint: string;
  impactKeyFingerprint: string;
  reportFingerprint: string;
  pinned: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
  facts: DatasetFactChange[];
  omittedFactChangeCount: number;
  plan: RecommendationPlanImpact;
  trail: DatasetReleaseImpactStep[];
  unknowns: string[];
}

export function buildDatasetImpactReport(input: {
  profile: CharacterProfile;
  pinned: DatasetSnapshot;
  target: DatasetSnapshot;
  intermediate: readonly (DatasetSnapshot | null)[];
  descriptors: readonly DatasetReleaseDescriptor[];
}): DatasetImpactReport;
```

Clone the profile with only endpoint `datasetVersion` changed for optimizer calls. Filter relevance after both plans exist, then fingerprint the canonical report.

- [x] **Step 5: Prove filters/receipts do not invoke optimizer**

Use spies around report memoization. Sorting, disclosure, selected fact group, and receipt status reuse the report.

- [x] **Step 6: Run domain checkpoint and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact src/domain/optimizer/optimizeBuild.test.ts
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/domain/datasetImpact optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts
  git commit -m "feat: explain dataset recommendation impacts"
```

---

### Task 6: Private SpacetimeDB Receipts and Dataset-Pin Reducer

**Files:**
- Create: `optimizer-v2/spacetimedb/src/datasetReview.ts`
- Create: `optimizer-v2/spacetimedb/src/datasetReview.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/catalogSchema.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.ts`
- Modify: `optimizer-v2/spacetimedb/src/validation.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerViews.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/plannerState.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Modify: `optimizer-v2/scripts/schema-migration.test.mjs`
- Modify: `optimizer-v2/client/e2e/cloud-module.spec.ts`

**Interfaces:**
- Produces private `build_dataset_review`, sender-filtered `my_dataset_reviews`, `upsertDatasetReview`, `deleteDatasetReview`, and `applyDatasetVersionUpdate`.
- Apply accepts only `{ buildId, expectedHeadRevisionId, revisionId, targetDatasetVersion }`.

- [x] **Step 1: Write failing schema/validation tests**

Append the private table after deployed tables. Validate exact v1 keys, byte limit, timestamps, hashes, target/build IDs, and ownership. Prove public shares expose no receipt.

```ts
expect(validateDatasetReviewJson(JSON.stringify(receipt), 'build-a')).toEqual([]);
expect(validateDatasetReviewJson(JSON.stringify({ ...receipt, buildId: 'other' }), 'build-a'))
  .toEqual(['Stored dataset review is invalid']);
expect(schemaSource).not.toMatch(/shared_build.*receipt/is);
```

- [x] **Step 2: Write failing deterministic merge tests**

```ts
expect(mergeDatasetReview(older, newer)).toEqual(newer);
expect(mergeDatasetReview(newer, older)).toEqual(newer);
expect(mergeDatasetReview(sameTimeA, sameTimeB)).toEqual(canonicalTieWinner);
```

Use `reviewedAt`, then canonical JSON for ties. Reject mismatched IDs and invalid payloads.

- [x] **Step 3: Write failing protected apply tests**

Prove foreign identity rejection, missing/stale head rejection, non-current target rejection, duplicate revision conflict, and exact copying of every head field/child row except `datasetVersion`. Build kind/name/archive remain unchanged.

```ts
await expect(userB.reducers.applyDatasetVersionUpdate(args))
  .rejects.toThrow(/Build not found for this identity/);
await expect(userA.reducers.applyDatasetVersionUpdate({
  ...args,
  expectedHeadRevisionId: 'stale-head',
})).rejects.toThrow(/Build changed/);
```

- [x] **Step 4: Implement private schema/view/receipt reducers**

Store `buildId`, owner, `receiptJson`, and server `updatedAt`. Upsert parses current/incoming and stores deterministic merge. Delete is owner-idempotent. Build deletion cascades.

```ts
export const buildDatasetReview = table(
  {
    name: 'build_dataset_review',
    indexes: [{
      accessor: 'buildDatasetReviewOwner',
      name: 'build_dataset_review_owner',
      algorithm: 'btree',
      columns: ['owner'],
    }],
  },
  {
    buildId: t.string().primaryKey(),
    owner: t.identity(),
    receiptJson: t.string(),
    updatedAt: t.timestamp(),
  },
);
```

- [x] **Step 5: Implement `applyDatasetVersionUpdate`**

Inside one reducer transaction: assert owner/current head/current target release; read the head and child rows; insert a copied child revision with only identifiers/timestamp/dataset changed; copy equipment/owned rows; advance head. Never accept profile/stat/equipment values from the client.

```ts
export const applyDatasetVersionUpdate = spacetimedb.reducer(
  {
    buildId: t.string(),
    expectedHeadRevisionId: t.string(),
    revisionId: t.string(),
    targetDatasetVersion: t.string(),
  },
  (ctx, args) => applyAuthoritativeDatasetPin(ctx, args),
);
```

- [x] **Step 6: Extend real module integration**

Use two same-account connections. Apply once, assert both receive head/receipt, reject stale expected head and foreign access, and verify all copied values.

- [x] **Step 7: Run server checkpoint and generate bindings**

```bash
  npm run test:unit --workspace @sbo/optimizer-module
  npm run typecheck --workspace @sbo/optimizer-module
  cd spacetimedb
  spacetime build
  cd ..
  spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
```

- [x] **Step 8: Commit protected server operations**

```bash
  git add optimizer-v2/spacetimedb/src optimizer-v2/scripts/schema-migration.test.mjs optimizer-v2/client/e2e/cloud-module.spec.ts optimizer-v2/client/src/module_bindings
  git commit -m "feat: protect cloud dataset reviews and updates"
```

---

### Task 7: Cloud Receipt Mapping, Queueing, and Replay

**Files:**
- Modify: `optimizer-v2/client/src/app/providers/CloudDataContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudDataProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudDataProvider.test.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/CloudBuildsProvider.test.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/pendingPlannerStateQueue.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/useCloudBuilds.ts`
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`

**Interfaces:**
- Consumes Task 2 store and Task 6 bindings.
- Adds `cloudDatasetReviews`, `saveDatasetReview`, `deleteDatasetReview`, and `applyDatasetVersionUpdate` to cloud state/repository.

- [x] **Step 1: Write failing mapper/provider tests**

Parse valid private rows, ignore malformed rows without replacing prior valid state, isolate accounts, and hydrate receipts without changing builds/progress.

```ts
expect(selector.select([validRow])).toEqual([receipt]);
expect(selector.select([malformedRow])).toEqual([receipt]);
expect(otherIdentityState.datasetReviews).toEqual([]);
```

- [x] **Step 2: Extend pending mutation schema with tests**

```ts
interface PendingMutationBase {
  subject: string;
  mutationId: string;
  enqueuedAt: string;
  attempts: number;
}

type PendingDatasetMutation = PendingMutationBase & (
  | { kind: 'dataset-review'; receipt: DatasetReviewReceipt }
  | { kind: 'dataset-review-delete'; buildId: string }
  | {
      kind: 'dataset-version-update';
      buildId: string;
      expectedHeadRevisionId: string;
      revisionId: string;
      targetDatasetVersion: string;
    }
);
```

Use `dataset-review:<buildId>` and `dataset-update:<buildId>`. Prove review/delete coalescing and stable apply intent.

- [x] **Step 3: Implement repository sends and ordered replay**

```ts
saveDatasetReview(receipt): Promise<'cloud' | 'cloud-pending'>;
deleteDatasetReview(buildId): Promise<'cloud' | 'cloud-pending'>;
applyDatasetVersionUpdate(input): Promise<{
  revisionId: string;
  location: 'cloud' | 'cloud-pending';
}>;
```

Reconnect replays ordinary pending build revisions before dataset updates, then receipts, so a new enrolled draft establishes its pinned head first.

- [x] **Step 4: Test offline/stale/conflict behavior**

Prove local receipt first, retained failed mutations, incremented attempts, idempotent reconnect, stale-head conflict retention, and explicit recalculation replacement.

```ts
await expect(repository.applyDatasetVersionUpdate(input))
  .resolves.toMatchObject({ location: 'cloud-pending' });
expect(await pendingQueue.list(subject)).toContainEqual(
  expect.objectContaining({ kind: 'dataset-version-update', attempts: 1 }),
);
```

- [x] **Step 5: Run client cloud checkpoint and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/infrastructure/cloud src/app/providers/CloudDataProvider.test.tsx src/app/providers/CloudBuildsProvider.test.tsx
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/app/providers optimizer-v2/client/src/infrastructure/cloud optimizer-v2/client/e2e/reliability-module.spec.ts
  git commit -m "feat: sync dataset review state privately"
```

---

### Task 8: Atomic Local Apply and Revision Orchestration

**Files:**
- Create: `optimizer-v2/client/src/domain/datasetImpact/apply.ts`
- Create: `optimizer-v2/client/src/domain/datasetImpact/apply.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftContext.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`

**Interfaces:**
- Produces `assertDatasetPinOnlyUpdate`, `GuestBuildStore.applyDatasetUpdate`, and provider `refreshSavedBuilds`.
- Repository orchestrates guest/local, mirrored, and cloud-only candidates.

- [x] **Step 1: Write failing dataset-pin invariant tests**

```ts
const updated = createDatasetPinnedProfile(profile, '2026.09.01.1');
expect(updated).toEqual({ ...profile, datasetVersion: '2026.09.01.1' });
expect(() => assertDatasetPinOnlyUpdate(profile, { ...updated, level: 99 }))
  .toThrow(/only datasetVersion may change/);
```

- [x] **Step 2: Write failing local transaction tests**

Cover existing normal build/preset (one child revision), unsaved active/cloud-only (pinned recovery then update), head/input mismatch (zero writes), injected rollback, and active draft update only after commit.

```ts
await store.applyDatasetUpdate(request);
expect((await store.listBuildHistory(profile.id)).map((row) => row.profile.datasetVersion))
  .toEqual(['2026.08.30.1', '2026.09.01.1']);
expect((await store.loadDraft())?.datasetVersion).toBe('2026.09.01.1');
```

- [x] **Step 3: Implement local apply request**

```ts
export interface ApplyDatasetUpdateRequest {
  profile: CharacterProfile;
  kind: SavedBuildKind;
  active: boolean;
  expectedInputFingerprint: string;
  expectedHeadRevisionId?: string;
  targetDatasetVersion: string;
  recoveryRevisionId: string;
  updateRevisionId: string;
  receipt: DatasetReviewReceipt;
}
```

One transaction spans draft, builds, revisions, and receipts. Validate current state before inserting.

- [x] **Step 4: Add provider refresh/application hooks**

`refreshSavedBuilds()` reloads the library without replacing the draft. Replace the active draft only after successful application.

```ts
type BuildDraftContextValue = {
  // existing members
  refreshSavedBuilds(): Promise<void>;
};
```

- [x] **Step 5: Orchestrate cloud/local outcomes**

Guest/local returns after atomic local apply. Cloud/mirrored revalidates subscribed head, calls the protected reducer, then writes/queues Applied receipt. Establish a pinned head before cloud apply when absent.

- [x] **Step 6: Run apply checkpoint and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/datasetImpact/apply.test.ts src/infrastructure/storage/guestBuildStore.test.ts src/infrastructure/cloud/buildRepository.test.ts src/app/providers/BuildDraftProvider.test.tsx
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/domain/datasetImpact/apply.ts optimizer-v2/client/src/domain/datasetImpact/apply.test.ts optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts optimizer-v2/client/src/app/providers/BuildDraftContext.ts optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx
  git commit -m "feat: apply recoverable dataset pin revisions"
```

---

### Task 9: Dataset Updates Provider and Global Notice

**Files:**
- Create: `optimizer-v2/client/src/app/providers/DatasetUpdatesContext.ts`
- Create: `optimizer-v2/client/src/app/providers/DatasetUpdatesProvider.tsx`
- Create: `optimizer-v2/client/src/app/providers/DatasetUpdatesProvider.test.tsx`
- Create: `optimizer-v2/client/src/features/updates/DatasetUpdateNotice.tsx`
- Create: `optimizer-v2/client/src/features/updates/DatasetUpdateNotice.test.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`
- Modify: `optimizer-v2/client/src/app/App.tsx`
- Modify: `optimizer-v2/client/src/features/shell/shell.test.tsx`

**Interfaces:**
- Consumes Tasks 1–3 and 7–8.
- Produces `useDatasetUpdates()` with candidates, report loading, receipt actions, apply, status, and unreviewed count.

- [x] **Step 1: Write failing provider tests**

Cover hydration order, active/saved/preset/archive inclusion, mirror dedupe, local/cloud receipt merge, zero eager optimizer calls, offline cached releases, blocked endpoints, and no draft replacement.

```tsx
renderHook(() => useDatasetUpdates(), { wrapper });
expect(optimizeSpy).not.toHaveBeenCalled();
expect(result.current.unreviewedCount).toBe(3);
expect(replaceDraft).not.toHaveBeenCalled();
```

- [x] **Step 2: Define provider contract**

```ts
export type DatasetImpactReportResult =
  | { status: 'ready'; report: DatasetImpactReport }
  | { status: 'blocked'; reason: string };

export interface DatasetUpdatesState {
  candidates: readonly DatasetImpactCandidate[];
  unreviewedCount: number;
  isHydrated: boolean;
  storageError: string | null;
  loadReport(candidateId: string): Promise<DatasetImpactReportResult>;
  keepPinned(report: DatasetImpactReport): Promise<void>;
  applyUpdate(report: DatasetImpactReport): Promise<void>;
  refresh(): Promise<void>;
}
```

- [x] **Step 3: Implement provider orchestration/memoization**

Place the provider inside `CloudBuildsProvider` and outside `RouterProvider`. Cache report promises by impact key. Receipt/filter/selection changes must not recompute reports.

```tsx
<CloudBuildsProvider>
  <DatasetUpdatesProvider>
    <RouterProvider router={appRouter} />
  </DatasetUpdatesProvider>
</CloudBuildsProvider>
```

- [x] **Step 4: Write failing shell-notice tests**

Assert zero-state absence, pluralized count, `/updates` link, nonmodal status semantics, disappearance after Keep pinned, and reappearance after build edit/new release.

```tsx
expect(screen.getByRole('status')).toHaveTextContent(
  'Verified data update affects 3 builds',
);
expect(screen.getByRole('link', { name: 'Review changes' }))
  .toHaveAttribute('href', '/updates');
```

- [x] **Step 5: Render the notice**

Place it below dataset status and above global navigation/content without blocking the current route. Do not add another primary navigation item.

```tsx
{updates.unreviewedCount > 0 ? (
  <DatasetUpdateNotice count={updates.unreviewedCount} />
) : null}
```

- [x] **Step 6: Run and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/app/providers/DatasetUpdatesProvider.test.tsx src/features/updates/DatasetUpdateNotice.test.tsx src/features/shell/shell.test.tsx
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/app optimizer-v2/client/src/features/updates/DatasetUpdateNotice.tsx optimizer-v2/client/src/features/updates/DatasetUpdateNotice.test.tsx optimizer-v2/client/src/main.tsx optimizer-v2/client/src/features/shell/shell.test.tsx
  git commit -m "feat: announce verified dataset impacts"
```

---

### Task 10: Routed Updates Workspace and Facts-First UI

**Files:**
- Create: `optimizer-v2/client/src/features/updates/DatasetUpdatesScreen.tsx`
- Create: `optimizer-v2/client/src/features/updates/DatasetUpdatesScreen.test.tsx`
- Create: `optimizer-v2/client/src/features/updates/DatasetUpdateBuildList.tsx`
- Create: `optimizer-v2/client/src/features/updates/DatasetImpactSummary.tsx`
- Create: `optimizer-v2/client/src/features/updates/FactsChangedSection.tsx`
- Create: `optimizer-v2/client/src/features/updates/PlanImpactSection.tsx`
- Create: `optimizer-v2/client/src/features/updates/ReleaseTrailSection.tsx`
- Create: `optimizer-v2/client/src/features/updates/ApplyDatasetUpdateDialog.tsx`
- Create: `optimizer-v2/client/src/features/updates/updateComponents.test.tsx`
- Create: `optimizer-v2/client/src/styles/updates.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/app/App.test.tsx`

**Interfaces:**
- Consumes Task 9 typed provider values only.
- Produces lazy `/updates?build=<id>&source=<local|cloud>` plus preview/review/apply interactions.

- [x] **Step 1: Write failing router/screen tests**

Cover direct route, source query, first-unreviewed fallback, stale selection explanation, active/saved/mirror/preset/archive labels, empty/blocked/loading states, and no draft mutation.

```tsx
await renderUpdates('/updates?build=saved-a&source=local');
expect(await screen.findByRole('heading', { name: 'Dataset Updates' })).toBeVisible();
expect(screen.getByLabelText('Review build')).toHaveValue('local:saved-a');
expect(replaceDraft).not.toHaveBeenCalled();
```

- [x] **Step 2: Write failing component tests**

Require facts before plan in DOM order; before/after/source values; omitted count; Plan unchanged; level/upgrades/shopping/warnings diffs; blocked plan; collapsed trail gaps; Keep pinned; previews; stale Apply; confirmation copy; focus trap/Escape/return; status messages.

```tsx
const facts = screen.getByRole('heading', { name: 'Verified facts changed' });
const plan = screen.getByRole('heading', { name: 'Effect on your plan' });
expect(facts.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING)
  .toBeTruthy();
```

- [x] **Step 3: Implement lazy route and selection**

```tsx
const DatasetUpdatesScreen = lazy(() =>
  import('../features/updates/DatasetUpdatesScreen').then((module) => ({
    default: module.DatasetUpdatesScreen,
  })),
);
```

Use existing route focus/scroll. Selection changes query/provider state only.

- [x] **Step 4: Implement facts-first sections**

Render regions in this order: Impact summary, Verified facts changed, Effect on your plan, Release trail, Actions. Unknowns use explicit copy and exact stored URLs.

```tsx
<DatasetImpactSummary report={report} />
<FactsChangedSection changes={report.facts} omitted={report.omittedFactChangeCount} />
<PlanImpactSection impact={report.plan} />
<ReleaseTrailSection steps={report.trail} />
```

- [x] **Step 5: Implement previews/apply confirmation**

Dialog names build/from/to and says only dataset pin changes. Current preview is temporary. Apply revalidates report/provider state before Task 8.

```tsx
<ApplyDatasetUpdateDialog
  report={report}
  onConfirm={() => updates.applyUpdate(report)}
  onCancel={closeAndRestoreFocus}
/>
```

- [x] **Step 6: Implement responsive styles**

Desktop list/detail; one-column mobile; labeled before/after card reflow; existing fantasy tokens, touch targets, focus, and reduced motion.

```css
.dataset-updates-layout { display: grid; grid-template-columns: minmax(16rem, 0.7fr) minmax(0, 1.6fr); }
@media (max-width: 48rem) { .dataset-updates-layout { grid-template-columns: 1fr; } }
```

- [x] **Step 7: Run rendered tests and commit**

```bash
  npm run test:unit --workspace @sbo/optimizer-client -- --run src/features/updates src/app/App.test.tsx src/features/shell/shell.test.tsx
  npm run typecheck --workspace @sbo/optimizer-client
  git add optimizer-v2/client/src/features/updates optimizer-v2/client/src/styles optimizer-v2/client/src/app/router.tsx optimizer-v2/client/src/app/App.test.tsx
  git commit -m "feat: review dataset impacts facts first"
```

---

### Task 11: Privacy, Migration, E2E, Accessibility, and Stress

**Files:**
- Create: `optimizer-v2/client/e2e/dataset-updates-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/qol-accessibility.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/cloud-module.spec.ts`
- Modify: `optimizer-v2/client/e2e-pages/deep-links.spec.ts`
- Modify: `optimizer-v2/client/src/domain/build/portable.test.ts`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`
- Modify: `optimizer-v2/scripts/integration-phase-plan.mjs`
- Modify: `optimizer-v2/scripts/integration-phase-plan.test.mjs`
- Modify: `optimizer-v2/scripts/run-reliability.mjs`
- Modify: `optimizer-v2/scripts/run-reliability.test.mjs`

**Interfaces:**
- Registers `e2e/dataset-updates-flow.spec.ts` exactly once in core.
- Adds Pages `/updates?build=proof-build&source=local`.

- [x] **Step 1: Write complete guest journey**

Seed pinned/current/intermediate snapshots and unsaved active draft. Verify notice count, facts-before-plan, trail, Keep pinned, edit invalidation, nonmutating preview, confirmation, two revisions, reload, and exact non-dataset equality.

```ts
await page.goto('/updates');
await expect(page.getByRole('heading', { name: 'Verified facts changed' })).toBeVisible();
await page.getByRole('button', { name: 'Update this build' }).click();
await page.getByRole('button', { name: 'Confirm dataset update' }).click();
await expect.poll(() => readRevisionVersions(page)).toEqual([
  '2026.08.30.1',
  '2026.09.01.1',
]);
```

- [x] **Step 2: Add saved/preset/mirror/cloud journeys**

Apply local build/preset, retain kind/history, dedupe mirror, queue offline review/update, reconnect, converge on second same-account connection, and reject foreign access.

```ts
await expect(userB.connection.reducers.upsertDatasetReview(foreignArgs))
  .rejects.toThrow(/Build not found for this identity/);
await expect.poll(() => reviewsFor(userASecond)).toContainEqual(
  expect.objectContaining({ buildId: 'build-a' }),
);
```

- [x] **Step 3: Add privacy regressions**

Export build/library and create public share after review. Assert no receipt, impact fingerprint, pending mutation, or owner identity enters either payload.

```ts
expect(JSON.stringify(portableRecord)).not.toMatch(
  /datasetReview|impactKeyFingerprint|reportFingerprint|ownerIdentity/,
);
```

- [x] **Step 4: Extend accessibility at four viewports**

Audit notice, list/detail, facts, Plan unchanged, blocked endpoint, trail, previews, and Apply dialog at 1440x1000, 768x1024, 390x844, and 320x700. Require zero serious/critical axe, focus return, reachable controls, and no overflow.

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth))
  .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
expect(seriousOrCriticalViolations).toEqual([]);
```

- [x] **Step 5: Add stress and migration coverage**

Seed 250 builds across four pinned versions plus the complete catalog. Candidate counting performs zero optimizer calls; selected report performs exactly two; cached revisit performs zero additional calls; v6-to-v7 preserves all prior stores.

```ts
expect(candidateOptimizeCalls).toBe(0);
await openReport('stress-build-249');
expect(reportOptimizeCalls).toBe(2);
await openReport('stress-build-249');
expect(reportOptimizeCalls).toBe(2);
```

- [x] **Step 6: Register integration/Pages/reliability contracts**

Update exact phase arrays, add direct route, and record receipt schema, 250 candidates, four versions, two endpoint calls, four viewports, and Updates chunk size with tests.

- [x] **Step 7: Run integration and Pages**

```bash
  npm run test:integration
  npm run test:pages
```

Expected: core, convergence, publication, sharing, and Pages all pass.

- [x] **Step 8: Commit release evidence**

```bash
  git add optimizer-v2/client/e2e optimizer-v2/client/e2e-pages optimizer-v2/client/src/domain/build/portable.test.ts optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx optimizer-v2/scripts
  git commit -m "test: verify dataset impact workflows"
```

---

### Task 12: Acceptance, Full Reliability, Deployment, and Live Smoke

**Files:**
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`
- Modify: `docs/superpowers/plans/2026-09-01-sbo-qol-release-2-dataset-impact-reports.md`

**Interfaces:**
- Produces the final auditable release record and deployment.

- [x] **Step 1: Run browser visual QA before documentation**

Use Browser against local `/updates` at desktop and 390x844. Check identity, nonblank content, overlay/console health, hierarchy, facts-before-plan, trail, blocked/empty states, confirmation focus, sources, and containment. Add a focused regression before each evidence-backed correction.

- [x] **Step 2: Run the complete local reliability gate**

```bash
  cd optimizer-v2
  npm run test:reliability
  npm run test:pages
  git diff --check
  spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
  git diff --exit-code -- client/src/module_bindings
```

- [x] **Step 3: Update acceptance/reliability ledgers**

Record exact counts, migration, candidate/report stress, optimizer-call bound, cloud evidence, viewports, Pages, chunks, and remaining non-goals. Do not claim deployment yet.

- [x] **Step 4: Commit the release record**

```bash
  git add optimizer-v2/ACCEPTANCE.md optimizer-v2/RELIABILITY.md docs/superpowers/plans/2026-09-01-sbo-qol-release-2-dataset-impact-reports.md
  git commit -m "docs: record dataset impact acceptance"
```

- [ ] **Step 5: Finish the branch using the approved choice**

Invoke `superpowers:finishing-a-development-branch`. For local merge, merge to `main`, rerun `npm run test:reliability`, and clean only `.worktrees/dataset-impact-reports` after the merged gate passes.

- [ ] **Step 6: Push and monitor both workflows**

```bash
  git push origin main
  gh run list --branch main --limit 6
```

Wait for Optimizer V2 CI and Deploy Optimizer V2. On failure, inspect logs, reproduce, fix only evidenced behavior, rerun, and push.

- [ ] **Step 7: Smoke deployed production without private mutation**

Open live `/updates`. Verify release badge, empty/disposable-local report, sources, facts-before-plan, 390x844 containment, and zero app-origin warnings/errors. Delete disposable records only after explicit browser action-time confirmation.

- [ ] **Step 8: Record workflow/live evidence only if needed**

If ledgers require run URLs/findings, commit documentation-only `[skip ci]`; do not redeploy identical code for prose.

---

## Checkpoint Order

1. **Tasks 1–3:** Fingerprints/release metadata, receipt migration, and zero-optimizer candidates.
2. **Tasks 4–5:** Verified fact diff, relevance, plan diff, report/trail determinism.
3. **Tasks 6–8:** Protected server apply, private sync, offline replay, revision recovery.
4. **Tasks 9–10:** Global notice, provider orchestration, routed facts-first UX.
5. **Tasks 11–12:** Privacy, migration, stress, accessibility, reliability, deployment, smoke.

## Plan Self-Review Record

- **Spec coverage:** Notice rules, exact endpoints, impact key, facts-first report, plan diff, trail, receipts, privacy, offline recovery, pin-only revisions, active recovery, accessibility, performance, Pages, CI, deployment, and smoke map to explicit tasks.
- **Scope:** One Release 2 subsystem; no boss data, mass update, public report sharing, or unrelated refactor.
- **Type consistency:** `DatasetReleaseDescriptor`, `DatasetReviewReceipt`, `DatasetImpactCandidate`, `DatasetFactChange`, `RecommendationPlanImpact`, `DatasetImpactReport`, `buildDatasetImpactReport`, and `applyDatasetVersionUpdate` are defined before use.
- **Performance consistency:** Notices use `impactKeyFingerprint`; selected reports alone compute `reportFingerprint` and run two endpoint optimizer calls.
- **Mutation consistency:** Previews are nonmutating; local apply is transactional; cloud apply copies the authoritative head; receipts follow revision success.
- **Placeholder scan:** No unfinished markers, generic test steps, undefined interfaces, or deferred implementation steps remain.
