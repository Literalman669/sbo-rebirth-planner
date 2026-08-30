# SBO:Rebirth Optimizer Full Reliability and Stress Design

**Date:** 2026-08-29

**Status:** Approved in conversation; awaiting review of this written specification

**Target:** The deployed React/TypeScript optimizer in `optimizer-v2/` and its SpacetimeDB 2.8.3 module

## Purpose

This pass validates every utility the current application exposes, finds reproducible correctness, durability, security, accessibility, performance, and usability defects, and fixes confirmed root causes with regression coverage. It is not a claim that arbitrary software can be proven 100% bug-free. In this design, “full utility” means that every current user-facing workflow and backend mutation has at least one automated success path, one relevant failure or boundary path, and a documented stress threshold.

The pass covers the guest planner, deterministic optimizer, local persistence, optional authentication, cloud build synchronization, revision recovery, public sharing, verified dataset subscriptions, historical releases, the private curation workflow, GitHub Pages routing, and production deployment.

## Chosen Approach

The selected approach is a layered reliability campaign:

1. Pure domain and property-style matrices catch mathematical and eligibility errors cheaply.
2. React component and routing tests catch invalid transitions and misleading UI states.
3. Browser tests exercise the built application on desktop and mobile.
4. An isolated local SpacetimeDB instance receives mutation, reconnect, revision, sharing, and curation stress.
5. Production receives read-only smoke tests only.

This is preferred over a browser-only audit, which cannot reliably inspect state races or backend invariants, and over production load testing, which would create avoidable risk for real data and authentication state.

## Safety Boundaries

- All bulk writes, concurrent revisions, corrupted fixtures, publication attempts, and connection disruption run against the fixed local test database.
- Test credentials and test identities are generated for the isolated local server and destroyed with it.
- Production checks may load routes, read the public release, run an ordinary guest planner flow, and verify console health. They may not create bulk cloud records, publish datasets, change roles, or stress authentication providers.
- Maincloud publication remains gated by unit tests, module tests, integration tests, generated-binding verification, independent review, and explicit deployment workflow success.
- Provider OAuth secrets are never requested in chat, printed in logs, committed, or copied into test fixtures.

## Test Inventory and Coverage Map

### Optimizer domain matrix

The domain suite will cover all combinations of:

- Six weapon paths: Two-Handed, One-Handed, Rapier, Dagger, Dual Wield, and Melee.
- Five goals: Balanced, Damage, Survivability, Mobility, and Farming.
- Representative progression bands spanning floors 1 through 19 and early, mid, and late level/skill requirements.
- Known and omitted weapon skill, including values immediately below, at, and above requirements.
- Equipped-only, owned-but-unequipped, obtainable, future-level, inactive-event, incompatible, and missing-source candidates.

For each valid matrix row, the suite asserts:

- Deterministic output across repeated executions.
- Exactly one immediate action.
- Exactly thirty points over ten future levels.
- No stat exceeds its verified cap.
- No more than three upgrade targets.
- No duplicate item or slot targets.
- Every target is verified, path-compatible, floor-compatible, and source-backed.
- Skill-gated items cannot be described as immediately usable when skill is omitted or insufficient.
- A newer release does not silently alter a plan pinned to an older release.

The deterministic stress threshold is 1,000 repeated optimization executions per representative profile with byte-equivalent serialized output.

### Input and validation matrix

Character, stat, and equipment fields will be tested at and around every boundary:

- Empty, non-numeric, fractional, negative, zero, minimum, maximum, and above-maximum values.
- Level and floor combinations that are syntactically valid but progression-inconsistent.
- Stat totals below, equal to, and above earned points.
- Missing required equipment, wrong-slot items, wrong-path weapons, inaccessible-floor gear, and stale item identifiers.
- Dual Wield without its two required weapons or without confirmed skill.
- Optional goal, weapon skill, headwear, shield, and owned items.

The current earned-point rule is considered unresolved until the owner confirms whether a new Level 1 character begins with zero or three allocatable points. The stress pass may expose the discrepancy and improve mismatch handling, but it will not silently choose between `level × 3` and `(level − 1) × 3` without that evidence.

If unspent points are legal in game, the preferred repair is an explicit optional unspent-point input or an acknowledgment step, not forcing invested totals to equal earned totals. The optimizer must not ignore a positive difference while pretending the next thirty points are the player’s only pending allocation.

### UI, routing, and accessibility

The rendered suite covers:

- Home, Character, Stats, Equipment, Results, History, Shared Build, Auth Callback, and Curation access states.
- Direct entry and refresh for every public route under the GitHub Pages base path.
- Back, Continue, edit-return, resume, reset, save, delete, share, revoke, and history restoration.
- Keyboard-only completion of the full planner.
- Focus movement to routed headings and first invalid controls.
- Required labels, accessible names, status messages, error announcements, and non-color selection indicators.
- Reduced motion and representative 390-pixel mobile and 1440-pixel desktop viewports.
- No clipping, horizontal scroll traps, hidden actions, overlapping controls, or framework overlays.
- No relevant console errors or unhandled promise rejections.

The built GitHub Pages artifact, not only Vite’s development server, must pass callback and shared-route deep-link tests.

### Local persistence stress

IndexedDB adapters will be tested for:

- Rapid consecutive draft updates and debounce behavior.
- At least 250 named local builds with stable listing and targeted deletion.
- Corrupt draft, build, cached release, and legacy pending-revision rows.
- Exact release lookup, latest-release selection, and pruning with referenced historical releases retained.
- Account-scoped pending revisions and explicit claiming of legacy unscoped rows.
- Storage API rejection and unavailable/quota-style failures producing a visible non-destructive error.
- Reload and provider unmount while a final draft write is pending.

Local stress tests may use controlled clocks and fake IndexedDB for deterministic volume. At least one real-browser persistence flow verifies reload behavior.

### Authentication and account boundaries

The suite verifies application behavior for guest, loading, authenticated, error, callback, and signed-out sessions. It asserts that:

- Guest planner use never requires authentication.
- Signing in never uploads an unselected local build.
- Only cloud-enrolled build identifiers auto-synchronize.
- Pending revisions are isolated by OIDC subject.
- Signing out never deletes local data.
- Authentication failure leaves guest data intact.
- A configured callback and an error callback both return a usable application state.

SpacetimeAuth currently exposes magic-link email and anonymous login because external providers have not been configured. Google, GitHub, Discord, Twitch, or Kick can appear only after provider OAuth applications and their client credentials are added. The reliability pass may improve the app’s explanation of authentication, but it cannot invent or extract provider credentials. Anonymous SpacetimeAuth login should be evaluated for removal because the planner already has a complete local guest mode and no anonymous-to-permanent account upgrade flow.

### SpacetimeDB mutation and concurrency stress

The isolated module test will exercise:

- At least 100 sequential revisions for one build.
- Concurrent edits from two connections sharing an identity.
- Response-loss retry of an already committed revision.
- Conflicting reuse of a revision identifier.
- Offline queueing followed by ordered reconnect replay.
- Account switching while pending rows exist.
- Restore from old history, deletion, and cross-session visibility.
- Selective guest import with zero, one, and multiple selected builds.
- Share creation, snapshot immutability, historical dataset use, and revocation.
- Ordinary-user isolation from another identity’s builds, revisions, shares, and curation views.

Each stress case asserts final table counts, head revision, immutable history, owner isolation, and absence of duplicate child rows. Timing assertions use condition-based polling rather than arbitrary sleeps.

### Dataset and curation stress

The curation suite covers:

- Allowlisted and rejected wiki pages.
- Oversized, malformed, ambiguous, and structurally changed MediaWiki responses.
- Candidate accept/reject rules and source-only review notes.
- Exact entity, candidate page, URL, revision, and review-state linkage.
- Duplicate items, formulas, sources, candidates, and public identifiers.
- Invalid known-gap identifiers and wrong source pages.
- Missing path coverage, required formulas, provenance, or progression bands.
- Carry-forward from the current release, including legacy rows whose candidate IDs require reconstruction.
- Atomic publish rollback after every validation failure category.
- A successful second release preserving the first as readable history and making exactly one release current.

The fallback export must remain deterministic except for explicitly reviewed publication metadata, pass coverage validation, and produce the same optimizer behavior as the matching live release.

### Performance and resource thresholds

The pass records, but does not prematurely optimize, these thresholds:

- Home with 250 local builds remains interactive and renders without runtime errors.
- A 100-revision history remains selectable and restorable.
- Representative optimizer execution remains comfortably below one animation frame per call in the test environment; the exact measurement is reported rather than used as a brittle universal assertion.
- Production bundle size and chunk composition are recorded and compared to the current baseline.
- No unbounded event listeners, reconnect loops, duplicate subscriptions, or repeated autosaves appear during route cycling.

A threshold failure is investigated before optimization. Performance fixes follow the same regression-first process as correctness fixes.

## Defect Workflow

Every suspected bug follows four gates:

1. Reproduce it consistently and trace the data from UI or request through storage, optimizer, or reducer boundaries.
2. Compare the broken path with a working neighboring path and state one root-cause hypothesis.
3. Add the smallest test that fails for the observed reason.
4. Implement one root-cause fix, rerun the focused test, then run the complete relevant layer.

Critical defects include data loss, cross-account access, false “verified” advice, unavailable-item immediate recommendations, publication of an unreadable current release, authentication bypass, or broken production routing. These block all deployment.

Important defects include silently ignored inputs, misleading skill or stat claims, persistent loading states, failed offline recovery, inaccessible controls, and nondeterministic output. These are fixed before release unless external credentials or owner gameplay evidence are required.

Minor visual or copy issues may be grouped only after all correctness gates are green, but still receive direct rendered verification.

## Deliverables

- New or expanded domain, component, storage, module, integration, and built-artifact tests.
- A stress runner or parameterized test utilities where repeated scenarios would otherwise be duplicated.
- Root-cause fixes for every reproducible in-scope defect.
- A findings ledger listing reproduction, severity, root cause, regression test, fix, and status.
- Updated acceptance evidence with exact test counts and stress thresholds reached.
- An independent code review of the complete change range.
- Green clean-install CI, Maincloud-safe migration validation, controlled deployment, and read-only production smoke evidence.

## Exit Criteria

The reliability pass is complete when:

1. Every current user-facing utility is mapped to automated success and failure/boundary coverage.
2. The full weapon-path and goal matrix is deterministic and respects eligibility/provenance invariants.
3. Invalid or unresolved character state cannot silently produce authoritative-looking advice.
4. Guest, local, authenticated, offline, reconnect, multi-session, sharing, history, and curation flows pass in isolation.
5. Stress thresholds for local builds, revisions, repeated optimization, and route cycling are met or documented with a fixed defect.
6. Desktop, mobile, keyboard, reduced-motion, direct-route, and console-health checks pass.
7. No Critical or Important reproducible defect remains except a clearly documented external credential or gameplay-evidence dependency.
8. Generated bindings, fallback coverage, module build, typecheck, unit tests, integration tests, and built Pages tests pass from a clean install.
9. Independent review reports no unresolved Critical or Important issue.
10. Deployment preserves Maincloud data, production smoke passes, and the automatic deployment workflow remains green.

## Explicit External Dependencies

- Social identity providers require OAuth client IDs and secrets created in their respective developer consoles.
- The Level-1 earned-stat baseline requires owner gameplay confirmation or a canonical source that states the starting point total.
- SpacetimeAuth is an external beta service; provider-side outages or hosted-page limitations are reported separately from application defects.
