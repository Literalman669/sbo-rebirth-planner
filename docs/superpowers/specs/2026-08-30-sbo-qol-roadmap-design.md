# SBO:Rebirth Planner QOL Roadmap Design

**Date:** 2026-08-30  
**Status:** Approved design, pending implementation plan  
**Product:** SBO:Rebirth Build Optimizer V2

## 1. Purpose

Evolve the existing verified build optimizer into a local-first progression
companion without recreating the clutter of the legacy planner. The current
four-step planner remains the focused core. New capabilities live in dedicated
workspaces and reveal detail progressively.

The product must continue to prioritize progressing players who want a short,
actionable plan: where to spend points, which equipment to equip or obtain,
what it costs, and what to do next.

## 2. Design principles

1. **Action before explanation.** Show the next useful action first and keep
   formulas, sources, and long tables available on demand.
2. **Verified data only.** Never invent a stat, price, requirement, location,
   availability state, boss property, or formula.
3. **Local-first and recoverable.** Guest mode remains complete. Local work
   survives refreshes, offline use, schema upgrades, and failed cloud syncs.
4. **Deterministic recommendations.** Identical recommendation-affecting
   inputs, policy, and dataset produce identical output.
5. **UI state is not build state.** Filters, sorting, disclosures, density,
   completed tasks, and dismissed suggestions do not silently recalculate the
   plan.
6. **Progressive complexity.** Beginner mode is guided and concise. Detailed
   mode exposes comparison, formulas, sources, and advanced controls.
7. **Preserve the fantasy identity.** Extend the established castle,
   parchment, brass, teal, Cinzel, and ornamental visual system.

## 3. Scope and release boundaries

### Release 1: Core experience

- Global product navigation and persistent current-build summary.
- Visible local/cloud save status and undo for meaningful changes.
- Improved Character goal selection and contextual validation.
- Full Stats allocation workspace.
- Searchable equipment picker with equipped-item comparison.
- Action-focused Results experience.
- Focused Save dialog and dedicated Builds workspace.
- Mobile sticky actions and reduced scrolling.
- Versioned migrations for existing local and cloud builds.

### Release 2: Inventory and progression

- Owned-inventory manager, favorites, and comparison shortlist.
- Build comparison.
- Build presets, duplication, import/export, and backups.
- Plan checklist and level-advance reconciliation.
- Floor tracker, shopping list, Col budget, and progress dashboard.
- Dataset-update impact reports.

### Release 3: New verified domains

- Curated boss catalog and readiness model.
- Next-boss target.
- Skill-unlock timeline.
- Farming objectives and drop planning.
- Expanded floor progression.

Release 3 cannot expose a new domain until its wiki inventory, parser,
provenance, unknown-field handling, curator review, and atomic-publication
path pass the same gates as equipment and mechanics.

## 4. Information architecture

### Global navigation

- **Planner:** current four-step build flow.
- **Builds:** saved builds, history, comparison, backup, and sharing.
- **Inventory:** owned equipment, favorites, browse, filter, and compare.
- **Progress:** active-plan checklist, floor progress, costs, and milestones.
- **Bosses:** appears only after Release 3 data publication.

The global navigation and planner progress stepper are visually distinct.
Existing planner URLs remain compatible:

- `/character`
- `/stats`
- `/equipment`
- `/results`

New routes are introduced without replacing those deep links:

- `/builds`
- `/inventory`
- `/progress`
- `/compare/builds`
- `/compare/equipment`
- `/bosses` in Release 3

### Persistent build summary

Within planner routes, a compact summary displays:

- Build name or `Unnamed build`
- Level and highest unlocked floor
- Weapon path and optimization goal
- Required-equipment completion
- Dataset version and freshness
- `Saving`, `Saved locally`, `Sync queued`, or `Synced`
- An Edit action that opens the relevant field without losing place

The summary collapses to a compact line on small screens.

## 5. State model

State is split by responsibility.

### Build inputs

Recommendation-affecting values:

- Character identity and optional name
- Level and highest unlocked floor
- Weapon path and optimization goal
- Weapon skill
- Invested stats
- Equipped equipment
- Owned equipment relevant to recommendations
- Access preferences
- Dataset version

### Generated plan

The generated plan stores:

- Input fingerprint
- Dataset and strategy-policy versions
- Current unspent-point allocation
- Exact future level rows
- Immediate action
- Upgrade targets
- Explanation and warnings

The fingerprint covers only recommendation-affecting build inputs, optimizer
policy, and dataset version.

### Plan progress

Presentation and completion state:

- Completed action IDs
- Dismissed recommendation IDs and optional reasons
- Replacement recommendation choice
- Reconciled-through level
- Last acknowledged dataset-impact report

Plan-progress changes do not recalculate recommendations.

### UI preferences

- Beginner or Detailed mode
- Comfortable or Compact density
- Disclosure states
- Equipment filters and sorting
- Saved-build sorting
- Mobile compact-path preference
- Reduced-motion preference when app-controlled behavior exists

### Inventory state

- Owned item IDs
- Favorite item IDs
- Comparison shortlist
- Optional personal notes

Inventory is the canonical ownership source. The optimizer fingerprint uses
the resolved owned set at calculation time. Saved revisions retain the owned
shortlist used for that calculation so an old recommendation remains
reproducible even if the global inventory later changes.

### Saved build state

- Current build record
- Immutable revisions
- Local/cloud location
- Created and modified timestamps
- Archive state
- Share status

## 6. Persistence and synchronization

IndexedDB remains authoritative for immediate guest interaction. Every
meaningful local change is written through a bounded autosave queue, with a
visible state indicator.

Authenticated users mirror builds, revisions, plan progress, inventory, and
preferences through SpacetimeDB. Existing synchronization rules remain:

- Latest server-ordered edit becomes current.
- Every prior revision remains restorable.
- Offline mutations enter a durable local queue.
- Reconnect replays queued mutations idempotently.
- Server timestamps order cross-device changes.
- Conflicts preserve both revisions and identify the current revision.
- Public shares are immutable, owner-free snapshots and remain revocable.

Every persisted schema change requires:

- A version increment
- Forward migration
- Invalid-row quarantine instead of silent deletion
- Tests using real prior-version fixtures
- Recovery/export for rows that cannot migrate

## 7. Screen behavior

### Home

- Show the active draft as a prominent Resume card with last modified time and
  next incomplete step.
- Keep Create Build distinct from Resume.
- Show recent saved builds and their next actions.
- Reduce optional-auth copy to a compact cloud-benefits disclosure.
- Show offline/sync status without blocking guest planning.
- Offer a verified example build for first-time players.

### Character

- Accept an optional build name.
- Keep level and floor as direct numeric inputs with inline recovery messages.
- Warn about implausible level/floor combinations without inventing a hard
  game rule.
- Retain weapon-path cards.
- Present optimization goals as descriptive selectable cards. Each card states
  which verified metrics receive greater weight.
- Keep weapon skill in an advanced disclosure, but surface it automatically
  when required by the path or selected equipment.
- Remember non-build UI preferences, not prior character values, when creating
  a truly new build.

### Stats

- Support direct typing plus `+1`, `+5`, `Max available`, and decrement controls.
- Display Available, Invested, and Unspent as a progress meter and text.
- Provide Reset and Undo.
- Allow players to lock stats and distribute remaining points around locks.
- Offer `Apply recommended current points` without modifying already invested
  points.
- Provide a separate, explicit respec planner. It must never imply that
  existing points can move without a reset.
- Explain each stat using verified mechanics.
- Preview supported metric changes live; unsupported metrics remain labeled
  unknown or descriptive.
- Warn near and at stat caps.
- Show whether current invested stats match the saved plan at this level.

### Equipment

- Automatically select verified starter equipment when it is unambiguous.
- Replace native item dropdowns with an accessible searchable picker.
- Desktop picker: filtered list plus detail/comparison pane.
- Mobile picker: full-height sheet with sticky Equip/Close actions.
- Each item shows slot, key stats, requirements, availability, source type,
  price or missing-price state, ownership, and exact wiki link.
- Compare candidate effects against the equipped item using raw and projected
  changes.
- Filters include slot, path, level, floor, availability, access, owned,
  favorite, obtainable now, future, and verified price.
- Sorting includes projected improvement, raw strength, price, value per Col,
  level, floor, and name.
- Empty states explain the exact active restriction.
- Owned equipment is managed in Inventory rather than rendered as hundreds of
  checkboxes inside the planner.
- Quick actions: Equip, Mark Owned, Favorite, Compare, and Open Wiki.

### Results

- Start with a compact current-build summary.
- Show an action checklist grouped into `Do now`, `Next level`, `Next floor`,
  and `Later`.
- Recommendation badges: Equip Now, Buy Now, Owned, Farm, Unlock Later, and
  Missing Data.
- Immediate action always appears in detailed upgrade evidence.
- Current unspent points show an exact recommended allocation and resulting
  totals.
- Future allocation defaults to the next three levels, with Show All revealing
  all ten.
- Surface verified stat, skill, gear, and cap milestones in level rows.
- Group equipment targets into a shopping list by floor/source and show total
  verified cost; unknown prices stay separate.
- Allow recommendation dismissal and immediate verified replacement.
- Checklist completion does not change the optimizer fingerprint.
- `Advance to this level` reconciles completed rows, updates the character, and
  creates a recoverable revision.
- Provide copy-as-text, print, JSON backup, and share actions.
- Keep formulas, raw comparisons, sources, and detailed reasoning behind
  progressive disclosures.

### Builds

- Dedicated searchable and sortable workspace.
- Display name, level, floor, path, goal, dataset, modified time, sync state,
  completion state, and next action.
- Actions: Load, Rename, Duplicate, Compare, Archive, Export, Share, and Delete.
- Delete requires confirmation and identifies local/cloud/history effects.
- Save uses one dialog with Save, Cancel, destination, and overwrite/duplicate
  choice. Never render duplicate Save buttons.
- Revision history identifies current and restored revisions.

### Inventory (Release 2)

- Browse the complete verified catalog without affecting the active plan.
- Manage owned, favorite, and comparison states.
- Show missing upgrades and value-per-Col views.
- Equip an item into the active draft only through an explicit action.
- Import/export inventory backup.

### Progress (Release 2)

- Show current plan actions, completed tasks, floor tracker, next milestone,
  shopping cost, and the verified projected metrics supported by the active
  dataset. Do not invent a single build-strength score.
- `Advance to level` and floor-clear actions create recoverable revisions.
- No boss-readiness claim appears until Release 3 data is published.

## 8. Interaction and recovery rules

- Validation appears next to the field and moves focus to the first blocking
  error on Continue.
- Meaningful changes offer Undo.
- Save, sync, restore, import, completion, and replacement changes announce
  status to assistive technology.
- Destructive actions require confirmation.
- No eligible item explains whether level, floor, path, access, ownership, or
  verification caused the empty result.
- Missing source facts remain visibly unknown.
- Offline mode distinguishes local availability from queued cloud work.
- Dataset updates show an impact report before recalculating saved builds.
- Historical builds never silently substitute another release.
- Invalid stored records remain exportable or deletable.
- Recommendation dismissal cannot remove the final available verified option
  without showing an explicit no-alternative state.

## 9. Visual and responsive system

Preserve the current fantasy design system:

- Castle backgrounds
- Cinzel display typography
- Parchment text
- Brass borders
- Teal active states
- Ornamental panel corners
- Existing weapon-path artwork

New utility UI uses a consistent maintained icon library. New handcrafted SVG
or text-symbol icons are not introduced.

Desktop supports list/detail workspaces and compact density. Mobile uses:

- Sticky primary action footer
- Compact persistent build summary
- Full-height picker sheets
- Smaller weapon-path tiles after first use
- Three-level result preview before expansion
- Card reflow without horizontal scrolling

Accessibility requirements:

- Comfortable touch targets
- Visible focus
- Text plus color for every state
- Logical headings and focus order
- Reduced motion
- Status announcements
- Contrast and zoom validation
- No horizontal overflow from 320px upward

## 10. Performance boundaries

- UI-only changes do not invoke the optimizer.
- Equipment search/filter remains responsive against at least 1,000 records.
- Long equipment and build lists use windowing or incremental rendering where
  normal rendering would create noticeable delay.
- Expensive derived indexes are memoized by dataset version.
- New workspaces are route-level code-split where practical.
- The current deterministic optimizer stress threshold remains enforced.

## 11. Verification strategy

Every release requires:

- Test-first implementation for behavior and migrations
- Deterministic optimizer invariants
- Prior-schema migration fixtures
- Local, offline, queued-sync, and reconnect tests
- Revision recovery and conflict tests
- Public-share privacy and revocation tests
- Keyboard interaction and manual focus review
- Automated accessibility scans plus targeted screen-reader checks
- Desktop, tablet, and mobile screenshots
- Visual comparison against the accepted current design language
- Full-catalog filtering and sorting stress tests
- SpacetimeDB build, generated-binding cleanliness, and integration phases
- GitHub Pages deep-link checks
- Live production smoke testing

## 12. Release acceptance

A release is complete only when:

- Existing builds migrate without silent loss.
- UI preferences and checklist actions do not alter recommendations.
- All visible recommendations use published verified records.
- Unknown data remains explicit.
- Required actions work with keyboard and touch.
- The supported viewport range has no horizontal overflow.
- Local and cloud revisions are recoverable.
- The full reliability gate passes on the final merged tree.
- Production deployment passes and the live build is smoke-tested.

## 13. Execution decomposition

This roadmap is not executed as one implementation plan. After approval, the
first implementation plan covers Release 1 only. Release 2 receives its own
plan after Release 1 acceptance. Release 3 is split again by verified data
domain, with a data/curation plan preceding each player-facing feature plan.

## 14. Non-goals

- Combining the entire product into one page.
- Replacing the deterministic optimizer with opaque AI-generated advice.
- Publishing guessed game data.
- Rebuilding the visual identity.
- Making sign-in mandatory.
- Adding boss, farming, or drop recommendations before verified data support.
- Reintroducing the legacy planner's single-screen density.
