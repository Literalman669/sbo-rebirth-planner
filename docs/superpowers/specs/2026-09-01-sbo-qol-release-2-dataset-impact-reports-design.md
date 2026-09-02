# SBO:Rebirth Dataset Update Impact Reports Design

**Date:** 2026-09-01  
**Status:** Approved design  
**Product:** SBO:Rebirth Build Optimizer V2  
**Release:** QOL Release 2 closing feature

## 1. Purpose

Add a global verified-data update notice and a dedicated review workspace that
explains how a newly published dataset affects each player-owned build. Reports
must show changed verified facts before changed recommendations, preserve every
historical build until the player explicitly updates it, and remain usable for
guests and offline players whenever the required snapshots are cached.

This feature closes the dataset-update impact-report item from the approved QOL
roadmap. It does not change the optimizer, publish new game data, or introduce
the Release 3 boss domain.

## 2. Product principles

1. **Review before recalculation.** Historical builds never silently adopt a
   newer dataset.
2. **Facts before advice.** Every plan difference must be traceable to verified
   record, formula, mechanic, or strategy-policy evidence.
3. **Explicit application.** Reviewing a report changes no build input.
4. **Dataset pin only.** Applying an update changes only `datasetVersion`.
5. **Recoverable history.** Every applied update produces durable revision
   history; an unsaved active draft receives a pre-update recovery revision.
6. **Local-first derivation.** Reports are deterministic client-side products,
   not opaque server-generated blobs.
7. **Private review state.** Review receipts never enter public shares or
   portable build files.
8. **Unknown stays unknown.** Missing endpoints, releases, sources, or fields
   remain visible and never receive guessed substitutes.

## 3. Scope

### Included

- A global notice for unreviewed dataset impacts.
- A dedicated `/updates` workspace.
- Active draft, local/cloud saved builds, and personal presets.
- Local/cloud mirror deduplication.
- Direct pinned-to-current summaries.
- Expandable release-by-release detail.
- Verified equipment, acquisition, formula, mechanic, source, and strategy
  policy differences relevant to each build.
- Before/after recommendation, stat-plan, warning, eligibility, and shopping
  differences.
- Explicit Keep pinned, pinned planner, current preview, and Update actions.
- Versioned local review receipts and optional private cloud synchronization.
- Recoverable local/cloud revision creation when applying.
- Prior-schema migration, offline recovery, accessibility, stress, Pages, CI,
  deployment, and live-smoke coverage.

### Excluded

- Automatic mass updates.
- Applying recommended stats or equipment from the report.
- Public progress or public impact-report sharing.
- Exporting private review receipts.
- Catalog-wide raw diffs by default.
- Comparing draft/unpublished curator releases.
- New boss, farming, drop, or skill-unlock recommendations.
- In-game telemetry or Roblox account access.

## 4. Affected builds and notice rules

The candidate selector consumes the existing unified build library and current
active draft. It includes:

- The active draft.
- Normal saved builds.
- Private personal presets.
- Archived player-owned builds, labeled as archived.

Local/cloud mirrors with the same build ID appear once. Curated bundled presets
are excluded because they have no player-owned history until applied as a new
draft. Invalid or quarantined records remain in their existing recovery flows
and do not enter impact calculations.

A build is outdated when its `datasetVersion` differs from the current
published release. It is unreviewed when no current receipt matches all of:

- Build ID.
- Recommendation-input fingerprint.
- Pinned dataset version.
- Target dataset version.
- Deterministic report fingerprint.

The global notice displays the count of unreviewed affected builds and one
**Review changes** link. Opening a report does not acknowledge it. A report is
acknowledged only by explicit **Keep pinned** or successful **Update this
build** action. The notice disappears after every currently affected build is
acknowledged. Updating remains optional.

Editing a reviewed build invalidates the receipt through its input fingerprint.
Publishing another current release invalidates it through the target version.
Updated builds cease to be outdated because their new revision is pinned to the
current release.

## 5. Information architecture

### Global notice

The notice is an unobtrusive shell-level status, not a modal and not a planner
step. Example:

> Verified data update affects 3 builds. Review changes.

It must not delay rendering the active workspace. Loading, offline, and blocked
states use the existing actionable storage/data notices.

### `/updates` workspace

Desktop uses a list/detail layout; mobile stacks the build list above the
selected report. Query parameters identify selection without changing the
active draft:

```text
/updates?build=<id>&source=<local|cloud>
```

Each build row shows:

- Name or level-based fallback.
- Active draft, build, preset, or archived label.
- Local, cloud, or mirrored source.
- Level, floor, path, and goal.
- Pinned and target dataset versions.
- Unreviewed, Reviewed and pinned, Updated, or Blocked status.
- Compact counts for fact and plan changes when available.

Missing or stale query selections fall back to the first unreviewed candidate
and retain a visible explanation. Selecting a build never calls draft-replace
or optimizer-input mutation APIs.

## 6. Hybrid local-first architecture

The report pipeline is deterministic TypeScript in the client:

```text
Unified build candidate
        |
        v
Resolve exact pinned/current snapshots + release index
        |
        +--> diffDatasetFacts
        |
        +--> optimize unchanged profile against each endpoint
                  |
                  v
          diffRecommendationPlans
        |
        v
buildDatasetImpactReport + stable fingerprint
        |
        +--> render report
        +--> explicit review receipt
        +--> explicit revision application
```

SpacetimeDB owns current/public release metadata and optional private receipt
synchronization. It does not compute or persist full impact reports. Build
revisions continue through the existing local/cloud revision infrastructure.

### Dataset release index

Dataset resolution gains a bounded release index containing published version,
publication timestamp, review date, formula-set version, and availability. It
contains only immutable published releases. Release ordering uses publication
metadata, never lexical version comparison.

The index supports:

- Exact endpoint resolution.
- Identification of intermediate releases.
- Visible gaps when an intermediate snapshot is unavailable.
- Offline use from validated cached releases.

It never exposes private release drafts or curator candidates.

## 7. Domain boundaries

### `datasetImpactCandidates`

Finds outdated player-owned profiles, deduplicates mirrors, resolves source
labels, joins review receipts, and returns stable ordering. It does not resolve
snapshots or run the optimizer.

### `diffDatasetFacts`

Compares two validated `DatasetSnapshot` values and emits typed fact changes:

- Entity added, removed, or changed.
- Field before/after values.
- Verification/provenance before/after.
- Relevance reason for the selected build.
- Intermediate release in which the change first appears when available.

It knows dataset records but not recommendation output.

### `diffRecommendationPlans`

Compares two independently generated deterministic plans for otherwise
identical profiles. It emits typed changes for immediate action, current
unspent allocation, future level rows, upgrades, shopping totals, warnings,
requirements, eligibility notes, and precision. It never invents a causal
explanation; causality is supplied only by matching fact dependencies.

### `buildDatasetImpactReport`

Combines endpoint metadata, fact changes, plan changes, trail detail, unknowns,
and a canonical report fingerprint. It produces no storage or UI side effects.

### Review receipt boundary

Receipts acknowledge one report state. They are not build state, optimizer
input, report cache, or revision history.

## 8. Fact relevance and report density

The default report includes changed facts that can affect this build:

1. Equipped items.
2. Owned items.
3. Items recommended at either endpoint.
4. Changed items eligible at either endpoint for the build's weapon path,
   slots, level, floor, and enabled access sources.
5. Formulas, mechanics, and strategy policies consumed by either plan.
6. Source or acquisition changes attached to included items.

Relevant field classes include raw stats, price/currency, requirements,
weapon-path/slot compatibility, access type, acquisition text, special effects,
resistances, verification status, source URL, source revision, and review date.

Changes unrelated to the build are not expanded by default. The report states
how many published changes were omitted as unrelated and links to release
metadata where available. This prevents recreating the legacy planner's
catalog-wide density.

Unknown or incomparable values receive explicit labels such as `Not verified in
pinned release`, `Not verified in current release`, or `Comparison unavailable`.
Zero remains a real value and is never treated as missing.

## 9. Report structure

### 9.1 Verified facts changed

Facts are grouped by equipment, acquisitions, formulas/mechanics, policies, and
sources. Each row shows before/after values, change type, relevance reason, and
exact source links. Added and removed records are visually distinct from field
edits. Text plus icons accompany color.

### 9.2 Effect on your plan

The plan section shows:

- Immediate action before and after.
- Current unspent-point allocation differences.
- Exact changed future level rows.
- Added, removed, or reordered equipment recommendations.
- Requirement and eligibility-note changes.
- Known shopping total and unknown-price count differences.
- Added or removed warnings and precision changes.
- `Plan unchanged` when facts changed without altering advice.

There is no overall score, synthetic readiness rating, or speculative causal
language.

### 9.3 Release trail

The primary report is the net pinned-to-current comparison. Intermediate
published releases appear as collapsed adjacent-release summaries. Expanding a
release shows the subset of relevant facts and plan changes introduced there.

If an intermediate snapshot is unavailable, the trail shows a gap. A valid
endpoint comparison remains usable. If either endpoint is unavailable, the net
report is blocked.

## 10. Player actions

### Keep pinned

Explicitly writes a Reviewed receipt for the current report. It does not change
the build or prevent a later update. The build remains labeled with its pinned
dataset version in Builds, Planner, Progress, and Updates.

### Open pinned planner

Opens a non-mutating historical view using the exact pinned snapshot. It never
substitutes current data.

### Open current preview

Runs the unchanged profile against the current dataset in a temporary preview.
It does not replace the active draft or save a revision.

### Update this build

The confirmation names the build and versions and states that only the dataset
pin changes. Before writing, the app re-resolves both endpoints and revalidates:

- Build input fingerprint.
- Current head revision where applicable.
- Pinned and target versions.
- Endpoint content fingerprints.
- Report fingerprint.

If any value changed, Apply stops and offers **Recalculate report**.

For a saved build or personal preset, applying creates one new revision with
the same kind and identical profile except for `datasetVersion`.

For an unsaved active draft:

1. Save the pinned draft as the initial normal-build recovery revision using
   its current ID and name/fallback.
2. Create the updated revision with only `datasetVersion` changed.
3. Replace the active draft only after the updated revision commits.

If the initial recovery save succeeds but the update fails, the newly saved
build remains pinned and recoverable. No partial updated profile is exposed.

Local build/revision/draft/receipt writes use one transaction where the current
storage boundary permits it. Cloud revision creation remains authoritative;
the Applied receipt is written or queued only after revision success. A receipt
sync failure may leave the notice visible until retry, but never rolls back or
duplicates the committed revision.

## 11. Review receipt model

```ts
interface DatasetReviewReceipt {
  schemaVersion: 1;
  buildId: string;
  inputFingerprint: string;
  pinnedDatasetVersion: string;
  targetDatasetVersion: string;
  reportFingerprint: string;
  status: 'reviewed' | 'applied';
  reviewedAt: string;
}
```

Only one current receipt is retained per build. New review state replaces older
state after strict validation. Report content is regenerated from immutable
snapshots instead of persisted.

Receipts are capped by the existing player-owned build limit. Unsafe text,
unknown keys, invalid timestamps, unsupported versions, mismatched build IDs,
and oversized payloads are rejected.

### Local persistence

IndexedDB receives an additive versioned receipt store. Reads migrate the
previous database without changing drafts, builds, revisions, inventory,
progress, preferences, pending queues, or cached releases. Corrupt receipts are
quarantined and do not block valid builds.

### Cloud persistence

SpacetimeDB receives a private sender-filtered receipt row keyed by build ID.
Protected reducers require build ownership, validate strict receipt JSON, and
use explicit `reviewedAt` ordering with canonical tie handling. The stable
pending mutation ID is `dataset-review:<buildId>`, so later offline review state
coalesces safely. Cross-identity reads and writes remain impossible.

Receipts for a purely local active draft remain local. They become cloud
eligible only after that build has been saved/enrolled. Deleting a build also
deletes its local and cloud receipt.

## 12. Privacy and portability

- Public build snapshots remain unchanged.
- Wallet, progress history, review receipts, owner identity, pending mutations,
  and cloud row metadata never enter public shares.
- Portable build/library backups continue to carry the build and its private
  plan progress where already approved, but exclude review receipts because
  they are device/account UI state derived from available releases.
- Report generation makes no network request to Roblox or player accounts.
- Source navigation uses only verified URLs stored in published snapshots.

## 13. Error and recovery behavior

- **No affected builds:** explain that owned builds already use or have reviewed
  the current verified release; provide a Builds link.
- **No active/saved builds:** offer Create Build and Build Presets actions.
- **Pinned endpoint unavailable:** block derived comparison, preserve the build,
  and show its stored facts/version.
- **Current endpoint unavailable:** retain the global notice/loading state and
  never use an unvalidated cache row.
- **Intermediate gap:** preserve endpoint comparison and label the gap.
- **Optimizer blocked on one side:** show available fact changes and the exact
  readiness blocker instead of fabricating a plan diff.
- **Storage failure:** preserve in-memory report and use existing actionable
  local-storage recovery notices.
- **Offline with cached endpoints:** allow full review and local receipt writes.
- **Offline without target snapshot:** show stored build facts and wait for
  verified target data.
- **Cloud offline:** save locally, queue the bounded receipt/revision mutation,
  and show Sync queued.
- **Concurrent build edit:** disable Apply and require recalculation.
- **New release during review:** retain the visible report, announce the newer
  target, and offer restart; never silently swap the report underneath the
  player.
- **One report failure:** isolate it to that build and continue other reports.

## 14. Component plan

Domain and orchestration units:

- `datasetImpactCandidates`
- `datasetFactDiff`
- `recommendationPlanDiff`
- `datasetImpactReport`
- `datasetReviewReceiptSchema`
- `DatasetReviewReceiptStore`
- Cloud receipt mapper/repository/queue adapter
- `useDatasetUpdates`

UI units:

- `DatasetUpdateNotice`
- `DatasetUpdatesScreen`
- `DatasetUpdateBuildList`
- `DatasetImpactSummary`
- `FactsChangedSection`
- `PlanImpactSection`
- `ReleaseTrailSection`
- `ApplyDatasetUpdateDialog`

UI components consume typed report values. They do not parse raw dataset rows,
storage rows, or cloud rows.

## 15. Performance and determinism

- Identical profile and endpoint snapshots produce byte-identical canonical
  reports and fingerprints.
- One report runs the optimizer exactly once per endpoint and memoizes by build
  input plus endpoint content fingerprints.
- Filters, sorting, disclosures, route selection, and receipt writes do not
  rerun optimization.
- Candidate discovery never optimizes every build eagerly. Compact list counts
  use bounded metadata; detailed reports are generated on selection or an idle
  prefetch budget.
- Release and equipment indexes are memoized by dataset version.
- Reports remain responsive with 250 player-owned builds and the complete
  verified catalog.
- `/updates` is route-level code-split and does not enlarge initial planner
  execution with its full report UI.

## 16. Accessibility and responsive behavior

- The global notice is an accessible status with a descriptive link, not an
  interrupting alert dialog.
- List/detail selection uses native controls or clearly labeled links.
- Fact changes use text labels in addition to color/icons.
- Tables reflow to labeled before/after cards at narrow widths.
- Collapsed release trail controls expose expanded state.
- Apply confirmation receives initial focus, traps focus, supports Escape, and
  returns focus to its trigger.
- Status announcements cover review, queued sync, revision success, conflicts,
  and failures.
- Desktop, tablet, 390 px, and 320 px layouts must not overflow horizontally.
- Reduced motion and zoom behavior follow existing global standards.

## 17. Verification strategy

### Domain and schema

- Deterministic candidate ordering and mirror deduplication.
- Receipt matching/invalidation and strict migration.
- Added, removed, changed, zero, missing, and unknown facts.
- Eligibility relevance across path, slot, level, floor, and access settings.
- Exact provenance and unavailable-source behavior.
- Direct and intermediate release ordering from publication metadata.
- Plan unchanged and each supported plan-difference category.
- Canonical report fingerprints and no input mutation.
- UI-only actions preserve recommendation fingerprints.

### Persistence and cloud

- Database migration preserves every existing store and record.
- Receipt quarantine, deletion, and build-deletion cascade.
- Offline queue coalescing, reconnect, identical retry, and failed retry.
- Same-account convergence and cross-identity rejection.
- Public shares and portable files contain no receipts.
- Active unsaved draft receives pinned and updated revisions in order.
- Applying saved builds and presets retains their kind and all non-dataset
  profile fields.
- Concurrent edit/release conflicts stop before mutation.

### Rendered flows

- Global notice count and disappearance after explicit review.
- Active, saved, mirrored, preset, archived, blocked, empty, loading, offline,
  and stale-query states.
- Facts-first ordering, exact sources, plan diffs, trail gaps, previews, Keep
  pinned, and Apply confirmation.
- Reload persistence without draft replacement.
- Keyboard/focus, axe, zoom, reduced motion, and containment at 1440x1000,
  768x1024, 390x844, and 320x700.
- Stress with 250 builds and the complete verified dataset.
- GitHub Pages direct `/updates?build=proof-build&source=local` recovery.
- Full fixed-local reliability, generated-binding cleanliness, deployment, and
  read-only/disposable live smoke.

## 18. Acceptance criteria

1. A global notice counts every unreviewed affected player-owned build exactly
   once.
2. Reports resolve exact pinned/current endpoints and never substitute data.
3. Verified fact changes appear before recommendation changes with exact source
   evidence and explicit unknowns.
4. Net and intermediate-release views agree deterministically.
5. Reviewing alone never changes build inputs or optimizer output.
6. Keep pinned hides only the matching report state.
7. Applying creates recoverable revision history and changes only
   `datasetVersion`.
8. An unsaved active draft gains a pinned recovery revision before its updated
   revision.
9. Local/cloud receipts are private, bounded, retryable, and identity-scoped.
10. Existing public shares, portable files, drafts, builds, inventory, progress,
    and revisions migrate without silent loss.
11. The complete feature is keyboard/touch usable and width-safe from 320 px
    upward with zero serious/critical accessibility violations.
12. The final merged tree passes unit, typecheck, coverage, module build,
    integration, stress, Pages, CI, deployment, and live smoke.

## 19. Implementation boundary

Implementation receives its own test-first plan. The plan must sequence pure
diff/report contracts before persistence, cloud receipt synchronization, UI,
application workflow, and release verification. It must not bundle Release 3
boss data or unrelated refactoring into this feature.
