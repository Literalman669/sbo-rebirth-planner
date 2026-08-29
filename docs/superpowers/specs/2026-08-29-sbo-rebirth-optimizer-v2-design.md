# SBO:Rebirth Build Optimizer V2 Design

**Date:** 2026-08-29

**Status:** Revised architecture approved in conversation; awaiting review of this written specification

**Canonical game-data source:** [Sword-Blox-Online-Rebirth Wiki on Fandom](https://swordbloxonlinerebirth.fandom.com/wiki/Sword-Blox-Online-Rebirth_Wiki)

## Summary

SBO:Rebirth Build Optimizer V2 is a fresh, responsive web application for players who are progressing through *Sword Blox Online: Rebirth*. A player enters their current character, stats, and equipment through three focused screens. The application returns a separate, prioritized results screen containing the strongest immediate action, a ten-level stat plan, and two or three obtainable equipment upgrades.

SpacetimeDB 2.8.3 is the application's primary data backend. It owns the verified game dataset, dataset releases, signed-in profiles, builds, revision history, public build snapshots, and the private wiki-review workflow. Guests can use the optimizer without signing in; SpacetimeAuth enables cloud sync, history, and sharing.

The application replaces the original planner's broad collection of dashboards, inventory management, boss tracking, calibration, optional JSON-blob synchronization, and desktop packaging with one clear workflow:

> Character state in → short, verified action plan out.

## Goals

- Help progressing players decide what to do next without requiring expert knowledge.
- Support Two-Handed, One-Handed, Rapier, Dagger, Dual Wield, and Melee paths.
- Require only level, highest unlocked floor, weapon path, invested stats, and equipped gear.
- Allow an optional optimization goal: Balanced, Damage, Survivability, Mobility, or Farming.
- Allow a small optional shortlist of relevant unequipped items the player already owns.
- Generate deterministic advice using reviewed formulas and item data from the canonical wiki.
- Explain recommendations using projected changes, requirements, acquisition details, and source links.
- Work well on desktop and mobile and deploy as a static GitHub Pages site.
- Keep the optimizer, dataset, storage, and user interface independently testable.
- Use SpacetimeDB as the authoritative source for public verified data and signed-in player data.
- Allow guest use without authentication and offer selective local-build import after sign-in.
- Provide real-time dataset updates, recoverable build revisions, and revocable public build snapshots.
- Keep wiki extraction private and require an owner-managed curator to publish a release.

## Non-goals for Version 1

- Electron or another desktop-app wrapper
- A full inventory collection manager
- Boss, quest, or floor-completion tracking
- General-purpose dashboards
- Build comparison, pinning, social feeds, chat, or leaderboards
- Experimental calibration controls
- Community submissions or collaborative build editing
- Mandatory authentication for basic planning
- Automatic publication of unreviewed wiki changes
- Server-side optimizer execution
- Estimated recommendations when verified data is unavailable

These features may be reconsidered later only when they directly improve the optimizer's core workflow.

## Audience and Product Principles

The primary audience is players leveling characters and unlocking floors. Version 1 is not designed primarily for endgame theorycrafting.

The interface follows four principles:

1. **One decision per screen.** Inputs and results never compete for space.
2. **Advice before analysis.** The first visible result is the next action, not a table or score.
3. **Verified or absent.** Missing data is disclosed; it is never silently replaced by an estimate.
4. **Fantasy atmosphere without visual noise.** Original Aincrad-inspired ornament, texture, typography, and restrained motion provide character while preserving strong hierarchy and readability. Official anime artwork and copied interface assets are not used.

## Information Architecture

The application is technically a React single-page application, but the experience is divided into dedicated routed screens rather than one long page.

### `/`

The Home screen provides:

- Create Build
- Resume Active Draft, when one exists
- A compact list of named saved builds
- Dataset version and last-reviewed date
- Removal of an individual saved build
- Optional SpacetimeAuth sign-in, account state, and synchronization status
- Selective import of local guest builds after the first successful sign-in

### `/character`

The Character screen contains:

- Current level
- Highest unlocked floor
- Weapon path selection cards
- Optional optimization goal, with Balanced selected by default
- Optional weapon skill inside a compact "Improve accuracy" disclosure

### `/stats`

The Stats screen contains:

- STR
- DEF
- AGI
- VIT
- LUK
- Expected-versus-entered point feedback derived from the verified progression rules

### `/equipment`

The Equipment screen contains:

- Weapon slot, or two weapon slots for Dual Wield
- Armor
- Shield only when the chosen path permits one
- Supported upper and lower headwear slots
- A searchable optional shortlist of unequipped owned items

Selectors show only records compatible with the selected character context. The shortlist is not a general inventory browser.

### `/results`

The Results screen contains four sections in this order:

1. **Do now:** one strongest immediate action, including equipping an owned item when appropriate.
2. **Next levels:** a fixed ten-level, thirty-point stat allocation plan.
3. **Next upgrades:** two or three obtainable equipment targets with projected improvement, requirement, floor, acquisition source, and wiki citation.
4. **Why this plan:** an expandable explanation of the formulas and goal-specific tradeoffs used.

Edit links return to each earlier screen without clearing the profile. Re-generating replaces the prior result rather than stacking another report below it.

### `/shared/:shareId`

The Shared Build screen renders a public, read-only build snapshot. The snapshot contains no owner identity, private profile data, or revision history. A revoked identifier shows an unavailable state.

### `/curation`

The Curation workspace is absent for ordinary users. Owner-managed curators can inspect wiki candidates, compare changes, record review decisions, assemble a release draft, validate it, and publish it. Owner-only controls grant or revoke curator roles.

## Navigation and Responsive Behavior

- A compact progress header shows Character, Stats, Equipment, and Results.
- Back and Continue are the primary actions on setup screens.
- The active step is announced visually and to assistive technology.
- Direct navigation to an unavailable later step redirects to the earliest incomplete step.
- Mobile layouts use a single content column and touch-friendly controls.
- Desktop layouts may use wider cards and inline field groups, but do not combine separate steps into one screen.
- Nonessential explanations are expandable; core labels and validation remain visible.
- Motion respects `prefers-reduced-motion`.

## Technical Architecture

Version 1 uses React, TypeScript, Vite, SpacetimeDB 2.8.3, and SpacetimeAuth. GitHub Pages serves the static React client, while a TypeScript SpacetimeDB module published to Maincloud provides the runtime backend.

### UI layer

Routed React screens and small focused components render the workflow. The application uses generated `DbConnection` bindings plus `SpacetimeDBProvider`, `useTable`, and `useReducer` from the official React SDK. Components consume typed state and optimizer results but contain no recommendation math or wiki-specific transformation logic.

### Profile layer

A versioned character-profile schema represents the active draft and named saved builds. A storage adapter owns guest persistence, signed-in caching, schema validation, pending revisions, and future migrations. UI code does not access browser storage directly.

### Optimizer layer

Pure TypeScript functions accept a normalized character profile and a verified dataset. They return a structured plan containing actions, projections, explanations, and provenance references. The optimizer remains in the client and has no dependency on React, routing, browser storage, SpacetimeDB, or network access.

### Data layer

Public SpacetimeDB tables provide production-ready formulas, equipment, requirements, acquisition details, provenance, and release metadata through real-time subscriptions. A locally cached release supports temporary disconnection. The deployed web bundle includes the latest validated public release as a first-load fallback; SpacetimeDB remains authoritative whenever a newer published release is available.

### Maintenance tooling

Curator-authorized procedures may fetch candidate wiki changes into private staging tables, and scheduled work may check source revisions. Extracted data is never promoted automatically. A curator reviews changes, resolves conflicts, records provenance, validates the complete draft, and invokes a transactional publish reducer.

### Authentication and connection layer

Guests connect anonymously for public data but keep player data local. SpacetimeAuth provides production OIDC identities for optional sign-in. Private tables use authenticated identity ownership, and identity-filtered views expose only the caller's records. Client-visible controls never substitute for reducer-side authorization.

### Version alignment

The local CLI, server package, client SDK, and generated bindings use SpacetimeDB 2.8.3. CI rebuilds the module and regenerates bindings with the pinned version. A binding diff fails the check.

## SpacetimeDB Data Model and Workflows

### Private player tables

- `user_profile` stores identity-scoped preferences and timestamps.
- `build` stores the owner, name, current revision identifier, and timestamps.
- `build_revision` stores an immutable character, stat, goal, and dataset-version snapshot.
- `revision_equipment` stores equipped item identifiers by slot for a revision.
- `revision_owned_item` stores the optional owned-item shortlist for a revision.

Identity-filtered views expose only the signed-in player's rows. Saving creates a revision and updates the build head in one transaction. Restoring an older revision creates a new revision rather than deleting later history. When two devices edit the same build, the latest accepted revision becomes current and all prior revisions remain recoverable.

### Public verified-data tables

- `dataset_release` stores the version, publication time, source summary, and current-release state.
- `equipment` stores typed, release-scoped verified equipment data.
- `formula` stores release-scoped formula metadata and boundary rules.
- `source_reference` stores wiki provenance, captured revision or date, and review metadata.

Only published releases are visible through public subscriptions. Publishing a complete validated release and marking it current occur atomically.

### Private curation tables

- `app_config` stores the module owner's identity captured from `ctx.sender` by the database `init` lifecycle reducer.
- `curator_role` stores identities granted access by the owner.
- `wiki_candidate` stores extracted candidate changes and source evidence.
- `review_decision` stores curator identities, decisions, and notes for the private audit trail.
- `release_draft` stores the release being assembled and its validation state.

Only the stored module owner can grant or revoke curator roles. Owner-managed curators can review candidates and publish a valid release. Procedures and scheduled checks may fetch or compare wiki material, but no procedure can bypass review and publish automatically.

### Public build sharing

A private ownership record links a build to a separate public snapshot. The public snapshot contains validated character inputs, the dataset version, and a random share identifier, but no owner identity, private history, or client-supplied recommendation text. The viewer recomputes the deterministic plan from the referenced verified release, preventing a modified client from publishing fake "verified" advice. Historical published releases needed by active shares remain readable. Shared snapshots are intentionally public, not secret-link access control. The owner can revoke a snapshot through a protected reducer.

## Character Profile Model

The normalized profile contains:

- Schema version
- Optional build name
- Current level
- Highest unlocked floor
- Weapon path
- Optimization goal
- Optional weapon skill
- STR, DEF, AGI, VIT, and LUK values
- Equipped item identifiers by supported slot
- Optional owned-item identifiers
- Dataset version used for the most recently generated result

Weapon skill is never guessed from character level. When omitted, the optimizer may show a skill-gated item as a future target with its requirement, but may not claim that the player can equip it now.

## Verified Dataset Model

Every production equipment record includes:

- Stable internal identifier
- Display name
- Equipment type and slot
- Compatible weapon path when applicable
- Attack, defense, dexterity, and other verified effects that apply
- Level and weapon-skill requirements that apply
- Earliest obtainable floor
- Acquisition type and human-readable acquisition details
- Availability state, including whether an event item is currently obtainable
- Wiki page URL
- Source revision or captured source date when available
- Last-reviewed date
- Verification status

Only records explicitly marked verified are included in production optimization. Unsupported or ambiguous fields fail validation rather than receiving defaults that could change the recommendation.

Formula records include their source URL, review date, units, applicable classes, and boundary behavior. Formula implementations are covered by executable examples derived from the source material.

## Optimization Behavior

### Eligibility

An equipment candidate is excluded when it is:

- Not verified
- Incompatible with the selected weapon path or slot
- Above the player's highest unlocked floor
- Beyond an applicable level requirement for an immediate recommendation
- Beyond the entered weapon skill for an immediate recommendation, when weapon skill is known
- Currently unavailable due to a past or inactive event, unless it appears in the player's owned shortlist

Near-term upgrade results may include an item whose level requirement is reached within the fixed ten-level plan, but the result must label the requirement and may not present the item as immediately equippable. When weapon skill is omitted, a skill-gated target must say "Requires Weapon Skill N; confirm in game" and cannot become the immediate action.

### Immediate action

The optimizer compares equipped items, qualifying owned items, and currently obtainable upgrades. It returns one highest-impact action that the player can perform now. If the current loadout is already best among verified eligible options, the action says so and points to the next meaningful progression target.

### Stat plan

The optimizer allocates the thirty points gained over the next ten levels. It uses verified stat formulas and deterministic marginal comparisons. Balanced avoids severe weaknesses; the optional goals adjust explicit, documented weights:

- Damage emphasizes offensive output.
- Survivability emphasizes effective health and damage reduction.
- Mobility emphasizes verified AGI-related benefits.
- Farming emphasizes verified LUK-related benefits.

Weights and tie-breaking rules live in named configuration, not hidden component code. Equal candidates use stable tie breakers so the same input and dataset version always produce the same result.

### Equipment upgrades

Equipment is compared with projected, formula-backed changes rather than an unexplained aggregate score. The optimizer returns at most three targets and avoids recommending several equivalent items for the same slot when another slot has a meaningful improvement.

Acquisition difficulty is shown as factual source information. It is not converted into a numerical penalty unless the wiki provides a verified quantity such as a drop rate or material requirement and the product later defines a transparent policy for using it.

### No-result behavior

The application says that no verified upgrade is available for the player's current progression range. It does not introduce estimated records, ignore floor restrictions, or silently recommend unavailable event items.

## State, Saving, and Dataset Updates

- Guest drafts and named builds save locally after each valid change.
- Signing in never uploads guest data automatically. The app lists local builds and lets the player select which ones to import.
- Signed-in changes save locally immediately and synchronize as immutable cloud revisions.
- Pending revisions survive temporary disconnection and upload after reconnection.
- If another device changed the same build, the later accepted revision becomes current and both states remain in history.
- Removing one corrupt or unwanted local build does not clear other builds.
- Saved input profiles remain valid across dataset updates whenever their schema is compatible.
- Generated results are not permanent truth. A newer subscribed release marks an affected plan stale and offers recalculation against the new version.
- The latest subscribed public dataset is cached locally, and the bundled fallback is used only when no newer cached release is available.
- Version 1 does not include JSON import/export unless a later approved requirement establishes a concrete need.

## Validation and Error Handling

- Required-field errors appear next to the affected control.
- Continue remains disabled when a required field is invalid and states what must change.
- Stat-total feedback shows the expected total, entered total, and difference.
- Optional omissions explain reduced precision without blocking generation.
- Incompatible equipment cannot be selected for the current profile.
- A malformed dataset produces a clear application-level failure state and no recommendations.
- A malformed saved build is isolated, identified on Home, and removable without clearing all storage.
- Unknown saved item identifiers remain visible as unavailable references until the player replaces them; they are never substituted automatically.
- A connection failure preserves editing and identifies the cached dataset version in use.
- Authentication failure leaves guest data local and offers a non-destructive retry.
- A rejected reducer displays its server-provided validation message without applying an optimistic cloud state.
- A failed curator validation or publish leaves the current public release unchanged.
- Revoked or unknown share identifiers render an unavailable state without revealing private records.

## Accessibility

- Every control has a programmatic label and useful error association.
- All steps and selectors are usable by keyboard.
- Focus moves to the screen heading after routed navigation and to the first invalid field after failed validation.
- Color is not the only indicator of selection, status, or error.
- Text and interactive elements meet WCAG AA contrast targets.
- Decorative textures do not reduce text legibility.
- Reduced-motion preferences disable nonessential transitions.

## Testing Strategy

### Unit tests

- Formula boundaries and wiki-derived examples
- Candidate eligibility filters
- Goal weighting and stable tie breaking
- Ten-level stat allocation
- Immediate-action selection
- No-result behavior
- Profile schema parsing and storage migrations
- Revision ordering, pending synchronization, and local-cache selection

### SpacetimeDB module tests

- Player ownership enforcement and identity-filtered view isolation
- Curator grant and revocation authorization
- Build save, concurrent revision, restoration, and deletion behavior
- Guest-import reducer validation
- Public snapshot creation, privacy, and revocation
- Wiki-candidate staging and review permissions
- Dataset validation, atomic publication, and current-release switching

### Dataset tests

- Required fields and enum values
- Stable unique identifiers
- Valid numeric ranges and requirements
- Compatibility between slot and weapon-path fields
- Required provenance and review metadata
- No unverified record in the production optimizer dataset

### Component and routing tests

- Each step's valid, invalid, and optional states
- Step guarding and edit-return behavior
- Conditional equipment slots
- Active-draft restoration and named-build management
- Dataset-version recalculation messaging
- Optional sign-in and selective guest-build import
- Connection, synchronization, and offline-cache status
- Curator route protection and publish validation feedback

### End-to-end tests

- Complete a new build and generate a plan
- Refresh during setup and resume without data loss
- Edit an earlier step and regenerate results
- Equip a qualifying owned item through the generated advice
- Sign in, selectively import a guest build, and observe it on a second session
- Edit offline, reconnect, and verify a recoverable cloud revision
- Publish and revoke a public build snapshot
- Publish a verified dataset release and observe a stale-plan notification
- Verify usable layouts at representative mobile and desktop viewports
- Exercise keyboard-only progression through the full flow

## Deployment

GitHub Actions uses pinned SpacetimeDB 2.8.3 tooling to build the TypeScript module, regenerate client bindings, verify that generated files are current, run module and integration tests, type-check the React client, run unit and component tests, execute end-to-end smoke tests, validate the fallback dataset, and produce the Vite build.

Production deployment has two controlled stages:

1. Publish the tested SpacetimeDB module to Maincloud using authenticated deployment configuration.
2. Deploy the tested static client to GitHub Pages with the production database name, Maincloud URI, and SpacetimeAuth public configuration.

Credentials and private tokens are never committed. Wiki requests originate only from authorized backend maintenance workflows, not ordinary client sessions. The Vite base path is configured for repository-hosted GitHub Pages.

## Version 1 Acceptance Criteria

Version 1 is complete when:

1. A player can create or resume a build through four distinct routed screens.
2. All six agreed weapon paths are supported by the typed profile and verified eligibility rules.
3. The required input set is limited to character level and floor, weapon path, invested stats, and equipped gear; weapon skill and goal refinements remain optional.
4. Balanced is the default goal and the four optional goals alter documented optimizer behavior.
5. Results show one immediate action, a deterministic ten-level stat plan, and no more than three verified upgrade targets.
6. Every recommendation links to its underlying wiki provenance and displays the dataset version.
7. Unverified and unavailable items cannot leak into ordinary recommendations.
8. Guests can use the complete optimizer locally without signing in.
9. SpacetimeAuth sign-in offers selective import and enables cloud builds, synchronization, history, and sharing.
10. Signed-in builds use native private tables, identity-filtered views, reducers, and immutable revisions rather than JSON-blob mirroring.
11. Public verified data updates through subscriptions, remains cached for connection loss, and marks older plans stale.
12. Owner-managed curators can review staged wiki changes and atomically publish a validated release; ordinary users cannot access curation data or actions.
13. Players can create and revoke public build snapshots that contain no owner identity or private history.
14. The CLI, server package, client SDK, generated bindings, local tests, and CI all use SpacetimeDB 2.8.3.
15. Mobile, desktop, keyboard, reduced-motion, offline, reconnect, and cross-session flows pass their planned checks.
16. GitHub Actions validates and deploys the Maincloud module and GitHub Pages client through separate controlled stages.
