# Verified Wiki Catalog and Detailed Optimizer Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current partial catalog and ambiguous milestone output with a revision-pinned, curator-reviewed wiki equipment/mechanics catalog, complete armor-system support, verified-only recommendations, actionable current-point spending, and an exact ten-level allocation sheet.

**Architecture:** Preserve historical release `2026.08.29.1` and its existing tables while adding a version-2 catalog beside it. MediaWiki API snapshots flow through pure parsers into private SpacetimeDB draft tables, field-level review, atomic public release tables, a backward-compatible client mapper, a typed mechanics compiler, and a deterministic optimizer whose strategy policy is explicitly separate from wiki facts. Results allocate existing unspent points first, then expose ten actual-level rows with exactly three new points and reconciled running totals.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Playwright 1.62, Zod 4, SpacetimeDB 2.8.3, Node.js 22, MediaWiki API, GitHub Pages/Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-wiki-catalog-optimizer-results-design.md`

## Global Constraints

- Execute inline in the current task; do not dispatch subagents.
- Use the canonical wiki `https://swordbloxonlinerebirth.fandom.com` through its MediaWiki API; do not infer game mechanics from gameplay.
- Preserve historical release `2026.08.29.1` and historical build reproducibility.
- Keep SpacetimeDB CLI and npm package pinned to `2.8.3`.
- Keep Node.js in the existing `>=22.0.0 <23` range.
- Never automatically publish fetched or parsed wiki content; curator acceptance and release validation remain mandatory.
- Treat owner gameplay attestation as a distinct evidence class, not wiki verification.
- Recommend only verified, compatible, currently obtainable records allowed by the player’s access preferences or already owned.
- Do not label strategy weights or target shares as wiki-verified facts.
- Do not modify social OAuth configuration.
- Use `apply_patch` for hand-authored file edits.
- Use test-first red/green cycles for every production behavior change.
- Run the focused test named in each task before its implementation and after its implementation.
- Commit each task independently after its focused and neighboring tests pass.

## File and responsibility map

### Stat planning and results

- Modify `optimizer-v2/client/src/domain/optimizer/allocateStats.ts`: spend-now and actual-level row generation.
- Modify `optimizer-v2/client/src/domain/optimizer/planReadiness.ts`: capacity checks include current unspent points.
- Modify `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`: produce the new allocation contract.
- Modify `optimizer-v2/client/src/features/planner/StatsScreen.tsx`: Available/Invested/Unspent copy.
- Modify `optimizer-v2/client/src/features/results/ResultsScreen.tsx`: desktop spend-now block and level sheet.
- Modify `optimizer-v2/client/src/features/share/SharedBuildScreen.tsx`: read-only parity with Results.
- Create `optimizer-v2/client/src/features/results/LevelAllocationTable.tsx`: accessible desktop table and mobile cards.
- Modify `optimizer-v2/client/src/styles/planner.css`: responsive sheet/card presentation.

### Catalog and mechanics domain

- Modify `optimizer-v2/client/src/domain/dataset/model.ts`: version-2 catalog, acquisition, evidence, mechanic, and policy types.
- Modify `optimizer-v2/client/src/domain/dataset/schema.ts`: backward-compatible release parsing and version-2 validation.
- Create `optimizer-v2/client/src/domain/dataset/eligibility.ts`: type guards for optimizer-safe records.
- Create `optimizer-v2/client/src/domain/wiki/model.ts`: raw snapshot, inventory, parser result, and coverage-manifest types.
- Create `optimizer-v2/client/src/domain/wiki/inventory.ts`: pure category/list inventory reconciliation.
- Create `optimizer-v2/client/src/domain/wiki/equipmentParser.ts`: equipment/list/infobox normalization.
- Create `optimizer-v2/client/src/domain/wiki/mechanicsParser.ts`: sourced mechanics extraction.
- Create `optimizer-v2/client/src/domain/wiki/coverage.ts`: manifest computation and release-gate errors.
- Keep `optimizer-v2/client/src/features/curation/wikiTableParser.ts` as a compatibility re-export until all imports migrate.
- Create `optimizer-v2/client/src/domain/optimizer/mechanics.ts`: compile validated records into executable constants without `eval`.
- Modify `optimizer-v2/client/src/domain/optimizer/projections.ts`: consume compiled mechanics and represent unsupported metrics explicitly.
- Modify `optimizer-v2/client/src/domain/optimizer/goalConfig.ts`: version and label strategy policy separately from facts.

### Wiki tooling and curation

- Create `optimizer-v2/scripts/wiki/mediawiki-api.mjs`: bounded MediaWiki requests, continuation, retry, and revision metadata.
- Create `optimizer-v2/scripts/wiki/inventory.mjs`: fetch canonical build-relevant inventory.
- Create `optimizer-v2/scripts/audit-wiki-catalog.mjs`: produce and optionally stage snapshots/candidates without publishing.
- Create `optimizer-v2/scripts/publish-catalog-release.mjs`: stage reviewed release `2026.08.30.1` and publish only after gates pass.
- Create `optimizer-v2/client/src/features/curation/CoverageManifestPanel.tsx`: curator coverage and unresolved-state UI.
- Modify current curation components to review aliases, acquisitions, resistances, verification, and mechanic computability.

### SpacetimeDB and mapping

- Add version-2 private/public catalog tables to `optimizer-v2/spacetimedb/src/schema.ts`; do not delete version-1 tables.
- Extend `optimizer-v2/spacetimedb/src/curationReducers.ts`, `curationViews.ts`, `releaseValidation.ts`, and `index.ts` for version-2 drafts, carry-forward, and atomic publication.
- Modify `optimizer-v2/client/src/infrastructure/spacetime/datasetMapper.ts` and `PublicDataProvider.tsx` to assemble catalog children and historical version-1 snapshots.
- Regenerate `optimizer-v2/client/src/module_bindings/` with SpacetimeDB `2.8.3` after schema/reducer work.
- Modify `optimizer-v2/scripts/export-fallback-release.mjs`, `validate-release-coverage.mjs`, and first-release tooling for version-2 data while retaining version-1 tests.

### Build access and gear behavior

- Modify `optimizer-v2/client/src/domain/build/model.ts` and `schema.ts` to normalize persisted schema version 2 into runtime schema version 3 with access preferences.
- Modify SpacetimeDB build/shared rows and cloud/share mappers to persist access preferences with backward-compatible defaults.
- Create `optimizer-v2/client/src/domain/optimizer/gearEffects.ts`: raw totals, resistances, supported computed effects, and comparison deltas.
- Modify `EquipmentScreen.tsx`, completeness helpers, eligibility, and equipment recommendation logic for catalog status, slots, access, and owned legacy gear.

---

### Task 1: Allocate Current Unspent Points and Ten Exact Level Rows

**Files:**
- Modify: `optimizer-v2/client/src/domain/optimizer/allocateStats.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/planReadiness.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`
- Test: `optimizer-v2/client/src/domain/optimizer/allocateStats.test.ts`
- Test: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Test: `optimizer-v2/client/src/domain/optimizer/optimizerStress.test.ts`

**Interfaces:**
- Consumes: `StatBlock`, `OptimizationGoal`, `GearTotals`, current `level`, and computed `unspentPoints`.
- Produces:

```ts
export interface SpendNowAllocation {
  points: number;
  added: StatBlock;
  totals: StatBlock;
}

export interface LevelAllocationRow {
  level: number;
  added: StatBlock;
  totals: StatBlock;
}

export interface StatAllocationPlan {
  spendNow: SpendNowAllocation;
  levels: 10;
  futurePoints: 30;
  futureAdded: StatBlock;
  levelRows: LevelAllocationRow[];
  milestones: Array<{ afterLevel: 5 | 10; added: StatBlock; totals: StatBlock }>;
  final: StatBlock;
}

export function allocateStatPlan(input: StatAllocationInput & {
  unspentPoints: number;
}): StatAllocationPlan;
```

- `optimizeBuild` passes `analyzeStatBudget(...).difference` as `unspentPoints` after readiness accepts the profile.

- [ ] **Step 1: Write the failing domain tests**

Add these assertions before changing production code:

```ts
it('allocates three current Level-1 points before ten future levels', () => {
  const plan = allocateStatPlan({
    level: 1,
    stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
    gear: { attack: 2.5, defense: 0.5, dexterity: 3 },
    goal: 'balanced',
    unspentPoints: 3,
  });

  expect(sum(plan.spendNow.added)).toBe(3);
  expect(plan.levelRows.map((row) => row.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(plan.levelRows).toHaveLength(10);
  expect(plan.levelRows.every((row) => sum(row.added) === 3)).toBe(true);
  expect(sum(plan.final)).toBe(33);
});

it('reconciles every running total from spend-now through Level +10', () => {
  const addStats = (left: StatBlock, right: StatBlock): StatBlock => ({
    str: left.str + right.str,
    def: left.def + right.def,
    agi: left.agi + right.agi,
    vit: left.vit + right.vit,
    luk: left.luk + right.luk,
  });
  const current = { str: 14, def: 0, agi: 3, vit: 7, luk: 0 };
  const plan = allocateStatPlan({
    ...standardInput,
    level: 8,
    stats: current,
    goal: 'balanced',
    unspentPoints: 0,
  });
  let previous = plan.spendNow.totals;
  for (const row of plan.levelRows) {
    expect(row.totals).toEqual(addStats(previous, row.added));
    previous = row.totals;
  }
  expect(plan.final).toEqual(previous);
});
```

Also change readiness coverage to require `unspentPoints + 30` open stat slots and add an optimizer assertion that an under-budget profile no longer returns a reduced-precision warning.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run allocateStats.test.ts optimizeBuild.test.ts
```

Expected: FAIL because `allocateStatPlan`, `spendNow`, and `levelRows` do not exist and the optimizer still emits an unaccounted-points warning.

- [ ] **Step 3: Implement the minimal allocation contract**

Factor the existing point chooser into one reusable point loop. Allocate `unspentPoints` at `input.level`, snapshot `spendNow.totals`, then run ten batches of three at levels `input.level + 1` through `input.level + 10`. Derive milestones from rows 5 and 10; do not run a second allocation for milestones.

Use this shape:

```ts
function allocatePoints(
  count: number,
  levelForPoint: (pointIndex: number) => number,
  final: StatBlock,
  added: StatBlock,
  input: StatAllocationInput,
) {
  for (let pointIndex = 0; pointIndex < count; pointIndex += 1) {
    const stat = chooseNextStat(levelForPoint(pointIndex), final, input.gear, input.goal);
    final[stat] += 1;
    added[stat] += 1;
  }
}
```

Delete the warning that treats valid unspent points as unknowable; those points now have an action. Retain overspend and insufficient-capacity blockers.

- [ ] **Step 4: Run focused and stress tests**

Run:

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run allocateStats.test.ts optimizeBuild.test.ts optimizerStress.test.ts
```

Expected: PASS; every serialized plan is deterministic, every future row adds exactly three, and final totals reconcile.

- [ ] **Step 5: Commit Task 1**

```powershell
git add optimizer-v2/client/src/domain/optimizer
git commit -m "fix: make stat plans actionable level by level"
```

### Task 2: Render Spend-Now, Clear Budget Copy, and Responsive Level Sheet

**Files:**
- Create: `optimizer-v2/client/src/features/results/LevelAllocationTable.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/StatsScreen.tsx`
- Modify: `optimizer-v2/client/src/styles/planner.css`
- Test: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`
- Test: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`
- Test: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`

**Interfaces:**
- Consumes: `SpendNowAllocation` and `LevelAllocationRow[]` from Task 1.
- Produces: `<LevelAllocationTable rows={plan.statPlan.levelRows} />` with one semantic table for desktop and equivalent cards hidden from desktop by CSS, not duplicated interactive state.

- [ ] **Step 1: Write failing screen tests**

Replace milestone-only assertions with:

```tsx
expect(screen.getByText('Available 3 · Invested 0 · Unspent 3')).toBeVisible();

const spendNow = screen.getByRole('region', { name: 'Spend now' });
expect(within(spendNow).getByText('3 points available now')).toBeVisible();

const table = screen.getByRole('table', { name: 'Next ten levels' });
expect(within(table).getAllByRole('row')).toHaveLength(11);
expect(within(table).getByRole('rowheader', { name: 'Level 2' })).toBeVisible();
expect(within(table).getByRole('rowheader', { name: 'Level 11' })).toBeVisible();
expect(screen.getByText('Add this level is new spending for that level; totals are your stats after spending.')).toBeVisible();
expect(screen.queryByText('Level +5')).not.toBeInTheDocument();
```

Add shared-route assertions for the same spend-now values and ten rows. Add a component test that each row’s five “Add” cells sum to three and that card text matches table text.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run plannerScreens.test.tsx ResultsScreen.test.tsx SharedBuildScreen.test.tsx
```

Expected: FAIL on the old `Expected/Entered/Difference` copy, missing spend-now region, and milestone-only table.

- [ ] **Step 3: Implement the results component and copy**

`LevelAllocationTable.tsx` must render headers in two groups:

```tsx
<table aria-label="Next ten levels" className="level-allocation-table">
  <thead>
    <tr>
      <th rowSpan={2}>Level</th>
      <th colSpan={5}>Add this level</th>
      <th colSpan={5}>Stats after spending</th>
    </tr>
    <tr>{/* STR+, DEF+, AGI+, VIT+, LUK+, then STR, DEF, AGI, VIT, LUK */}</tr>
  </thead>
</table>
```

The mobile cards show `Level N`, a human sentence such as `Add STR +1 · AGI +1 · VIT +1`, and a `<details>` running-total block. Results order is Do now → Spend now → Next ten levels → Next upgrades → Why this plan. Shared results use the same component.

- [ ] **Step 4: Run focused tests and client typecheck**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run plannerScreens.test.tsx ResultsScreen.test.tsx SharedBuildScreen.test.tsx
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS with no React accessibility warnings.

- [ ] **Step 5: Commit Task 2 and checkpoint**

```powershell
git add optimizer-v2/client/src/features optimizer-v2/client/src/styles/planner.css
git commit -m "feat: show spend-now and exact level allocations"
```

Checkpoint evidence: capture the Level-1 Results route at desktop and 390×844 after Task 2 during execution; do not write screenshots into the repository.

### Task 3: Introduce Backward-Compatible Catalog and Evidence Types

**Files:**
- Modify: `optimizer-v2/client/src/domain/dataset/model.ts`
- Modify: `optimizer-v2/client/src/domain/dataset/schema.ts`
- Create: `optimizer-v2/client/src/domain/dataset/eligibility.ts`
- Modify: `optimizer-v2/client/src/domain/dataset/schema.test.ts`
- Modify: `optimizer-v2/client/src/data/bootstrapRelease.ts`
- Modify: `optimizer-v2/client/src/data/fallbackRelease.ts`
- Modify: `optimizer-v2/client/src/data/fallbackRelease.test.ts`
- Modify: `optimizer-v2/client/src/test/stressFixtures.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.test.ts`

**Interfaces:**
- Produces:

```ts
export type CatalogVerificationStatus = 'verified' | 'partial' | 'conflicting' | 'unknown' | 'legacy';
export type CatalogAvailability = 'always' | 'active-event' | 'inactive-event' | 'rotating' | 'limited' | 'gamepass' | 'badge' | 'legacy' | 'unobtainable' | 'unknown';
export type CatalogAccessType = 'free' | 'event' | 'gamepass' | 'badge' | 'limited' | 'owned-only';
export type MechanicComputability = 'exact' | 'descriptive' | 'conflicting' | 'unknown';

export interface EquipmentAcquisition {
  id: string;
  type: AcquisitionType;
  detail: string;
  floor?: number;
  cost?: number;
  currency?: string;
  availability: CatalogAvailability;
  accessType: CatalogAccessType;
  sourceUrl: string;
  sourceRevision: string;
}

export interface EquipmentResistance { status: string; percent: number; sourceUrl: string; sourceRevision: string; }

export interface CatalogEquipmentRecord {
  id: string;
  name: string;
  aliases: string[];
  variantGroupId?: string;
  slot: EquipmentSlot;
  weaponPaths: WeaponPath[];
  attack: number | null;
  defense: number | null;
  dexterity: number | null;
  levelRequirement: number | null;
  skillRequirement?: number;
  acquisitions: EquipmentAcquisition[];
  resistances: EquipmentResistance[];
  specialEffects: string[];
  verificationStatus: CatalogVerificationStatus;
  sourceUrl: string;
  sourceRevision: string;
  lastReviewedAt: string;
}

export interface EquipmentRecord extends Omit<
  CatalogEquipmentRecord,
  'attack' | 'defense' | 'dexterity' | 'levelRequirement' | 'verificationStatus'
> {
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  verificationStatus: 'verified';
}

export interface MechanicRecord {
  id: string;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  computability: MechanicComputability;
  parameters: Record<string, number>;
  verificationStatus: CatalogVerificationStatus;
  sourceUrl: string;
  sourceRevision: string;
  lastReviewedAt: string;
}

export interface DatasetSnapshot {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  sourceSummary: string;
  formulaSetVersion: 'sbor-stats-v1' | 'sbor-stats-v2';
  strategyPolicyVersion: 'sbor-policy-v1' | 'sbor-policy-v2';
  pointsPerLevel: 3;
  dualWieldSkillGate?: 200;
  knownGaps: KnownGapRecord[];
  mechanics: MechanicRecord[];
  catalog: CatalogEquipmentRecord[];
  equipment: EquipmentRecord[];
}

export function isOptimizerSafeEquipment(item: CatalogEquipmentRecord): item is EquipmentRecord;
```

- Historical version-1 JSON is normalized into the new runtime shape with one acquisition derived from `acquisitionType`, `acquisitionDetail`, `floor`, and `availability`.
- Historical `formulas` rows are normalized into runtime `mechanics`; downstream code reads only `snapshot.mechanics`. Old releases default to `sbor-policy-v1`.

- [ ] **Step 1: Write failing schema and normalization tests**

```ts
it('normalizes the historical release into catalog acquisitions', () => {
  const snapshot = datasetSnapshotSchema.parse(rawFallbackRelease);
  const steel = snapshot.equipment.find((item) => item.id === 'steel-greatsword')!;
  expect(steel.acquisitions).toEqual([
    expect.objectContaining({ type: 'shop', availability: 'always', accessType: 'free' }),
  ]);
  expect(snapshot.strategyPolicyVersion).toBe('sbor-policy-v1');
});

it('retains partial catalog records without making them optimizer safe', () => {
  const catalogFixture = {
    id: 'catalog-item',
    name: 'Catalog Item',
    aliases: [],
    slot: 'main-hand' as const,
    weaponPaths: ['one-handed' as const],
    attack: 8.4,
    defense: 0,
    dexterity: 0,
    levelRequirement: 1,
    acquisitions: [{
      id: 'catalog-item:shop',
      type: 'shop' as const,
      detail: 'Floor 1 Shop',
      floor: 1,
      availability: 'always' as const,
      accessType: 'free' as const,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed',
      sourceRevision: '26216',
    }],
    resistances: [],
    specialEffects: [],
    verificationStatus: 'verified' as const,
    sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed',
    sourceRevision: '26216',
    lastReviewedAt: '2026-08-30',
  };
  const item = catalogEquipmentRecordSchema.parse({ ...catalogFixture, attack: null, verificationStatus: 'partial' });
  expect(isOptimizerSafeEquipment(item)).toBe(false);
});
```

Add rejection tests for a `verified` weapon with null attack, duplicate acquisition IDs, noncanonical field evidence, negative costs, resistance outside 0–100, and a `legacy` record marked ordinary recommendation-eligible.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run schema.test.ts fallbackRelease.test.ts
```

Expected: FAIL because the catalog types, normalization, and safety guard do not exist.

- [ ] **Step 3: Implement schemas and legacy normalization**

Use a Zod union of the existing version-1 row shape and the version-2 catalog row shape. Transform version-1 rows once at the schema boundary; downstream code receives `catalog` with every accounted record and `equipment` containing only records narrowed by `isOptimizerSafeEquipment`. Keep provenance refinements on every source-bearing child.

- [ ] **Step 4: Run focused tests, all dataset tests, and typecheck**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/dataset src/data/fallbackRelease.test.ts
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS; any compile failures identify callers that must use the safety guard rather than non-null assertions.

- [ ] **Step 5: Commit Task 3**

```powershell
git add optimizer-v2/client/src/domain/dataset optimizer-v2/client/src/data/fallbackRelease.test.ts
git commit -m "feat: add versioned catalog evidence model"
```

### Task 4: Discover the Complete Build-Relevant Wiki Inventory

**Files:**
- Create: `optimizer-v2/client/src/domain/wiki/model.ts`
- Create: `optimizer-v2/client/src/domain/wiki/inventory.ts`
- Create: `optimizer-v2/client/src/domain/wiki/inventory.test.ts`
- Create: `optimizer-v2/scripts/wiki/mediawiki-api.mjs`
- Create: `optimizer-v2/scripts/wiki/mediawiki-api.test.mjs`
- Create: `optimizer-v2/scripts/wiki/inventory.mjs`
- Create: `optimizer-v2/scripts/wiki/inventory.test.mjs`
- Modify: `optimizer-v2/package.json`

**Interfaces:**

```ts
export interface WikiPageSnapshot {
  pageId: number;
  pageTitle: string;
  sourceUrl: string;
  revisionId: string;
  revisionTimestamp: string;
  contentHash: string;
  redirectTarget?: string;
  content: string;
}

export interface WikiInventoryEntry {
  pageId: number;
  pageTitle: string;
  categories: string[];
  kind: 'equipment' | 'mechanics' | 'acquisition' | 'index';
}

export async function requestMediaWiki(params: URLSearchParams, options?: {
  fetchImpl?: typeof fetch;
  attempts?: number;
}): Promise<unknown>;

export async function fetchAllPagesForCategory(category: string, fetchJson = requestMediaWiki): Promise<WikiInventoryEntry[]>;
export function reconcileInventory(entries: readonly WikiInventoryEntry[]): WikiInventoryEntry[];
```

Initial roots are exact strings: `Category:Weapons`, `Category:Armor`, `Category:Shields`, `One-Handed`, `Two-Handed`, `Rapier`, `Dagger`, `Melee`, `Fists`, `Armor`, `Upper Headwear`, `Lower Headwear`, `Shields`, `Gamepass and Badge Equipment`, and `Shops`.

- [ ] **Step 1: Write failing continuation, retry, and reconciliation tests**

Use fixture responses with two `continue` tokens, one 429 response followed by success, a redirect alias, and the same page returned by two categories. Assert deterministic sorting by page ID then title and exactly one canonical entry per page ID.

- [ ] **Step 2: Run script and client tests to verify RED**

```powershell
cd optimizer-v2
node --import tsx --test scripts/wiki/*.test.mjs
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/wiki/inventory.test.ts
```

Expected: FAIL because the API and inventory modules do not exist.

- [ ] **Step 3: Implement bounded MediaWiki access and inventory**

Use `https://swordbloxonlinerebirth.fandom.com/api.php`, `format=json`, `formatversion=2`, `cmlimit=max`, a descriptive user agent, two concurrent requests maximum, and retry delays of 250 ms then 1,000 ms for 429/5xx only. Reject noncanonical hosts and unsafe page titles before any request.

Add scripts:

```json
"audit:wiki-inventory": "tsx scripts/wiki/inventory.mjs",
"test:wiki-tools": "node --import tsx --test scripts/wiki/*.test.mjs"
```

- [ ] **Step 4: Run deterministic tests and a read-only current inventory probe**

```powershell
node --import tsx --test scripts/wiki/*.test.mjs
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/wiki/inventory.test.ts
npm run audit:wiki-inventory -- --summary
```

Expected: tests PASS; the probe prints discovered counts and performs no file, database, or publication writes.

- [ ] **Step 5: Commit Task 4**

```powershell
git add optimizer-v2/client/src/domain/wiki optimizer-v2/scripts/wiki optimizer-v2/package.json
git commit -m "feat: inventory build-relevant wiki pages"
```

### Task 5: Normalize Equipment, Aliases, Acquisitions, Availability, and Coverage

**Files:**
- Create: `optimizer-v2/client/src/domain/wiki/equipmentParser.ts`
- Create: `optimizer-v2/client/src/domain/wiki/equipmentParser.test.ts`
- Create: `optimizer-v2/client/src/domain/wiki/coverage.ts`
- Create: `optimizer-v2/client/src/domain/wiki/coverage.test.ts`
- Move/modify fixtures under: `optimizer-v2/client/src/features/curation/fixtures/`
- Modify: `optimizer-v2/client/src/features/curation/wikiTableParser.ts`
- Modify: `optimizer-v2/client/src/features/curation/wikiTableParser.test.ts`

**Interfaces:**

```ts
export interface ParsedCatalogPage {
  page: WikiPageSnapshot;
  equipment: CatalogEquipmentRecord[];
  aliases: Array<{ alias: string; itemId: string; sourceLine: string }>;
  warnings: string[];
  unresolved: Array<{ pageTitle: string; reason: string; sourceLine?: string }>;
}

export function parseEquipmentSnapshot(snapshot: WikiPageSnapshot): ParsedCatalogPage;
export function buildCoverageManifest(input: {
  inventory: readonly WikiInventoryEntry[];
  parsed: readonly ParsedCatalogPage[];
}): WikiCoverageManifest;
export function coverageReleaseErrors(manifest: WikiCoverageManifest): string[];
```

- [ ] **Step 1: Write failing parser-family tests**

Add fixtures/tests for all six weapon paths, armor, upper/lower headwear, shields, gamepass/badge tables, event acquisition, shop cost, redirect alias, variant name, a malformed numeric cell, an unknown infobox layout, and an inactive event. Assert:

```ts
expect(result.equipment[0]).toMatchObject({
  name: 'Steel Sword',
  attack: 8.4,
  skillRequirement: 5,
  verificationStatus: 'verified',
  acquisitions: [expect.objectContaining({ type: 'shop', accessType: 'free' })],
});
expect(malformed.equipment[0].verificationStatus).toBe('partial');
expect(malformed.unresolved[0].reason).toMatch(/attack/i);
```

Coverage tests must fail publication when an inventory page is absent from parsed/unresolved accounting, while allowing an explicitly `partial` page with a reason.

- [ ] **Step 2: Run parser tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run equipmentParser.test.ts coverage.test.ts wikiTableParser.test.ts
```

Expected: FAIL because the new parser and manifest do not exist.

- [ ] **Step 3: Implement parser families and fail-closed classification**

Reuse strict table tokenization but emit field-level source metadata and child acquisition records. Classify permanent free sources as `always/free`; gamepass and badge explicitly; event rows as inactive unless the pinned source explicitly states the event is active. Unknown acquisition, requirement, or numeric cells yield `partial` or `unknown`, never zero/default eligibility.

Make `features/curation/wikiTableParser.ts` re-export the new functions so existing curation tests continue to compile during migration.

- [ ] **Step 4: Run parser, schema, and coverage tests**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run equipmentParser.test.ts coverage.test.ts wikiTableParser.test.ts schema.test.ts
```

Expected: PASS with deterministic record order and no silent dropped inventory page.

- [ ] **Step 5: Commit Task 5**

```powershell
git add optimizer-v2/client/src/domain/wiki optimizer-v2/client/src/features/curation
git commit -m "feat: parse complete wiki equipment catalog"
```

### Task 6: Compile Wiki Mechanics and Remove Hard-Coded Formula Authority

**Files:**
- Create: `optimizer-v2/client/src/domain/wiki/mechanicsParser.ts`
- Create: `optimizer-v2/client/src/domain/wiki/mechanicsParser.test.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/mechanics.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/mechanics.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/projections.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/projections.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/goalConfig.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/allocateStats.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts`

**Interfaces:**

```ts
export interface CompiledMechanics {
  version: 'sbor-stats-v1' | 'sbor-stats-v2';
  pointsPerLevel: 3;
  statCap: 500;
  strDamagePerPoint?: number;
  defMultiplierBase?: number;
  defMultiplierPerPoint?: number;
  dexHpBaseMultiplier?: number;
  vitDexMultiplierPerPoint?: number;
  staminaBase?: number;
  staminaPerLevel?: number;
  staminaPerStrAgiVitPoint?: number;
  walkSpeedPerAgi?: number;
  sprintSpeedPerAgi?: number;
  critPerLuk?: number;
  dropPerLuk?: number;
  descriptive: MechanicRecord[];
}

export function compileMechanics(snapshot: DatasetSnapshot): CompiledMechanics;
export function projectMetrics(input: ProjectionInput, mechanics: CompiledMechanics): ProjectedMetrics;
```

`ProjectedMetrics` uses `number | null` for unsupported computed metrics. Scoring ignores null dimensions and records which dimensions were unavailable.

- [ ] **Step 1: Write failing mechanics and projection tests**

Parse current Stats fixture statements for STR damage/stamina/multi-hit, DEF, AGI movement/jump/interval, VIT HP/stamina/resistance, and LUK critical/drop/multi-hit/reroll. Assert exact parameters only for numerically complete statements and `descriptive` for attack-interval prose without a complete function.

```ts
expect(compileMechanics(snapshot).strDamagePerPoint).toBe(0.004);
expect(compileMechanics(snapshot).vitDexMultiplierPerPoint).toBe(0.01);
expect(projectMetrics(input, mechanics).attackPerHit).toBeCloseTo(gear.attack * (1 + str * 0.004));
expect(projectMetrics(input, mechanicsWithoutDefense).damageReductionPerHit).toBeNull();
```

Add a test proving changing a verified mechanic parameter changes projections without editing `projections.ts`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run mechanicsParser.test.ts mechanics.test.ts projections.test.ts
```

Expected: FAIL because projections currently hard-code constants and do not represent unsupported metrics.

- [ ] **Step 3: Implement parser, compiler, and policy separation**

Compile with an exhaustive switch on mechanic ID and validated parameter names; never execute the source expression. Add `STRATEGY_POLICY_VERSION = 'sbor-policy-v2'` and explanations such as `Balanced planner policy prioritized damage, survival, mobility, and farming metrics.` Remove language implying the wiki chose target shares.

- [ ] **Step 4: Run all optimizer tests and typecheck**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/optimizer src/domain/wiki/mechanicsParser.test.ts
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS; unsupported mechanics remain visible as limitations and never become zero-value scores.

- [ ] **Step 5: Commit Task 6 and checkpoint**

```powershell
git add optimizer-v2/client/src/domain/wiki optimizer-v2/client/src/domain/optimizer
git commit -m "feat: drive projections from verified mechanics"
```

Checkpoint evidence: produce a text audit mapping every compiled constant to mechanic ID, revision, and parameter; review all null/descriptive mechanics before continuing.

### Task 7: Add Version-2 SpacetimeDB Catalog and Snapshot Tables

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Test: `optimizer-v2/spacetimedb/src/validation.test.ts`

**Interfaces:**
- Preserve all current version-1 tables.
- Add private `wiki_page_snapshot` and `coverage_manifest` tables.
- Add draft/public pairs for `catalog_equipment`, `equipment_alias`, `equipment_acquisition`, `equipment_resistance`, `equipment_special_effect`, and `mechanic`.
- Add public `release_strategy_policy` keyed by release version.

Core row fields are exact:

```ts
export const catalogEquipment = table({
  name: 'catalog_equipment', public: true,
  indexes: [{ accessor: 'catalogEquipmentReleaseVersion', name: 'catalog_equipment_release_version', algorithm: 'btree', columns: ['releaseVersion'] }],
}, {
  id: t.string().primaryKey(),
  releaseVersion: t.string(),
  itemId: t.string(),
  name: t.string(),
  variantGroupId: t.string().optional(),
  slot: t.string(),
  weaponPaths: t.string(),
  attack: t.f64().optional(),
  defense: t.f64().optional(),
  dexterity: t.f64().optional(),
  levelRequirement: t.u32().optional(),
  skillRequirement: t.u32().optional(),
  verificationStatus: t.string(),
  sourceRefId: t.string(),
  lastReviewedAt: t.string(),
});
```

Child IDs are release-scoped and parent IDs are explicit. Snapshot content remains private.

- [ ] **Step 1: Write failing schema-surface tests**

Add compile-time/runtime tests that the new tables exist, raw snapshot content is not public, catalog/mechanic public rows are public, and every child table has a release-version index.

- [ ] **Step 2: Run module tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-module -- --run validation.test.ts
```

Expected: FAIL because the new table exports are missing.

- [ ] **Step 3: Implement new tables and schema registration**

Use separate version-2 tables rather than mutating/removing version-1 equipment/formula tables. Register every table in the exported schema and `index.ts` surface.

- [ ] **Step 4: Run module typecheck, unit tests, and module build**

```powershell
npm run typecheck --workspace @sbo/optimizer-module
npm run test:unit --workspace @sbo/optimizer-module
npm run build --workspace @sbo/optimizer-module
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add optimizer-v2/spacetimedb/src/schema.ts optimizer-v2/spacetimedb/src/index.ts optimizer-v2/spacetimedb/src/validation.test.ts
git commit -m "feat: add versioned catalog database tables"
```

### Task 8: Extend Curator Drafts, Validation, and Atomic Publication

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/curationReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/curationViews.ts`
- Modify: `optimizer-v2/spacetimedb/src/releaseValidation.ts`
- Modify: `optimizer-v2/spacetimedb/src/releaseValidation.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Modify: `optimizer-v2/client/e2e/curation-module.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`

**Interfaces:**
- Add protected reducers `upsertWikiPageSnapshot`, `upsertCoverageManifest`, `upsertDraftCatalogEquipment`, `upsertDraftEquipmentAlias`, `upsertDraftEquipmentAcquisition`, `upsertDraftEquipmentResistance`, `upsertDraftEquipmentSpecialEffect`, `upsertDraftMechanic`, and `upsertDraftStrategyPolicy`.
- Existing `publishRelease({ version })` chooses version-1 validation for `sbor-stats-v1` and version-2 validation for `sbor-stats-v2`.
- Version-2 publication copies all parents/children and the policy row atomically, then changes the current release only after inserts succeed.

- [ ] **Step 1: Write failing release-validation and rollback tests**

Add cases for orphan acquisition, duplicate alias, resistance outside 0–100, verified weapon missing attack, partial record incorrectly recommendation-eligible, missing coverage page, manifest count mismatch, unsupported policy version, unaccepted source snapshot, and publication failure leaving the former release current with no version-2 child rows.

```ts
expect(validateRelease(v2Input)).toContain('Catalog item steel-sword has an orphan acquisition');
expect(validateRelease(v2InputWithMissingPage)).toContain('Coverage manifest leaves 1 inventory page unaccounted for');
```

- [ ] **Step 2: Run module tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-module -- --run releaseValidation.test.ts
```

Expected: FAIL because version-2 validation and reducers do not exist.

- [ ] **Step 3: Implement protected reducers, curator views, carry-forward, and publication**

Reuse `assertCurator`, `editableDraft`, source/candidate provenance checks, and fail-before-write validation. Insert version-2 public children only after a complete in-memory validation pass. Preserve exact child sets on carry-forward and historical versions.

- [ ] **Step 4: Regenerate bindings and run focused integration**

Regenerate bindings with the repository’s pinned command, then run:

```powershell
cd optimizer-v2
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run typecheck
npm run test:unit --workspace @sbo/optimizer-module
npm run test:e2e --workspace @sbo/optimizer-client -- --grep "catalog publication|curation"
git diff --exit-code -- client/src/module_bindings
```

Expected: all focused tests PASS and generated bindings are committed rather than left as an untracked diff.

- [ ] **Step 5: Commit Task 8**

```powershell
git add optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings optimizer-v2/client/e2e
git commit -m "feat: publish reviewed catalog releases atomically"
```

### Task 9: Assemble Version-2 Releases in the Client and Fallback Export

**Files:**
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/datasetMapper.ts`
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/datasetMapper.test.ts`
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/PublicDataProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/DatasetProvider.tsx`
- Modify: `optimizer-v2/scripts/export-fallback-release.mjs`
- Modify: `optimizer-v2/scripts/export-fallback-release.test.mjs`
- Modify: `optimizer-v2/scripts/validate-release-coverage.mjs`
- Modify: `optimizer-v2/scripts/validate-release-coverage.test.mjs`

**Interfaces:**

```ts
export function mapPublishedReleaseV2(input: {
  release: ReleaseRow;
  catalogEquipment: readonly CatalogEquipmentRow[];
  aliases: readonly EquipmentAliasRow[];
  acquisitions: readonly EquipmentAcquisitionRow[];
  resistances: readonly EquipmentResistanceRow[];
  effects: readonly EquipmentSpecialEffectRow[];
  mechanics: readonly MechanicRow[];
  policy: ReleaseStrategyPolicyRow;
  sources: readonly SourceRow[];
}): DatasetSnapshot;
```

The mapper rejects duplicate child IDs, orphans, wrong-release children, source/entity mismatches, and invalid policy/mechanic versions before caching.

- [ ] **Step 1: Write failing mapper/export tests**

Create a minimal version-2 row fixture with one weapon, two acquisition rows, one resistance, exact and descriptive mechanics, and policy `sbor-policy-v2`. Assert normalized order, exact sources, historical v1 mapping unchanged, and rejection of an orphan acquisition.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run datasetMapper.test.ts DatasetProvider.test.tsx
node --test scripts/export-fallback-release.test.mjs scripts/validate-release-coverage.test.mjs
```

Expected: FAIL because version-2 child mapping/export is absent.

- [ ] **Step 3: Implement version selection, assembly, stable export, and coverage validation**

Version-1 releases continue through `mapPublishedRelease`. Version-2 releases require all version-2 child subscriptions and `mapPublishedReleaseV2`. Stable export sorts items by ID and children by child ID; raw wiki content is never exported to the public fallback.

- [ ] **Step 4: Run focused tests and full typecheck**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run datasetMapper.test.ts DatasetProvider.test.tsx fallbackRelease.test.ts
node --test scripts/export-fallback-release.test.mjs scripts/validate-release-coverage.test.mjs
npm run typecheck
```

Expected: PASS for both historical and version-2 releases.

- [ ] **Step 5: Commit Task 9 and checkpoint**

```powershell
git add optimizer-v2/client/src/infrastructure/spacetime optimizer-v2/client/src/app/providers optimizer-v2/scripts
git commit -m "feat: map and export catalog releases"
```

Checkpoint evidence: demonstrate loading both `2026.08.29.1` and a local version-2 fixture by exact dataset version with no substitution.

### Task 10: Persist Player Access Preferences Without Breaking Old Builds

**Files:**
- Modify: `optimizer-v2/client/src/domain/build/model.ts`
- Modify: `optimizer-v2/client/src/domain/build/schema.ts`
- Modify: `optimizer-v2/client/src/domain/build/schema.test.ts`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`
- Modify: `optimizer-v2/client/src/app/providers/BuildDraftProvider.test.tsx`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Modify: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Modify: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/sharing.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Modify: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.test.ts`
- Modify: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`

**Interfaces:**

```ts
export interface AccessPreferences {
  activeEvent: boolean;
  gamepass: boolean;
  badge: boolean;
  limited: boolean;
}

export interface CharacterProfile {
  schemaVersion: 3;
  id: string;
  name?: string;
  level: number;
  maxFloor: number;
  weaponPath: WeaponPath;
  goal: OptimizationGoal;
  weaponSkill?: number;
  stats: StatBlock;
  equipped: Partial<Record<EquipmentSlot, string>>;
  ownedItemIds: string[];
  datasetVersion: string;
  accessPreferences: AccessPreferences;
}

export const DEFAULT_ACCESS_PREFERENCES: AccessPreferences = {
  activeEvent: false,
  gamepass: false,
  badge: false,
  limited: false,
};
```

Persist SpacetimeDB preferences as a canonical comma-separated value in `accessPreferences: t.string().default('')`; parse only the four allowed keys. Version-2 profiles normalize to runtime version 3 with defaults.

- [ ] **Step 1: Write failing migration/cloud/share tests**

Assert a stored schema-2 profile becomes schema 3 with all false, schema-3 preferences round-trip through cloud revision and public share, unknown preference tokens reject, and omitted new DB columns behave as empty/default.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build/schema.test.ts buildMappers.test.ts SharedBuildScreen.test.tsx
npm run test:unit --workspace @sbo/optimizer-module -- --run validation.test.ts
```

Expected: FAIL because profile version 3 and persisted preferences do not exist.

- [ ] **Step 3: Implement migration and persistence**

Use one `normalizeCharacterProfile` schema transform at storage/cloud boundaries. Reducers validate tokens before storing. Shares contain no owner identity and only the access flags necessary to reproduce recommendation eligibility.

- [ ] **Step 4: Regenerate bindings and run persistence suites**

```powershell
npm run typecheck
npm run test:unit --workspace @sbo/optimizer-client -- --run src/domain/build buildMappers.test.ts BuildDraftProvider.test.tsx SharedBuildScreen.test.tsx
npm run test:unit --workspace @sbo/optimizer-module
```

Expected: PASS with historical schema-2 fixtures unchanged on disk but normalized in memory.

- [ ] **Step 5: Commit Task 10**

```powershell
git add optimizer-v2/client/src/domain/build optimizer-v2/client/src/infrastructure/cloud optimizer-v2/client/src/features/share optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings
git commit -m "feat: persist equipment access preferences"
```

### Task 11: Model Armor, Shields, Headwear, and Verified Upgrade Comparisons

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/gearEffects.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/gearEffects.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/eligibility.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/eligibility.test.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts`
- Modify: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.test.ts`
- Modify: `optimizer-v2/client/src/features/planner/completeness.ts`
- Modify: `optimizer-v2/client/src/features/planner/EquipmentScreen.tsx`
- Modify: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`

**Interfaces:**

```ts
export interface GearEffects {
  attack: number;
  defense: number;
  dexterity: number;
  resistances: Record<string, number>;
  descriptiveEffects: string[];
}

export interface UpgradeComparison {
  currentItemId?: string;
  targetItemId: string;
  rawDelta: { attack?: number; defense?: number; dexterity?: number; resistances: Record<string, number> };
  metricDelta: Partial<Record<keyof ProjectedMetrics, number>>;
  unmodeledEffects: string[];
}

export function aggregateGearEffects(equipped: CharacterProfile['equipped'], equipment: ReadonlyMap<string, EquipmentRecord>): GearEffects;
export function compareUpgrade(input: {
  profile: CharacterProfile;
  slot: EquipmentSlot;
  target: EquipmentRecord;
  equipment: ReadonlyMap<string, EquipmentRecord>;
  mechanics: CompiledMechanics;
}): UpgradeComparison;
```

- [ ] **Step 1: Write failing gear and recommendation tests**

Cover armor + upper + lower + shield aggregation, resistance totals by status, a descriptive effect excluded from numeric score but displayed, owned legacy gear allowed as current equipment, legacy gear excluded from farming, gamepass candidate excluded by default and admitted when `gamepass: true`, active event access, partial/conflicting exclusion, shield only for sourced compatible paths, and no null stat treated as zero improvement.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run gearEffects.test.ts eligibility.test.ts recommendEquipment.test.ts plannerScreens.test.tsx
```

Expected: FAIL because aggregation, access filtering, and catalog-safe comparisons are absent.

- [ ] **Step 3: Implement gear aggregation, safe eligibility, and Equipment UI**

Equipment search shows status and access labels. Advanced access toggles update profile preferences. Selects include verified compatible records and already-owned legacy records; partial/conflicting items appear only in an informational catalog section, never as selectable optimizer inputs. Results upgrade rows show current → target raw stats, supported computed change, requirement, current acquisition, unmodeled effects, and source.

- [ ] **Step 4: Run gear, planner, results, and optimizer suites**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run gearEffects.test.ts eligibility.test.ts recommendEquipment.test.ts plannerScreens.test.tsx ResultsScreen.test.tsx optimizeBuild.test.ts
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS.

- [ ] **Step 5: Commit Task 11**

```powershell
git add optimizer-v2/client/src/domain/optimizer optimizer-v2/client/src/features/planner optimizer-v2/client/src/features/results
git commit -m "feat: model verified armor and gear upgrades"
```

### Task 12: Expose Coverage and Field-Level Review in the Curator UI

**Files:**
- Create: `optimizer-v2/client/src/features/curation/CoverageManifestPanel.tsx`
- Modify: `optimizer-v2/client/src/features/curation/CurationScreen.tsx`
- Modify: `optimizer-v2/client/src/features/curation/CandidateReview.tsx`
- Modify: `optimizer-v2/client/src/features/curation/ReleaseDraftEditor.tsx`
- Modify: `optimizer-v2/client/src/features/curation/PublishReleasePanel.tsx`
- Modify: `optimizer-v2/client/src/features/curation/curationWorkflow.ts`
- Modify: `optimizer-v2/client/src/features/curation/curationFlow.test.tsx`
- Modify: `optimizer-v2/client/src/styles/curation.css`

**Interfaces:**
- Coverage panel consumes current draft manifest and renders discovered/fetched/parsed/normalized/status counts plus every unresolved reason.
- Candidate review groups field evidence, aliases, acquisitions, resistance/effects, and mechanics computability under the pinned page/revision.
- Publish remains disabled while `coverageReleaseErrors(manifest)` or release-validation errors are nonempty.

- [ ] **Step 1: Write failing curator-flow tests**

Assert a complete manifest renders counts, an unresolved page displays its reason, field evidence appears beside a parsed value, reject leaves the record nonpublishable, accept stages all child records, and publish stays disabled when one discovered page is unaccounted.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- --run curationFlow.test.tsx
```

Expected: FAIL because coverage and child review UI are missing.

- [ ] **Step 3: Implement curator components and workflow mutations**

Render large raw wiki content inside a collapsed disclosure. Keep primary actions Accept, Reject, and Publish keyboard reachable. An accepted page stages its equipment/mechanics children and an immutable snapshot reference in one ordered workflow; any reducer failure leaves the candidate unaccepted.

- [ ] **Step 4: Run curator tests and client typecheck**

```powershell
npm run test:unit --workspace @sbo/optimizer-client -- --run curationFlow.test.tsx wikiTableParser.test.ts datasetMapper.test.ts
npm run typecheck --workspace @sbo/optimizer-client
```

Expected: PASS.

- [ ] **Step 5: Commit Task 12**

```powershell
git add optimizer-v2/client/src/features/curation optimizer-v2/client/src/styles/curation.css
git commit -m "feat: review wiki catalog coverage before publish"
```

### Task 13: Audit the Current Wiki and Build Release 2026.08.30.1

**Files:**
- Create: `optimizer-v2/scripts/audit-wiki-catalog.mjs`
- Create: `optimizer-v2/scripts/audit-wiki-catalog.test.mjs`
- Create: `optimizer-v2/scripts/publish-catalog-release.mjs`
- Create: `optimizer-v2/scripts/publish-catalog-release.test.mjs`
- Create: `optimizer-v2/data/wiki-manifests/2026-08-30.json`
- Modify/create fixtures only for newly encountered parser layouts.
- Modify: `optimizer-v2/client/src/data/fallback-release.json`
- Modify: `optimizer-v2/scripts/first-release-data.mjs` only to preserve historical release generation; do not rewrite its old provenance.
- Modify: `optimizer-v2/package.json`

**Interfaces:**
- `npm run audit:wiki` performs read-only inventory/fetch/parse and writes only the explicitly supplied manifest path.
- `npm run publish:catalog:local` accepts only `http://127.0.0.1:3000` and `sbo-rebirth-optimizer-v2-test` unless `--production` is present with owner credentials.
- Release constants are exact: dataset `2026.08.30.1`, mechanics `sbor-stats-v2`, strategy `sbor-policy-v2`.

- [ ] **Step 1: Write failing script-safety and manifest tests**

Assert imports have no side effects, default audit does not write, output requires a path inside `optimizer-v2/data/wiki-manifests`, local publish refuses nonlocal URI/database, production requires explicit `--production`, manifest counts reconcile, all source revisions are positive IDs, and raw source content is absent from the committed manifest.

- [ ] **Step 2: Run script tests and verify RED**

```powershell
cd optimizer-v2
node --test scripts/audit-wiki-catalog.test.mjs scripts/publish-catalog-release.test.mjs
```

Expected: FAIL because the scripts do not exist.

- [ ] **Step 3: Implement read-only audit and guarded publication scripts**

The audit fetches every inventory entry at one pinned revision, hashes source content, parses candidates, and emits counts plus record IDs/status/reasons. The publication script stages private raw snapshots and reviewed normalized children, asserts the committed manifest hash/counts, records review decisions, invokes the protected publish reducer, and verifies exact public row counts afterward.

Add these exact package scripts:

```json
"audit:wiki": "tsx scripts/audit-wiki-catalog.mjs",
"publish:catalog:local": "tsx scripts/publish-catalog-release.mjs",
"publish:catalog": "tsx scripts/publish-catalog-release.mjs"
```

- [ ] **Step 4: Run the current-wiki audit and inspect every unresolved class**

```powershell
npm run audit:wiki -- --output data/wiki-manifests/2026-08-30.json
```

For each distinct unresolved parser layout, add a minimal pinned fixture and a failing parser test, implement that layout, and rerun the audit. Stop only when every inventory page is either normalized or explicitly classified `partial`, `conflicting`, `unknown`, or `legacy` with a source-backed reason. Do not convert unresolved records to `verified` to satisfy counts.

- [ ] **Step 5: Validate the manifest and publish to an isolated local database**

```powershell
npm run check:toolchain
npm run publish:catalog:local
npm run export:fallback
npm run validate:coverage
```

Expected: release `2026.08.30.1` is the sole current local release; historical `2026.08.29.1` remains queryable; exported fallback contains no raw wiki content; all recommendation-eligible records are verified and source-linked.

- [ ] **Step 6: Run data-quality assertions against current source rows**

Run the audit’s round-trip mode, which compares every normalized numeric/name/requirement/acquisition field to the pinned source row or infobox evidence:

```powershell
npm run audit:wiki -- --verify-manifest data/wiki-manifests/2026-08-30.json
```

Expected: zero unreferenced optimizer-used fields, zero duplicate canonical IDs, zero orphan acquisitions, zero recommendation-eligible unresolved records, and explicit counts for partial/conflicting/unknown/legacy records.

- [ ] **Step 7: Commit Task 13 and checkpoint**

```powershell
git add optimizer-v2/scripts optimizer-v2/data/wiki-manifests/2026-08-30.json optimizer-v2/client/src/features/curation/fixtures optimizer-v2/client/src/data/fallback-release.json optimizer-v2/package.json
git commit -m "data: publish reviewed wiki catalog release"
```

Checkpoint evidence: summarize total pages/items, status counts, equipment-type/path coverage, mechanics exact/descriptive counts, unresolved reasons, and all known limitations. Do not call the catalog fully verified if any optimizer-used field remains unresolved.

### Task 14: Run Full Reliability, Browser, SpacetimeDB, and Historical Compatibility Gates

**Files:**
- Modify: `optimizer-v2/client/e2e/acceptance.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-flow.spec.ts`
- Modify: `optimizer-v2/client/e2e/reliability-module.spec.ts`
- Modify: `optimizer-v2/client/e2e-pages/deep-links.spec.ts`
- Modify: `optimizer-v2/ACCEPTANCE.md`
- Modify: `optimizer-v2/RELIABILITY.md`
- Modify: `optimizer-v2/README.md`

**Interfaces:**
- Acceptance covers both v1 history and v2 current release, Level-1 spend-now, ten exact rows, mobile cards, access filtering, armor/headwear/shield selection, verified upgrade comparison, and share parity.

- [ ] **Step 1: Add failing end-to-end assertions**

Add a desktop flow that creates a Level-1 melee build, enters zero stats, equips sourced starter gear, and verifies spend-now plus Levels 2–11. Add a mobile flow that asserts no horizontal page scroll and opens a level card total. Add a historical flow that loads `2026.08.29.1` unchanged. Add module assertions for version-2 child row counts and atomic rollback.

- [ ] **Step 2: Run focused E2E tests and verify any missing integration**

```powershell
cd optimizer-v2
npm run test:e2e --workspace @sbo/optimizer-client -- --grep "Level-1 spend-now|catalog release|historical release|mobile level cards"
```

Expected before final integration fixes: any failure must identify a concrete route, mapper, subscription, or responsive defect; fix one root cause at a time with its focused test.

- [ ] **Step 3: Run the complete clean reliability gate**

```powershell
npm ci
npm run check:toolchain
npm run test:reliability
npm run test:pages
npm run typecheck
git diff --exit-code -- client/src/module_bindings
```

Expected: every direct child layer exits 0; integration uses only the fixed local server/database; Pages deep links and favicon remain green; generated bindings are clean.

- [ ] **Step 4: Perform rendered browser QA**

Use the available in-app Browser workflow against the local built app. Verify page identity, meaningful DOM, no framework overlay, no relevant console error/warning, one target-flow interaction, desktop screenshot, and 390×844 screenshot. Exercise Character → Stats → Equipment → Results and confirm:

- `Available 3 · Invested 0 · Unspent 3`;
- Spend now totals exactly three;
- Levels 2–11 exist and each row/card adds exactly three;
- armor/shield/headwear controls do not clip;
- upgrade evidence and limitations are readable; and
- document scroll width equals viewport width on mobile.

- [ ] **Step 5: Update acceptance and reliability evidence**

Record exact test counts, audit counts, release version, revision date, known unresolved records, and browser results. Close the Level-1 external finding using the user’s 2026-08-30 attestation, while keeping social OAuth deferred.

- [ ] **Step 6: Commit Task 14**

```powershell
git add optimizer-v2/client/e2e optimizer-v2/client/e2e-pages optimizer-v2/ACCEPTANCE.md optimizer-v2/RELIABILITY.md optimizer-v2/README.md
git commit -m "test: verify catalog optimizer release end to end"
```

### Task 15: Publish the Verified Release and Smoke-Test Production

**Files:**
- Modify: `.github/workflows/optimizer-v2-ci.yml` only if new deterministic script layers are not already reached by `test:reliability`.
- Modify: `.github/workflows/optimizer-v2-deploy.yml` to run guarded catalog publication after the fixed-local gate and Maincloud module publish, before Pages build/deploy.
- Modify: `optimizer-v2/RELIABILITY.md` and `optimizer-v2/ACCEPTANCE.md` with final external evidence.

**Interfaces:**
- Deployment invokes `npm run publish:catalog -- --production` with existing protected SpacetimeDB login secret; the script is idempotent for `2026.08.30.1` and verifies the public release instead of duplicating it.
- Production client uses release `2026.08.30.1`, mechanics `sbor-stats-v2`, and policy `sbor-policy-v2` only after publication succeeds.

- [ ] **Step 1: Write failing workflow/script-order tests**

Extend script/workflow tests to assert order:

1. fixed-local reliability;
2. Maincloud module publish;
3. production catalog publication/verification;
4. production client build;
5. Pages artifact tests/upload/deploy.

Assert production credentials are absent from fixed-local steps.

- [ ] **Step 2: Run workflow tests and verify RED**

```powershell
cd optimizer-v2
node --test scripts/*.test.mjs
```

Expected: FAIL until the guarded catalog publication step is present in the correct scope/order.

- [ ] **Step 3: Implement workflow integration and rerun local gates**

```powershell
node --test scripts/*.test.mjs
npm run test:reliability
git status --short
```

Expected: PASS and only intended tracked files changed.

- [ ] **Step 4: Commit and push the tested head to main**

```powershell
git add .github optimizer-v2
git commit -m "ci: publish verified catalog before Pages deploy"
git push origin HEAD:main
```

- [ ] **Step 5: Wait for CI and deployment completion**

Use `gh run list --repo Literalman669/sbo-rebirth-planner` to resolve the new Optimizer V2 CI and Deploy Optimizer V2 run IDs, then `gh run watch <id> --exit-status` for each. Expected: both conclusions `success`; a failure stops production claims and is diagnosed from the failing step before another push.

- [ ] **Step 6: Perform live read-only smoke**

At `https://literalman669.github.io/sbo-rebirth-planner/`, verify release badge `2026.08.30.1`, Character → Stats → Equipment → Results, Level-1 spend-now, Levels 2–11, an armor/headwear/shield catalog search, source links, direct route refresh, missing-share state, 390×844 width, favicon HTTP 200, and zero relevant console errors/warnings in a fresh tab.

- [ ] **Step 7: Record final evidence and commit documentation**

Record final commit SHA, CI/deploy URLs, audit counts, live release badge, smoke results, and unresolved catalog limitations. Commit and push the documentation-only closeout; verify its CI/deploy runs also succeed.

```powershell
git add optimizer-v2/RELIABILITY.md optimizer-v2/ACCEPTANCE.md
git commit -m "docs: record verified catalog deployment evidence"
git push origin HEAD:main
```

## Inline execution checkpoints

- After Task 2: user-visible allocation clarity is testable independently.
- After Task 6: every computed mechanic has a source-backed parameter or an explicit unsupported state.
- After Task 9: historical and version-2 datasets coexist and round-trip.
- After Task 13: the complete current wiki audit and data-quality report are reviewable before production.
- After Task 15: production is considered complete only with successful CI, deployment, and live smoke evidence.
