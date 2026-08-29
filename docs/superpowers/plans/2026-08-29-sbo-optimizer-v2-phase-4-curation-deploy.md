# SBO:Rebirth Optimizer V2 Phase 4 Curation and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the private wiki-review pipeline, atomic verified-data releases, production fallback export, SpacetimeAuth/Maincloud configuration, and guarded GitHub Pages deployment.

**Architecture:** SpacetimeDB procedures fetch canonical MediaWiki source into private candidates, client-side pure parsers create reviewable proposals, and curator-only reducers assemble typed release drafts. A single transactional publish reducer validates and copies a draft into immutable public release tables; deployment publishes the module before the static client.

**Tech Stack:** SpacetimeDB 2.8.3 procedures, scheduled tables, reducers and views; Fandom MediaWiki API; React curator workspace; Node export/coverage scripts; GitHub Actions, Maincloud, SpacetimeAuth, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-29-sbo-rebirth-optimizer-v2-design.md`

## Global Constraints

- Complete Phase 1–3 completion gates first.
- The canonical content host is `swordbloxonlinerebirth.fandom.com`; ordinary clients never fetch wiki pages.
- Wiki extraction creates private candidates only; no automated path may publish production data.
- Only the module owner can grant or revoke curator roles.
- Owner-managed curators may review and publish; every decision remains in the private audit trail.
- Public releases are immutable, typed, versioned, and atomically switched.
- Keep historical releases readable while any public share references them.
- Every public equipment/formula row must have canonical provenance and review metadata.
- Production auth mode must be `production`; deployment fails closed for `locked` or `development`.
- Maincloud publication and SpacetimeAuth dashboard configuration are external actions and require user confirmation at execution time.
- Never use `--delete-data` against Maincloud in this plan.

## File Structure

```text
optimizer-v2/
├── spacetime.production.json
├── spacetimedb/src/
│   ├── schema.ts
│   ├── curationAuth.ts
│   ├── curationReducers.ts
│   ├── curationViews.ts
│   ├── wikiProcedures.ts
│   ├── releaseValidation.ts
│   └── index.ts
├── client/src/
│   ├── features/curation/CurationScreen.tsx
│   ├── features/curation/CandidateReview.tsx
│   ├── features/curation/ReleaseDraftEditor.tsx
│   ├── features/curation/PublishReleasePanel.tsx
│   ├── features/curation/wikiTableParser.ts
│   ├── features/curation/wikiTableParser.test.ts
│   ├── features/curation/fixtures/
│   ├── infrastructure/spacetime/datasetMapper.ts
│   ├── infrastructure/storage/datasetCache.ts
│   └── data/fallback-release.json
├── scripts/
│   ├── export-fallback-release.mjs
│   ├── validate-release-coverage.mjs
│   └── verify-production-config.mjs
└── .github/workflows/
    └── optimizer-v2-deploy.yml
```

---

### Task 1: Add curator roles and typed release staging

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Create: `optimizer-v2/spacetimedb/src/curationAuth.ts`
- Create: `optimizer-v2/spacetimedb/src/curationViews.ts`
- Create: `optimizer-v2/spacetimedb/src/curationReducers.ts`
- Create: `optimizer-v2/spacetimedb/src/releaseValidation.ts`
- Create: `optimizer-v2/spacetimedb/src/releaseValidation.test.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Regenerate: `optimizer-v2/client/src/module_bindings/`

**Interfaces:**
- Consumes: Module-owner identity from `app_config` and signed-in application identities.
- Produces: owner-managed roles, private candidates/reviews/drafts, public equipment/formula/source tables, and curator-only views/reducers.

- [ ] **Step 1: Write failing role and release-invariant tests**

Test pure validation for duplicate item IDs, missing source references, invalid floors, negative stats, missing required formulas, multiple current releases, and missing weapon-path coverage. Extend local integration tests to prove only the owner can grant/revoke and only owner/curator identities can mutate drafts.

- [ ] **Step 2: Define the private curation tables**

Add:

```ts
export const curatorRole = table({ name: 'curator_role' }, {
  identity: t.identity().primaryKey(),
  grantedBy: t.identity(),
  grantedAt: t.timestamp(),
});

export const wikiSourceState = table({ name: 'wiki_source_state' }, {
  pageTitle: t.string().primaryKey(),
  lastRevisionId: t.string(),
  lastCheckedAt: t.timestamp(),
});

export const wikiCandidate = table({
  name: 'wiki_candidate',
  indexes: [{ name: 'wiki_candidate_status', algorithm: 'btree', columns: ['status'] }],
}, {
  id: t.string().primaryKey(),
  pageTitle: t.string(),
  sourceUrl: t.string(),
  revisionId: t.string(),
  revisionTimestamp: t.string(),
  content: t.string(),
  status: t.string(),
  createdAt: t.timestamp(),
});

export const reviewDecision = table({
  name: 'review_decision',
  indexes: [{ name: 'review_decision_candidate_id', algorithm: 'btree', columns: ['candidateId'] }],
}, {
  id: t.string().primaryKey(),
  candidateId: t.string(),
  curator: t.identity(),
  decision: t.string(),
  note: t.string(),
  createdAt: t.timestamp(),
});

export const releaseDraft = table({ name: 'release_draft' }, {
  version: t.string().primaryKey(),
  createdBy: t.identity(),
  formulaSetVersion: t.string(),
  sourceSummary: t.string(),
  lastReviewedAt: t.string(),
  status: t.string(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
});
```

Add typed draft tables with these exact columns and a `releaseVersion` B-tree index on each:

```ts
export const draftEquipment = table({ name: 'draft_equipment', indexes: [{ name: 'draft_equipment_release_version', algorithm: 'btree', columns: ['releaseVersion'] }] }, {
  id: t.string().primaryKey(), releaseVersion: t.string(), itemId: t.string(), name: t.string(),
  slot: t.string(), weaponPaths: t.string(), attack: t.f64(), defense: t.f64(), dexterity: t.f64(),
  levelRequirement: t.u32(), skillRequirement: t.u32().optional(), floor: t.u32(),
  acquisitionType: t.string(), acquisitionDetail: t.string(), availability: t.string(),
  sourceRefId: t.string(), lastReviewedAt: t.string(), candidateId: t.string(),
});

export const draftFormula = table({ name: 'draft_formula', indexes: [{ name: 'draft_formula_release_version', algorithm: 'btree', columns: ['releaseVersion'] }] }, {
  id: t.string().primaryKey(), releaseVersion: t.string(), formulaId: t.string(), expression: t.string(),
  units: t.string(), applicability: t.string(), boundaryBehavior: t.string(),
  sourceRefId: t.string(), lastReviewedAt: t.string(), candidateId: t.string(),
});

export const draftSourceReference = table({ name: 'draft_source_reference', indexes: [{ name: 'draft_source_reference_release_version', algorithm: 'btree', columns: ['releaseVersion'] }] }, {
  id: t.string().primaryKey(), releaseVersion: t.string(), entityKind: t.string(), entityId: t.string(),
  sourceUrl: t.string(), sourceRevision: t.string(), capturedAt: t.string(),
  lastReviewedAt: t.string(), candidateId: t.string(),
});
```

- [ ] **Step 3: Define immutable public release tables**

Reuse the Phase 1 `dataset_release` table unchanged, including `lastReviewedAt`. Add:

```ts
export const equipment = table({
  name: 'equipment', public: true,
  indexes: [{ name: 'equipment_release_version', algorithm: 'btree', columns: ['releaseVersion'] }],
}, {
  id: t.string().primaryKey(),
  releaseVersion: t.string(),
  itemId: t.string(),
  name: t.string(),
  slot: t.string(),
  weaponPaths: t.string(),
  attack: t.f64(), defense: t.f64(), dexterity: t.f64(),
  levelRequirement: t.u32(),
  skillRequirement: t.u32().optional(),
  floor: t.u32(),
  acquisitionType: t.string(),
  acquisitionDetail: t.string(),
  availability: t.string(),
  sourceRefId: t.string(),
  lastReviewedAt: t.string(),
});

export const formula = table({
  name: 'formula', public: true,
  indexes: [{ name: 'formula_release_version', algorithm: 'btree', columns: ['releaseVersion'] }],
}, {
  id: t.string().primaryKey(),
  releaseVersion: t.string(),
  formulaId: t.string(),
  expression: t.string(),
  units: t.string(),
  applicability: t.string(),
  boundaryBehavior: t.string(),
  sourceRefId: t.string(),
  lastReviewedAt: t.string(),
});

export const sourceReference = table({
  name: 'source_reference', public: true,
  indexes: [{ name: 'source_reference_release_version', algorithm: 'btree', columns: ['releaseVersion'] }],
}, {
  id: t.string().primaryKey(),
  releaseVersion: t.string(),
  entityKind: t.string(),
  entityId: t.string(),
  sourceUrl: t.string(),
  sourceRevision: t.string(),
  capturedAt: t.string(),
  lastReviewedAt: t.string(),
});
```

Encode `weaponPaths` and other small string lists as comma-separated canonical enum values with server-side parser/validator helpers; never accept arbitrary JSON in production tables.

- [ ] **Step 4: Implement owner and curator authorization**

```ts
export function assertCurator(ctx: AppReducerCtx): void {
  if (ctx.db.appConfig.ownerIdentity.find(ctx.sender)) return;
  if (!ctx.db.curatorRole.identity.find(ctx.sender)) throw new SenderError('Curator authorization required');
}
```

Export owner-only `grantCurator({ identity })` and `revokeCurator({ identity })`. Reject granting the owner as a duplicate role. Deleting a curator role does not delete their prior review records.

- [ ] **Step 5: Implement draft mutation reducers**

Export `createReleaseDraft`, `upsertDraftEquipment`, `removeDraftEquipment`, `upsertDraftFormula`, `upsertDraftSourceReference`, and `recordReviewDecision`. Every reducer calls `assertCurator`, validates enum/range/length constraints, and rejects edits once draft status is `published`.

- [ ] **Step 6: Implement private identity-aware curation views**

Expose `my_curator_access` as a small view indicating `owner`, `curator`, or no access. Expose candidates, reviews, and drafts only through views that return rows when `ctx.sender` is owner/curator and otherwise return an empty result. Use indexed access or query-builder views; do not expose staging tables publicly.

- [ ] **Step 7: Run role, privacy, and draft tests**

Run:

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-module -- releaseValidation.test.ts
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run test:integration
```

Expected: all role, privacy, and draft mutation tests PASS.

- [ ] **Step 8: Commit the curation schema**

```powershell
git diff --check
git add optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings optimizer-v2/package-lock.json
git commit -m "feat: add private dataset curation schema"
```

---

### Task 2: Fetch canonical wiki revisions into private candidates

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Create: `optimizer-v2/spacetimedb/src/wikiProcedures.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Create: `optimizer-v2/client/src/features/curation/wikiTableParser.ts`
- Create: `optimizer-v2/client/src/features/curation/wikiTableParser.test.ts`
- Create: `optimizer-v2/client/src/features/curation/fixtures/stats.wikitext`
- Create: `optimizer-v2/client/src/features/curation/fixtures/dagger.wikitext`
- Create: `optimizer-v2/client/src/features/curation/fixtures/armor.wikitext`
- Regenerate: `optimizer-v2/client/src/module_bindings/`

**Interfaces:**
- Consumes: Canonical page titles and MediaWiki revision API responses.
- Produces: `fetchWikiCandidate`, scheduled source checks, and pure proposal parsers.

- [ ] **Step 1: Capture minimal canonical parser fixtures**

Use the MediaWiki API to capture only the table/header fragments needed to test `Stats`, `Dagger`, and `Armor`. Keep each fixture under 20 KB and record its page title and revision ID in a comment. Do not copy complete articles into the repository.

- [ ] **Step 2: Write failing parser tests**

Tests must assert:

- Stats produces formula proposals for STR damage, DEF reduction, VIT bonus HP, stamina, AGI walk/sprint, LUK crit/drop, and three-points-per-level only when the source contains that rule.
- Dagger produces Iron Dagger with skill 1, attack 2.5, and starter acquisition.
- Armor produces Beginner Armor with level 1, defense 0.5, dexterity 3, and starter/shop acquisition.
- malformed or ambiguous rows become parser warnings and never production rows.

- [ ] **Step 3: Implement narrow page parsers**

```ts
export interface ParsedProposal<T> {
  value: T;
  sourceLine: string;
  warnings: string[];
}

export function parseWeaponListPage(pageTitle: string, wikitext: string): ParsedProposal<EquipmentRecord>[];
export function parseArmorListPage(wikitext: string): ParsedProposal<EquipmentRecord>[];
export function parseShieldListPage(wikitext: string): ParsedProposal<EquipmentRecord>[];
export function parseHeadwearListPage(slot: 'upper-head' | 'lower-head', wikitext: string): ParsedProposal<EquipmentRecord>[];
export function parseStatsPage(wikitext: string): ParsedProposal<FormulaRecord>[];
```

Parsers recognize only expected table headers and numeric formats. Unknown templates, ranges, or scaling values produce warnings for human review instead of guessed numbers.

- [ ] **Step 4: Define the canonical page allowlist and schedule table**

Allow exactly:

```ts
export const ALLOWED_WIKI_PAGES = new Set([
  'Stats', 'One-Handed', 'Two-Handed', 'Rapier', 'Dagger', 'Melee',
  'Armor', 'Shields', 'Upper Headwear', 'Lower Headwear',
  'Gamepass and Badge Equipment', 'Bestiary',
]);
```

Add private `wiki_check_job(scheduledId, scheduledAt, pageTitle)` and bind it to a scheduled procedure using the 2.8.3 `onSchedule` API.

- [ ] **Step 5: Implement the curator-authorized fetch procedure**

Build only this endpoint, URL-encoding the allowlisted title:

```text
https://swordbloxonlinerebirth.fandom.com/api.php?action=query&prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=2&titles=<ENCODED_TITLE>
```

The procedure must:

1. open a short transaction and call `assertCurator`;
2. perform the HTTP GET outside a transaction;
3. require a successful response under 2 MB;
4. parse exactly one page, revision ID, timestamp, and main-slot content;
5. open a transaction, skip unchanged revision IDs, and insert a pending candidate;
6. return the candidate ID.

Scheduled execution may authenticate as `ctx.senderAuth.isInternal`; it can stage candidates but cannot review or publish them.

- [ ] **Step 6: Run parser and procedure integration tests**

Use a local fixture HTTP server for procedure tests so CI never depends on Fandom availability. Assert allowlist rejection, response-size rejection, unchanged-revision deduplication, and pending-only insertion.

- [ ] **Step 7: Commit canonical wiki staging**

```powershell
git diff --check
git add optimizer-v2/spacetimedb optimizer-v2/client/src/features/curation optimizer-v2/client/src/module_bindings optimizer-v2/package-lock.json
git commit -m "feat: stage canonical wiki changes for review"
```

---

### Task 3: Publish validated releases atomically and build the curator workspace

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/curationReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/releaseValidation.ts`
- Create: `optimizer-v2/client/src/features/curation/CurationScreen.tsx`
- Create: `optimizer-v2/client/src/features/curation/CandidateReview.tsx`
- Create: `optimizer-v2/client/src/features/curation/ReleaseDraftEditor.tsx`
- Create: `optimizer-v2/client/src/features/curation/PublishReleasePanel.tsx`
- Create: `optimizer-v2/client/src/features/curation/curationFlow.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`

**Interfaces:**
- Consumes: Private candidates, parser proposals, draft rows, and curator identity.
- Produces: `publishRelease({ version })` and protected `/curation` workflow.

- [ ] **Step 1: Write failing atomic-publication tests**

Prove that an invalid draft changes no public row, a valid publish creates an immutable release, the prior current release flips to false, all new rows become visible in one transaction, duplicate version publishing fails, and non-curators cannot call the reducer.

- [ ] **Step 2: Implement complete release validation**

Required formula IDs:

```ts
export const REQUIRED_FORMULA_IDS = [
  'points-per-level', 'attack-from-str', 'damage-reduction-from-def',
  'bonus-hp-from-vit', 'stamina', 'walk-speed-from-agi',
  'sprint-speed-from-agi', 'crit-bonus-from-luk', 'drop-bonus-from-luk',
] as const;
```

Validation requires version format `/^\d{4}\.\d{2}\.\d{2}\.\d+$/`, all six optimizer paths covered, every source URL on the canonical HTTPS host, every public row linked to a draft source reference, no candidate-status record, legal slots/enums/ranges, and exactly one proposed current release.

The draft must use `formulaSetVersion === 'sbor-stats-v1'`; a different version requires a client implementation change and a new reviewed plan before publication.

- [ ] **Step 3: Implement `publishRelease`**

Inside one reducer transaction:

1. call `assertCurator`;
2. load the draft and typed children;
3. run all validations before the first public write;
4. mark prior current release rows false;
5. insert immutable public source, formula, and equipment rows using primary IDs `${version}:${entityId}`;
6. insert the new `dataset_release` row as current with the draft's `lastReviewedAt`;
7. mark the draft `published`;
8. leave candidates/reviews private for audit.

- [ ] **Step 4: Write failing curator-route tests**

Ordinary signed-in users must receive a not-found route, curators see pending candidates and warnings, proposal acceptance writes draft rows, rejection requires a note, publish remains disabled until validation passes, and successful publication returns to a release summary.

- [ ] **Step 5: Implement the protected curator workspace**

Use generated private views and reducers. Display source revision, source URL, captured fragment, current production value, parsed proposal, warnings, and decision controls side by side. Do not render raw HTML from wikitext. Owner role management appears in a separate collapsed section visible only when `my_curator_access === 'owner'`.

- [ ] **Step 6: Run publication and curator UI tests**

Run:

```powershell
cd optimizer-v2
npm run test:unit
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run test:integration
```

Expected: all validation, atomicity, role, and UI tests PASS.

- [ ] **Step 7: Commit reviewed release publishing**

```powershell
git diff --check
git add optimizer-v2/spacetimedb optimizer-v2/client optimizer-v2/package-lock.json
git commit -m "feat: review and publish verified datasets"
```

---

### Task 4: Seed the first production-quality release and export its fallback

**Files:**
- Create: `optimizer-v2/scripts/validate-release-coverage.mjs`
- Create: `optimizer-v2/scripts/export-fallback-release.mjs`
- Modify: `optimizer-v2/client/src/data/fallback-release.json`
- Modify: `optimizer-v2/client/src/infrastructure/spacetime/PublicDataProvider.tsx`
- Create: `optimizer-v2/client/src/infrastructure/spacetime/datasetMapper.ts`
- Create: `optimizer-v2/client/src/infrastructure/spacetime/datasetMapper.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/datasetCache.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/datasetCache.test.ts`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Create: `optimizer-v2/client/src/data/fallbackRelease.test.ts`
- Modify: `optimizer-v2/package.json`

**Interfaces:**
- Consumes: A published, current local dataset release.
- Produces: validated `fallback-release.json` and coverage reports for six paths and progression bands.

- [ ] **Step 1: Implement coverage validation before importing data**

`validate-release-coverage.mjs` accepts exported release JSON and fails unless:

- every required formula exists;
- all six optimizer paths have a usable starter/current item model;
- One-Handed data can support Dual Wield with the documented 200-skill gate;
- armor and applicable shield data exist;
- every row is verified and canonically sourced;
- each progression band `1–49`, `50–99`, `100–149`, `150–199`, `200–249`, `250–299`, `300+` has at least one verified weapon upgrade for each applicable path, or an explicit reviewed `knownGap` source record;
- no inactive event item is counted as obtainable coverage.

- [ ] **Step 2: Stage current wiki pages and review the initial release**

Fetch all allowlisted class, armor, shield, headwear, and stats pages through the procedure. Treat legacy `sbo-rebirth-planner/data/wiki-raw/` and `data.js` only as candidate comparison material; no legacy row becomes public without a canonical current source and curator decision.

Create release version `2026.08.29.1`, resolve every parser warning, run draft validation, inspect the coverage report, and publish locally. If current wiki content has real progression gaps, add reviewed `knownGap` records rather than estimates.

- [ ] **Step 3: Implement deterministic fallback export**

`export-fallback-release.mjs` connects read-only to the configured database, subscribes to the current release plus its public equipment/formula/source rows, sorts rows by stable IDs, validates with `datasetSnapshotSchema`, and writes formatted JSON ending in one newline. It refuses to export when zero or multiple current releases exist.

Add root scripts:

```json
"validate:coverage": "node scripts/validate-release-coverage.mjs client/src/data/fallback-release.json",
"export:fallback": "node scripts/export-fallback-release.mjs"
```

- [ ] **Step 4: Replace the hard-coded bootstrap with fallback JSON**

Parse `fallback-release.json` at startup. Implement this cache interface over the existing IndexedDB database with a new `dataset-releases` store:

```ts
export interface DatasetCache {
  put(snapshot: DatasetSnapshot): Promise<void>;
  get(version: string): Promise<DatasetSnapshot | null>;
  getLatest(): Promise<DatasetSnapshot | null>;
  pruneExcept(versionsToKeep: ReadonlySet<string>): Promise<void>;
}
```

Live data wins only when its published version is newer; cached live data wins over bundled fallback when valid. Keep the current release and every historical release referenced by a locally saved/shared build. Display source state `live`, `cached`, or `bundled` with the exact version and `lastReviewedAt`.

Implement `mapPublishedRelease(releaseRow, equipmentRows, formulaRows, sourceRows): DatasetSnapshot`. It must filter every child collection by `release.version`, split comma-separated `weaponPaths` into validated enum arrays, resolve each `sourceRefId`, reject orphaned or duplicate rows, parse the finished object with `datasetSnapshotSchema`, and return no partial snapshot. `PublicDataProvider` subscribes to all four public tables, maps only after all subscriptions are ready, writes a valid live snapshot to `DatasetCache`, and otherwise continues using cached/bundled data with a visible connection warning.

Add `isPlanStale(planVersion, currentVersion)` and render a Results banner with `Recalculate with dataset <version>` when they differ. Recalculation replaces the displayed plan but never mutates a saved revision until the player saves.

- [ ] **Step 5: Test deterministic export, caching, staleness, and optimizer coverage**

Run export twice and assert byte-identical output. Test corrupted-cache isolation, live/cached/bundled priority, historical-release retention, and stale-plan recalculation. For every weapon path and representative levels `1, 50, 100, 150, 200, 250, 300`, construct a valid profile and assert `optimizeBuild` returns a plan without unverified or inactive-event targets.

- [ ] **Step 6: Commit the first verified fallback release**

```powershell
git diff --check
git add optimizer-v2/scripts optimizer-v2/client/src/data optimizer-v2/client/src/infrastructure optimizer-v2/package.json optimizer-v2/package-lock.json
git commit -m "data: publish first verified optimizer release"
```

---

### Task 5: Configure guarded Maincloud, SpacetimeAuth, and GitHub Pages deployment

**Files:**
- Create: `optimizer-v2/spacetime.production.json`
- Create: `optimizer-v2/scripts/verify-production-config.mjs`
- Create: `.github/workflows/optimizer-v2-deploy.yml`
- Modify: `optimizer-v2/README.md`

**Interfaces:**
- Consumes: GitHub secret `SPACETIMEDB_LOGIN_TOKEN` and variable `SPACETIMEAUTH_CLIENT_ID`.
- Produces: Maincloud database `sbo-rebirth-optimizer-v2` and GitHub Pages client at `https://literalman669.github.io/sbo-rebirth-planner/`.

- [ ] **Step 1: Add checked-in production routing without credentials**

```json
// optimizer-v2/spacetime.production.json
{
  "database": "sbo-rebirth-optimizer-v2",
  "server": "maincloud"
}
```

`verify-production-config.mjs` fails unless CLI version is 2.8.3, database/server match exactly, `SPACETIMEAUTH_CLIENT_ID` begins with `client_`, the client build uses `https://maincloud.spacetimedb.com`, auth mode queried from Maincloud is `production`, and current release coverage passes.

- [ ] **Step 2: Pause for user-confirmed external setup**

At execution time, ask the user to confirm before these external actions:

1. `spacetime login` in the browser;
2. initial Maincloud publish of `sbo-rebirth-optimizer-v2`;
3. enabling SpacetimeAuth in the database dashboard;
4. configuring the public web client with redirect URI `https://literalman669.github.io/sbo-rebirth-planner/auth/callback` and post-logout URI `https://literalman669.github.io/sbo-rebirth-planner/`;
5. adding local redirect URI `http://localhost:5173/auth/callback` for development;
6. enabling the user's chosen SpacetimeAuth identity providers;
7. creating GitHub secret `SPACETIMEDB_LOGIN_TOKEN` and variable `SPACETIMEAUTH_CLIENT_ID`.

No implementation agent may invent the client ID or print the login token.

- [ ] **Step 3: Publish the module and lock production auth**

After confirmation and login:

```powershell
cd optimizer-v2
spacetime publish sbo-rebirth-optimizer-v2 --server maincloud --module-path ./spacetimedb
```

Call owner-only `configure_auth` with mode `production`, issuer `https://auth.spacetimedb.com/oidc`, and the actual dashboard client ID. Query `auth_config` as owner and verify mode/audience before serving the client. Never pass `--delete-data`.

- [ ] **Step 4: Create the two-stage deployment workflow**

`optimizer-v2-deploy.yml` runs only on `workflow_dispatch` until the first production verification succeeds. It must:

1. check out the repository;
2. install Node 22 and SpacetimeDB 2.8.3, adding `$HOME/.local/bin` to `$GITHUB_PATH` before invoking the CLI;
3. run `npm ci`, unit tests, typecheck, module build, binding generation/diff, integration tests, coverage validation, and client build;
4. authenticate CLI with `spacetime login --token "${{ secrets.SPACETIMEDB_LOGIN_TOKEN }}" --no-browser`;
5. publish the Maincloud module without deletion flags;
6. run production-config verification;
7. build the client with Maincloud URI, production database name, and `${{ vars.SPACETIMEAUTH_CLIENT_ID }}`;
8. upload only `optimizer-v2/client/dist` as the Pages artifact;
9. deploy Pages after the module and configuration gates pass.

- [ ] **Step 5: Run production smoke checks**

Verify as a guest: public dataset, full optimizer, and bundled fallback. Verify as a signed-in test account: selected import, cloud save, second-device sync, history, and sharing. Verify as owner/curator: candidate fetch and draft validation without publishing a second release. Verify revoked shares and stale-plan handling.

- [ ] **Step 6: Enable automatic deployment only after smoke success**

Add `push` on `main` to the deployment workflow only after the manual run passes and branch protection requires Optimizer V2 CI. Keep `workflow_dispatch` available for controlled redeployment.

- [ ] **Step 7: Commit deployment automation**

```powershell
git diff --check
git add .github/workflows/optimizer-v2-deploy.yml optimizer-v2/spacetime.production.json optimizer-v2/scripts/verify-production-config.mjs optimizer-v2/README.md
git commit -m "ci: deploy optimizer v2 with Maincloud"
```

---

### Task 6: Run the full specification acceptance audit

**Files:**
- Create: `optimizer-v2/ACCEPTANCE.md`
- Create: `optimizer-v2/client/e2e/acceptance.spec.ts`
- Modify: `.github/workflows/optimizer-v2-ci.yml`

**Interfaces:**
- Consumes: All Phase 1–4 deliverables.
- Produces: Executable evidence for every Version 1 acceptance criterion.

- [ ] **Step 1: Map every spec criterion to an automated or manual proof**

`ACCEPTANCE.md` lists criteria 1–16 verbatim from the design spec, the exact test/command proving each, and any one-time dashboard verification. No criterion may be marked complete without linked evidence.

- [ ] **Step 2: Add the final acceptance suite**

Cover route separation, all six weapon paths, required versus optional inputs, five goals, result hierarchy, provenance, verified-only filtering, guest mode, optional sign-in, native revision rows, real-time releases, curator access, public snapshot privacy, version pinning, desktop/mobile/keyboard/reduced-motion/offline/reconnect behavior, and deployment artifact paths.

- [ ] **Step 3: Run final verification from a clean install**

Run:

```powershell
cd optimizer-v2
npm ci
npm run check:toolchain
npm run test:unit
npm run typecheck
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code -- client/src/module_bindings
npm run validate:coverage
npm run test:integration
npm run build
```

Expected: every command PASS with no generated diff and no uncommitted files.

- [ ] **Step 4: Commit acceptance evidence**

```powershell
git diff --check
git add optimizer-v2/ACCEPTANCE.md optimizer-v2/client/e2e/acceptance.spec.ts .github/workflows/optimizer-v2-ci.yml
git commit -m "test: prove optimizer v2 acceptance criteria"
```

## Phase 4 Completion Gate

Phase 4 is complete only when canonical wiki changes can be staged and reviewed privately, release publication is atomic and permission-checked, the bundled fallback is generated from a published verified release, SpacetimeDB 2.8.3 is aligned everywhere, production authentication is locked to SpacetimeAuth issuer/audience, and the Maincloud-first GitHub Pages deployment passes the complete acceptance audit.
