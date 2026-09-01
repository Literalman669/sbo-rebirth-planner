# SBO:Rebirth QOL Release 2 Build Power Tools Design

**Date:** 2026-09-01  
**Status:** Approved design, pending implementation plan  
**Product:** SBO:Rebirth Build Optimizer V2  
**Release:** QOL Release 2 — Build Power Tools

## 1. Purpose

Complete the saved-build portion of QOL Release 2 without turning the Builds
workspace into another crowded planner sheet. Players should be able to compare
two builds, start from a safe preset, duplicate or archive alternatives, and
move their build library between devices without losing history or weakening
the optimizer's verified-data guarantees.

The existing guided Planner, dedicated Builds workspace, local-first storage,
optional SpacetimeDB synchronization, immutable revision history, and
owner-free public snapshots remain the foundation. This batch extends those
systems; it does not replace them.

## 2. Approved product decisions

1. Build comparison supports exactly two builds at a time. This is the clearest
   useful comparison on desktop and remains understandable when stacked on
   mobile.
2. Curated presets and personal presets both exist, but they are visually and
   semantically separated.
3. Imports create duplicates by default. Overwrite is an explicit,
   confirmation-gated recovery action.
4. Comparison is read-only. It does not mutate builds, create revisions, or
   change the active draft.
5. Recalculating a comparison against the current dataset is a temporary
   preview until the player explicitly creates or saves a new build from it.
6. Private identity, authentication, sharing, and synchronization metadata are
   never included in portable build files.
7. New capabilities use dedicated routed surfaces and focused dialogs rather
   than expanding the existing Builds screen into one dense page.

## 3. Information architecture

### `/builds`

The existing build library remains the entry point. It gains:

- Search and existing sort/filter controls.
- `Compare` selection actions on eligible build cards.
- `Use as preset` or `Save as personal preset` actions where appropriate.
- `Export` for an individual record.
- `Import builds` and `Back up library` entry points.
- A compact subnavigation for Library, Compare, and Presets.

The current load, rename, duplicate, archive, delete, history, share, and cloud
actions remain available. New actions must not displace the primary `Load`
action or make destructive controls easier to trigger accidentally.

### `/builds/compare`

A dedicated two-build comparison workspace. The previously documented
`/compare/builds` route, if exposed by an older link or bookmark, redirects to
this canonical nested route.

The selection can be represented in the query string so a refresh preserves
the local comparison. Query parameters contain record identifiers only; they
do not make a private build publicly accessible and are never treated as a
share mechanism.

### `/builds/presets`

A dedicated preset browser with two clearly labeled sections:

- **Verified curated starts**
- **Your personal presets**

Curated and personal entries use the same preview language where possible, but
their provenance and application behavior remain explicit.

### Focused dialogs

Import preview, export options, backup scope, and overwrite confirmation are
dialogs launched from the Builds workspace. They are bounded tasks, not new
dashboard pages. Dialogs preserve focus, announce completion or failure, and
return focus to their launcher.

## 4. Build comparison behavior

### Selection

- A player chooses two distinct available saved builds.
- Local and cloud records can be compared together.
- Duplicate local/cloud representations of the same logical build are
  resolved before selection so the player does not compare a record with its
  mirror accidentally.
- Archived builds remain selectable when the Archived filter is enabled.
- Invalid or quarantined records remain recoverable/exportable but cannot be
  fed to the optimizer or comparison metrics.
- A missing, deleted, or inaccessible selection produces a recoverable empty
  slot rather than a blank screen.

### Default historical comparison

Each build is reproduced against its own pinned dataset version. The screen
shows the dataset version for each side and warns when they differ. It must not
silently substitute the current release for an unavailable historical release.

If one release cannot be resolved, the app still shows the stored character and
equipment values that are safe to display, marks optimizer-derived values
unavailable, and offers a current-dataset preview.

### Current-dataset preview

`Preview both with dataset <version>` recalculates both sides in memory against
the current verified release.

- The original records and revisions remain untouched.
- Equipment removed from, invalidated by, or no longer eligible in the current
  release is called out explicitly.
- The preview never invents substitute equipment.
- The player may create a new draft from either previewed side. That action
  receives a new build ID and current dataset metadata.

### Comparison content

The top summary shows the highest-value differences first:

- Name, level, floor, weapon path, and optimization goal.
- Dataset version and historical/current preview mode.
- Invested stats and current unspent-point recommendation.
- Ten-level allocation totals and milestone differences.
- Equipped items by slot, requirements, verified prices, acquisition sources,
  availability, and exact wiki links.
- Supported projected metrics: damage per hit, reduction, bonus HP, stamina,
  movement, critical chance, drop chance, multi-hit chance, and resistance
  values when the selected dataset supplies the required mechanics.
- Immediate action and verified shopping cost, separating unknown prices from
  known totals.

The UI may say that one build has the higher verified value for a specific
metric. It must not declare an overall winner or manufacture a single build
score. Equal, unsupported, and unknown comparisons are labeled explicitly.

### Responsive presentation

Desktop uses aligned columns and a differences-first summary. Mobile stacks
the two build cards while retaining a compact sticky differences summary. Long
stat, equipment, and allocation sections use progressive disclosure. The
workspace must not require horizontal document scrolling at 320 px or above.

## 5. Preset behavior

### Curated presets

Curated presets are bundled, versioned application strategy data. They are not
wiki facts and do not hard-code invented optimal stat totals.

A curated preset defines only safe planner intent and defaults, such as:

- Stable preset ID and policy version.
- Display name and plain-language purpose.
- Weapon path.
- Optimization goal.
- Optional access-preference defaults that are false unless explicitly part of
  the preset.
- Compatible dataset/policy information and verification notes.

Applying a curated preset starts a new draft at the normal new-character
baseline. The player then confirms level, floor, stats, and equipment through
the existing guided flow. Starter gear continues to be selected only by the
existing unambiguous verified-starter rule. The deterministic optimizer, not
the preset file, computes allocations and upgrades.

### Personal presets

A player can turn a valid saved build into a personal preset. A personal preset
retains the complete reusable build snapshot, including path, goal, level,
floor, invested stats, access preferences, equipment, and pinned dataset.

Applying a personal preset:

- Creates a new active draft with a new ID.
- Leaves the preset and source build unchanged.
- Makes the copied name visibly distinct.
- Preserves the pinned dataset until the player explicitly edits using current
  data or chooses current-dataset recalculation.
- Routes to Character for review rather than skipping straight to Results.

Personal presets can be renamed, duplicated, archived, exported, and deleted.
They synchronize privately and receive recoverable revision history like normal
saved builds.

### Storage distinction

Saved records gain an explicit kind:

- `build`
- `personal-preset`

Existing rows migrate to `build`. Curated presets are not stored as user rows
and never appear as owned cloud data.

## 6. Portable build and backup formats

### Individual build export

An individual export is a versioned JSON document containing:

- Format discriminator and schema version.
- Export timestamp.
- Build kind.
- Current validated profile.
- Dataset and optimizer policy references needed for reproducibility.
- Optional plan progress.
- Optional immutable revision history when the player selects it.

### Full library backup

A library backup contains all selected valid local and available cloud records,
their kinds, plan progress, archive state, and optional revisions. Logical
local/cloud mirrors are deduplicated.

If cloud state is unavailable, the app does not imply that a local-only export
is complete. It labels the backup scope before download and allows the player
to continue with local records only.

### Excluded data

Portable files exclude:

- SpacetimeAuth identities, tokens, issuer data, and credentials.
- Owner identity or private profile metadata.
- Internal cloud row IDs and server ordering fields.
- Public share IDs, revocation state, and owner links.
- Pending synchronization queue internals.
- Device-specific IndexedDB keys.

### Validation and limits

The complete file is parsed and validated before any write begins. Validation
covers the outer format, record count and byte limits, unique IDs, schema
versions, bounded strings and arrays, build profiles, revisions, and supported
dataset references.

Malformed, unsupported, or over-limit files fail without partial import.
Invalid records are itemized in the preview and can be exported as diagnostic
text; the importer never guesses repairs to game data or build values.

### Import preview and conflicts

Before import, the app shows:

- Valid build and preset counts.
- Names, levels, paths, datasets, and revision counts.
- Missing historical datasets.
- ID/name conflicts.
- Records that will be rejected and why.
- Chosen destination and whether cloud sync will be queued.

The default action creates duplicates with new IDs and distinct names. Explicit
overwrite requires a second confirmation and preserves the replaced current
record as a recoverable revision. A failed multi-record write rolls back the
whole import transaction.

Imports write to local storage first. When authenticated, the existing durable
cloud queue synchronizes imported records idempotently. Importing a file does
not automatically publish or share any build.

## 7. Local persistence and migration

The IndexedDB schema receives a forward-only version increment. Migration:

1. Adds the saved-record kind with `build` as the default.
2. Preserves active draft, normal saved builds, inventory, plan progress,
   archive state, and timestamps.
3. Preserves unknown or invalid prior records in quarantine rather than
   deleting them.
4. Adds personal-preset indexes only where a real query requires them.
5. Keeps exports available when cloud or a future database version is
   unavailable.

Import and backup operations use explicit transactions. Large JSON work is
bounded and performed outside render paths. UI-only compare selection, sorting,
and disclosure state never changes the active plan fingerprint.

## 8. SpacetimeDB integration

Personal presets use the existing private build ownership, reducer protection,
history, and local-first queue model. The server schema evolves additively so
deployed rows remain valid.

- Current build rows and immutable revision rows carry the saved-record kind.
- Existing rows default to `build`.
- Sender identity remains authoritative; a client cannot import or write a row
  on behalf of another identity.
- Comparison performs subscriptions/reads only and calls no mutation reducer.
- Duplicate import creates new logical build IDs.
- Explicit overwrite creates a new immutable revision and retains recovery.
- Cloud history converges under the existing latest-server-ordered edit rule.
- Public shared snapshots remain owner-free and do not reveal personal-preset
  history unless the owner explicitly shares a derived normal build.

Curated presets remain bundled application data. This batch does not add a
curator publishing domain merely to distribute UI strategy defaults.

## 9. Error and recovery behavior

- Dataset resolution states are Loading, Available, Unavailable, and Failed.
- A comparison remains partially usable when only one historical release
  resolves.
- Imports distinguish invalid files, unsupported future schemas, duplicate
  conflicts, storage quota failure, and queued cloud synchronization.
- Import, export, preset application, overwrite, and comparison preview changes
  announce status to assistive technology.
- Overwrite and delete require explicit confirmation.
- Duplicate-by-default actions are immediately recoverable from the build
  library.
- Storage failures preserve the source file and pre-import library unchanged.
- Stale open-tab database upgrades reuse the existing actionable close-tabs and
  reload recovery path.

## 10. Accessibility and visual design

The new screens extend the established fantasy system: castle background,
Cinzel headings, parchment text, brass rules, teal active states, and ornamental
panel corners. Utility controls use the existing maintained icon library.

Required behavior:

- Keyboard-complete build selection, comparison, preset application, and
  import preview.
- Visible focus and logical heading order.
- Text plus color for every comparison state.
- Tables use real headers on desktop and labeled card groups on mobile.
- Dialogs trap focus, close with Escape when safe, and restore launcher focus.
- Status messages use appropriate live regions without announcing every filter
  keystroke.
- Touch targets remain comfortable and the supported 320 px minimum has no
  document overflow.
- Reduced-motion preferences are respected.

## 11. Performance boundaries

- Compare selection, sorting, and disclosures do not invoke optimization.
- Optimizer work runs once per unique build/dataset input and is memoized by
  deterministic fingerprint.
- Current-dataset preview computes only after explicit player action.
- Build lists remain responsive at the tested storage limit through indexed
  queries and incremental rendering where needed.
- Import validation is bounded by file bytes, record count, and revision count.
- No unbounded revision or JSON expansion is permitted in the browser or
  SpacetimeDB reducer.
- The main planner routes must not take on the comparison workspace's initial
  bundle cost when route-level splitting is practical.

## 12. Verification strategy

Implementation follows test-first red/green cycles and must cover:

- Two-build selection, swap, removal, deleted-record recovery, and refresh.
- Historical-versus-historical and mixed-dataset comparisons.
- Unavailable dataset and current-preview behavior.
- Per-metric equality, difference, unknown, and unsupported states.
- Curated preset application without invented stats or gear.
- Personal preset creation, application with a new ID, rename, archive,
  duplicate, export, and delete.
- IndexedDB migration from the current production schema with active draft,
  builds, inventory, and plan progress preserved.
- SpacetimeDB additive schema validation, reducer authorization, revision
  recovery, offline queue replay, reconnect convergence, and generated-binding
  cleanliness.
- Individual export and full-library backup round trips.
- Atomic import, duplicate default, confirmed overwrite, rollback, quarantine,
  future-schema rejection, size limits, and private-field exclusion.
- Fingerprint stability for comparison and preset browsing.
- Desktop, tablet, and mobile rendered flows with console, accessibility,
  focus, and overflow checks.
- GitHub Pages deep links for the new routes.
- Production smoke of compare, preset creation/application, export/import, and
  local/cloud recovery boundaries.

## 13. Acceptance criteria

This Build Power Tools batch is complete only when:

1. Two valid local/cloud builds can be compared without mutating either record.
2. Each build defaults to its pinned verified dataset, with an explicit
   current-dataset preview that remains temporary.
3. The comparison shows stat, allocation, equipment, price, source, shopping,
   and supported projected-metric differences without an opaque overall score.
4. Curated presets create guided new drafts without hard-coded invented build
   advice.
5. Personal presets create new drafts with new IDs and retain private,
   recoverable local/cloud history.
6. Individual exports and full-library backups round-trip through the versioned
   validator.
7. Imports are atomic, duplicate by default, and require confirmation before
   recoverable overwrite.
8. Portable files contain no identity, credential, share-owner, or sync-queue
   data.
9. Existing production IndexedDB and SpacetimeDB rows migrate without silent
   loss.
10. New routes are keyboard/touch usable, width-safe from 320 px upward, and
    free of serious or critical accessibility violations.
11. The complete unit, module, migration, integration, reliability, Pages, and
    live production gates pass on the final merged tree.

## 14. Non-goals

- Comparing more than two builds simultaneously.
- Declaring one overall best build or creating a fabricated power score.
- Collaborative editing or public preset marketplace functionality.
- Importing legacy formats without an explicit validated converter.
- Publishing guessed game data or treating personal builds as verified facts.
- Automatically overwriting builds during import or preset application.
- Automatically sharing imported builds.
- Building the Progress dashboard, floor tracker, shopping budget, or boss
  readiness in this batch.
- Combining Planner, Builds, Compare, Presets, and Backups into one page.

