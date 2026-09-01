# SBO:Rebirth QOL Release 2 Progress Dashboard Design

**Date:** 2026-09-01  
**Status:** Approved design, pending implementation plan  
**Product:** SBO:Rebirth Build Optimizer V2  
**Release:** QOL Release 2 — Progress Dashboard

## 1. Purpose

Turn the existing disabled Progress navigation item and per-build checklist
state into a focused journey tracker. The dashboard should tell a progressing
player what to do next, what can be afforded, what has already been completed,
and how the current route has changed without expanding Results into another
dense planner sheet.

The dashboard is build-scoped and offline-first. It reuses the deterministic
optimizer, verified dataset, canonical inventory, saved-build library,
IndexedDB storage, optional SpacetimeDB synchronization, and versioned portable
backup systems. It does not claim to observe Roblox gameplay directly.

## 2. Approved product decisions

1. `/progress` opens the active build's step-by-step journey by default.
2. A compact saved-character switcher can inspect another valid saved build
   without silently replacing the active planner draft.
3. Progress is hybrid: the app automatically reconciles facts represented in
   planner data, while drops, purchases, quests, and floor clears remain manual
   until the player updates a corresponding verified planner input.
4. Current Col is optional. Prices and totals remain useful when no balance is
   entered, but affordability is labeled unknown.
5. This release tracks basic floor milestones only. Detailed boss-readiness
   calculations remain a separate release requiring their own verified data.
6. Completed, skipped, reopened, and superseded tasks remain in bounded journey
   history rather than disappearing when the optimizer plan changes.
7. UI-only progress changes do not alter the optimizer fingerprint. Owning or
   equipping an item, changing stats, level, floor, path, goal, or access
   preferences remains a real planner input and may change recommendations.
8. The dashboard remains a dedicated routed workspace. It does not merge
   Planner, Results, Inventory, Builds, and Progress onto one page.

## 3. Information architecture

### `/progress`

The existing Progress navigation item becomes an enabled `NavLink`. The route
uses the active draft unless an explicit saved-build selection is present.

### `/progress?build=<id>&source=<local|cloud>`

The optional query identifies a saved record to inspect. It is a private local
navigation aid, not a share URL. Missing, archived, deleted, invalid, or
inaccessible records produce a recoverable state with actions to choose another
build or return to the active build. Viewing a saved build does not load it into
the planner unless the player explicitly chooses `Load into Planner`.

### Screen order

1. Persistent build context and saved-character switcher.
2. `Next move`, containing one highest-priority actionable task.
3. `Today's route`, containing a short active checklist.
4. `Shopping plan`, containing verified costs and affordability.
5. `Current floor`, containing basic verified milestones.
6. `Journey history`, collapsed by default and filterable by event type.

Desktop may use a two-column middle region when it improves scanning. Mobile
stacks every section, keeps the next action reachable, and never requires
horizontal document scrolling at the supported 320 px minimum.

## 4. Build selection and context

The build-context header shows:

- Name, level, highest unlocked floor, weapon path, and optimization goal.
- Equipped required-slot count.
- Pinned dataset version and whether it resolved exactly.
- Local/cloud source and save/sync state.
- Current-plan completion count and percentage, labeled as checklist progress
  rather than character power.

The switcher uses the unified deduplicated build library. Normal builds and
personal presets are labeled distinctly. Invalid/quarantined records remain
exportable from their recovery surfaces but cannot drive optimizer-derived
progress. If a historical dataset is unavailable, stored manual history and
safe profile facts remain visible while derived tasks and affordability totals
that depend on that dataset are unavailable.

## 5. Progress task model

### Generated tasks

The dashboard derives current tasks from one optimizer evaluation per unique
build/dataset fingerprint. Supported task categories are:

- `stat-allocation`
- `equipment-upgrade`
- `level-milestone`
- `floor-milestone`
- `manual-objective`

Every generated task has a stable action key derived from its category, target,
and dataset/policy context. Display expansion, sorting, filters, wallet edits,
notes, and checklist state are excluded from the optimizer fingerprint.

### Automatic reconciliation

The app automatically treats a task as complete when current planner state
proves it:

- Current level has reached or passed the task level.
- Invested stat totals satisfy the recorded allocation target.
- The target item is equipped.
- The canonical inventory records the target item as owned when ownership is
  the stated task outcome.
- `maxFloor` has advanced past an unlock milestone.

Automatic reconciliation appends one history event only when state crosses
from incomplete to complete. Re-rendering or reconnecting must not duplicate
events.

### Manual actions

Players can complete, skip, reopen, or annotate tasks whose outcomes cannot be
verified from planner data. Manual completion never claims gameplay proof. A
purchase/drop task can link to `Mark owned` in Inventory and an equipment task
can link to the existing picker, but checklist completion alone does not mutate
inventory, equipment, stats, level, floor, or Col.

Task notes are optional, private, plain text. Skipping asks for no mandatory
reason, though an optional note may be recorded. Destructive history reset
requires explicit confirmation.

### Superseded tasks

When a real planner input changes, the dashboard compares the new task set with
the prior plan fingerprint. An unfinished task absent from the new plan becomes
`superseded`; it is removed from the active checklist and appended to journey
history. Completed events remain completed. If a logically identical task
returns later, it receives the current fingerprint while previous events remain
historical.

## 6. Next move and today's route

`Next move` selects one task using existing optimizer priority, not a new opaque
score:

1. Unspent current stat points.
2. Eligible equip-now improvements already owned.
3. Eligible verified upgrade purchases.
4. The next level allocation.
5. A manual floor or acquisition objective.

The card explains why it is first and links to the responsible Planner,
Inventory, or verified wiki surface. Unknown or unavailable data is explicit.

`Today's route` shows a short default list of up to five pending tasks grouped
as Now, This floor, and Later. Players can expand the complete active list.
Filtering and expansion are view state only and do not create history or cloud
writes.

## 7. Shopping plan and Col

The optional wallet accepts non-negative safe integers only. No game-specific
maximum is invented. Clearing the field returns affordability to Unknown.

Shopping candidates come only from current verified optimizer upgrades and
exclude equipped or canonical-owned items. The plan shows:

- Exact verified price or `Price not verified`.
- Verified acquisition location and exact item wiki link.
- Known total, unknown-price item count, and current Col when supplied.
- `Affordable now`, `Need <amount> more`, or `Affordability unknown`.
- Purchase order using optimizer priority and eligibility; price alone never
  overrides build usefulness.

The dashboard does not automatically deduct Col when a task is checked because
the app cannot verify the transaction. A player explicitly edits the wallet
after spending. This prevents accidental inventory/wallet coupling and keeps
the first release recoverable.

## 8. Current floor milestones

The floor section uses only facts already represented by the verified dataset
or character profile:

- Highest unlocked floor.
- Verified upgrade sources accessible on that floor.
- Upcoming item level/floor eligibility milestones.
- The next floor unlock objective as a manual task until `maxFloor` changes.

No boss strength, required damage, recommended party size, drop probability,
or clear-readiness claim is made without a separately reviewed boss dataset and
formula set. The later Boss/Floor Readiness release can consume the stable
progress interfaces defined here.

## 9. Journey history

History records state transitions, not every render or synchronization event.
Each event contains:

- Stable event ID and action key.
- Build ID, task category, and short stored label.
- Result: `completed`, `skipped`, `reopened`, or `superseded`.
- Source: `automatic`, `manual`, or `legacy`.
- Optimizer fingerprint and dataset version where applicable.
- ISO timestamp for new events; migrated legacy events explicitly carry an
  unknown historical time instead of an invented timestamp.
- Optional bounded private note.

The UI groups recent events by date, provides category/result filters, and
collapses history by default. The implementation stores at most 1,000 detailed
events and 200 current objective states per build. Reaching a limit produces an
actionable export/reset message; events are never silently discarded.

## 10. Persistence model and migration

`PlanProgress` advances from schema version 1 to version 2. The concrete model
contains:

- Build ID.
- Optional wallet balance plus its edit timestamp.
- Current bounded objective states.
- Bounded history events.
- Reconciled-through level and acknowledged dataset version.
- Current and previous optimizer fingerprints needed for reconciliation.

The pure migration converts `completedActionIds` and
`dismissedRecommendationIds` into legacy objective/history entries. Because v1
has no event timestamps, migration labels their time as unknown. Existing
`reconciledThroughLevel` and `acknowledgedDatasetVersion` values are preserved.

IndexedDB keeps the existing `plan-progress` store; no new store or database
version is required unless implementation evidence proves an index is needed.
Writes remain build-scoped and atomic. Deleting a saved build offers explicit
progress export/removal behavior rather than creating invisible orphan data.

Portable build schema version 1 continues to wrap the record, while its nested
progress validator accepts and normalizes migrated v1 or current v2 progress.
Exports always emit v2. Duplicate import rewrites the nested build ID to the new
record ID. Overwrite remains confirmation-gated and atomic with the record
import.

## 11. SpacetimeDB synchronization

The existing private `build_plan_progress` table, sender-filtered
`my_plan_progress` view, and protected `upsert_plan_progress` reducer remain the
storage boundary. The server validator accepts v1 during rollout and strictly
validates v2 keys, enums, unique IDs, counts, safe integers, timestamps, text,
and the expected build ID.

To preserve cross-device history, v2 reducer behavior merges rather than
blindly replaces:

- History is a union by immutable event ID.
- Reusing an event ID with different content is rejected.
- Objective and wallet conflicts use their explicit `updatedAt` values.
- The latest valid objective state becomes current.
- Counts and byte limits are enforced after merge.

The local-first pending queue reconnects, reads current cloud progress, merges,
and retries idempotently. Identity remains authoritative; a client cannot read
or write another owner's progress. Normal builds and personal presets can sync
privately. Curated presets have no owned progress until applied as a new draft.

Public shares remain unchanged in this release. Wallet balance, notes, manual
history, and owner identity are never copied into public share rows. A future
explicit public progress summary must receive its own privacy review rather
than leaking private progress through the existing share format.

## 12. Error and recovery behavior

- No active or selected build: show Create, Resume, or Choose Build actions.
- Missing saved record: clear the invalid query selection and retain a visible
  explanation.
- Loading historical dataset: show stored facts and a bounded loading state.
- Unavailable historical dataset: disable derived tasks; never substitute the
  current dataset silently.
- Storage failure: preserve in-memory progress and show the existing global
  actionable recovery notice.
- Offline cloud: save locally, queue the bounded progress update, and label it
  `Sync queued`.
- Merge conflict: preserve immutable events, choose objective/wallet state by
  explicit timestamps, and surface rejected malformed collisions.
- Limit reached: keep existing history unchanged and offer private export plus
  confirmed reset; never truncate silently.
- Unknown price: exclude it from known totals and affordability arithmetic.

## 13. Components and boundaries

The feature should remain understandable through focused units:

- `ProgressScreen`: route orchestration and empty/error states.
- `ProgressBuildSwitcher`: unified-library selection without draft mutation.
- `ProgressContextHeader`: selected build and save/sync context.
- `NextMoveCard`: one optimizer-prioritized action.
- `ProgressChecklist`: grouped active tasks and manual state changes.
- `ShoppingPlan`: verified price/acquisition/affordability projection.
- `FloorMilestones`: basic verified floor progress only.
- `JourneyHistory`: filtered, collapsed event timeline.
- Progress domain model/schema/migration.
- Deterministic task generator and reconciler.
- Shopping-budget calculator.
- Existing planner-state provider/store/repository adapters extended to v2.

Screen components consume typed domain outputs and do not parse raw dataset or
SpacetimeDB rows. Reconciliation is deterministic and independently testable.

## 14. Accessibility and responsive design

The dashboard extends the established fantasy visual system without introducing
a second design language. Required behavior:

- Logical heading order and landmark labels.
- Keyboard-complete switcher, checklist, filters, notes, wallet, and dialogs.
- Visible focus and text labels in addition to color/status icons.
- Status announcements only for meaningful saves, reconciliation, and errors.
- Comfortable touch targets.
- No horizontal document overflow at 320 px or above.
- History and long task lists use progressive disclosure.
- Reduced-motion preferences remain respected.
- Completion percentage is labeled checklist progress and never presented as a
  verified power/readiness score.

## 15. Performance boundaries

- Optimize once per unique build/dataset input and memoize by deterministic
  fingerprint.
- Wallet, note, filter, disclosure, and manual checklist updates do not invoke
  optimization.
- Reconciliation is linear in at most 200 active objectives and 1,000 events.
- Build switcher queries use the existing bounded 250-record library and mirror
  deduplication.
- Cloud payload and reducer parsing remain byte- and count-bounded.
- `/progress` is route-split when practical so the planner's initial bundle
  does not absorb the history and shopping workspace.

## 16. Verification strategy

Implementation follows test-first red/green cycles and covers:

- v1-to-v2 migration without invented timestamps or lost checklist state.
- Stable task keys and fingerprint exclusions.
- Automatic level/stat/equipment/inventory/floor reconciliation.
- Manual complete, skip, reopen, notes, and reset confirmation.
- No duplicate events after render, reload, reconnect, or repeated inputs.
- Superseded-task preservation after every material planner input change.
- Optional Col, known/unknown totals, affordability, and optimizer-priority
  ordering.
- Exact wiki links and explicit missing-data labels.
- Active build default, saved-build query selection, deletion recovery, and
  no implicit planner-draft replacement.
- Local persistence, portable round trip, duplicate ID rewrite, confirmed
  overwrite, and atomic rollback.
- Server v1/v2 validation, identity isolation, event-ID collision rejection,
  offline replay, cross-device merge, and generated-binding cleanliness.
- Stress at 250 builds, 200 objectives, and 1,000 history events.
- Fingerprint stability for all UI-only progress actions.
- Desktop, tablet, 390 px, and 320 px accessibility/overflow checks.
- GitHub Pages `/progress` deep-link recovery.
- Production smoke with disposable local records and no authentication or
  production-player mutation.

## 17. Acceptance criteria

The Progress Dashboard batch is complete only when:

1. The Progress navigation opens a dedicated active-build dashboard with a
   non-mutating saved-build switcher.
2. The screen presents one next move, a short active route, verified shopping,
   basic floor milestones, and collapsed history without crowding Results.
3. Detectable facts reconcile automatically and non-detectable gameplay tasks
   remain explicitly manual.
4. Plan changes preserve completed, skipped, reopened, and superseded history
   without duplicate events or silent loss.
5. Optional Col produces correct known-cost affordability while unknown prices
   remain excluded and explicit.
6. Progress-only actions preserve the optimizer fingerprint and never mutate
   planner/inventory inputs implicitly.
7. Existing v1 local/cloud progress migrates to v2 without losing checklist,
   reconciliation, or dataset-acknowledgement state.
8. Local and SpacetimeDB progress converge idempotently while preserving
   immutable history and identity isolation.
9. Portable backups round-trip v2 progress, rewrite duplicate build IDs, omit
   authentication/share/queue data, and remain atomic.
10. The workspace is keyboard/touch usable, width-safe from 320 px upward, and
    free of serious or critical accessibility violations.
11. Complete unit, module, migration, integration, stress, Pages, CI,
    deployment, and disposable live-smoke gates pass on the final merged tree.

## 18. Non-goals

- Reading Roblox memory, APIs, telemetry, inventory, Col, quest, or floor state
  automatically.
- Detailed boss readiness or unverified clear requirements.
- An account-wide analytics dashboard as the primary experience.
- Treating checklist percentage as build strength or gameplay completion.
- Automatically deducting Col or marking inventory from a checked task.
- Publicly sharing wallet, notes, manual history, or owner identity.
- Collaborative progress editing or public progress leaderboards.
- Unbounded history or silent history truncation.
- Replacing Planner, Results, Inventory, or Builds with one combined page.
