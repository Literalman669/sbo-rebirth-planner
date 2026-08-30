# Wiki Catalog, Verified Mechanics, Armor, and Detailed Results Design

**Date:** 2026-08-30  
**Status:** Approved in chat; awaiting written-spec review  
**Execution:** Inline in the current task; no subagent delegation

## Purpose

The optimizer currently has a reliable application shell and a small, curated
release, but it does not yet have enough game data or sufficiently transparent
strategy output to be described as a comprehensive Sword Blox Online: Rebirth
optimizer. This design expands the product in four connected areas:

1. build a versioned catalog of every wiki-listed equipment item relevant to
   character builds;
2. model wiki-supported stat, weapon, armor, shield, and headwear mechanics
   without inventing missing rules;
3. separate verified game facts from optimizer strategy policy; and
4. replace the ambiguous +5/+10 stat summary with a precise spend-now and
   level-by-level plan while retaining a clean, responsive interface.

The wiki is the authoritative external source for this project. No Roblox
character will be used or modified for validation. A user-supplied gameplay
attestation may be stored as a separately identified source only when the wiki
does not document a narrow fact, as already done for the three starting stat
points.

## Scope

### Included

- One-Handed, Two-Handed, Rapier, Dagger, Dual Wield, and Melee/Fists paths.
- Weapons, shields/off-hands, armor, upper headwear, lower headwear, overlays,
  and any additional build-relevant equipment type discovered through the
  wiki category inventory.
- Permanent, event, limited, gamepass, badge, legacy, and currently
  unobtainable items.
- Level, floor, weapon-skill, acquisition, price, availability, tradability,
  and other requirements when the wiki provides them.
- Attack, defense, dexterity/HP, stamina, movement, resistance, critical,
  drop, multi-hit, attack-interval, and other optimizer-relevant mechanics
  when the wiki provides sufficient evidence.
- Current-stat validation, unspent-point allocation, a ten-level plan, exact
  per-level instructions, running totals, milestones, and upgrade advice.
- Versioned release publication, private curator review, source links,
  revision identifiers, and last-reviewed dates through SpacetimeDB.

### Excluded

- General lore, NPC biographies, maps, and other wiki content that cannot
  affect a build or explain how to obtain build-relevant equipment.
- Unstated numerical formulas inferred from screenshots, gameplay, or personal
  intuition.
- Automatic publication of scraped or parsed wiki content.
- Social OAuth configuration, which remains deferred.
- Claims that a strategy is objectively meta or optimal without a source that
  supports that claim.

## Evidence and trust model

Game facts and strategy choices are different data classes and must never
share the same verification badge.

### Source evidence

Every imported wiki page snapshot records:

- canonical page title and URL;
- MediaWiki page and revision identifiers;
- revision timestamp;
- fetch timestamp;
- content hash;
- redirect target, if any; and
- the raw source text used by the parser.

The importer uses the MediaWiki API rather than rendered-page scraping. A new
revision creates a new immutable snapshot and a diff candidate; it never
silently mutates an already published release.

### Record verification states

- `verified`: every field used by the optimizer is supported by the pinned
  wiki revision and has passed curator review.
- `partial`: the item or mechanic exists in the wiki, but one or more required
  optimizer fields are absent or ambiguous.
- `conflicting`: two current canonical sources disagree.
- `unknown`: the page is discoverable but cannot yet be normalized safely.
- `legacy`: the wiki identifies the record as removed, retired, or otherwise
  historical.

`partial`, `conflicting`, `unknown`, and `legacy` records remain searchable in
the catalog but are excluded from ordinary upgrade recommendations. The UI
shows the reason and source rather than filling missing values with guesses.

### Availability and access

Verification and obtainability are independent. Availability is represented
with explicit states such as:

- always obtainable;
- active event;
- inactive or historical event;
- rotating or time-limited;
- gamepass;
- badge or achievement;
- legacy/unobtainable; and
- unknown.

Default recommendations consider only verified, currently obtainable,
permanent free items. Paid, badge, or event items can appear when a player
explicitly opts into that access type or marks the item as owned. A
legacy/unobtainable item may be equipped when already owned but is never
presented as something to farm now.

### Owner attestation

An owner attestation is not wiki verification. It is allowed only for a narrow
fact that the wiki does not document, includes the date and official game URL,
and is visibly identified as gameplay-attested. The Level-1 rule is:

- character level: 1;
- invested STR/DEF/AGI/VIT/LUK: 0;
- unspent points: 3.

## Wiki inventory and ingestion

### Inventory discovery

The inventory begins from canonical build-relevant category and list pages and
uses MediaWiki category membership, links, redirects, and continuation tokens
to enumerate all relevant pages. The initial roots include weapons and every
weapon-path table, armor, upper headwear, lower headwear, shields, equipment,
gamepass/badge equipment, event equipment, shops, and acquisition pages needed
to explain where an item comes from.

Each run produces a coverage manifest containing:

- pages discovered;
- pages fetched at the current revision;
- pages parsed;
- normalized records produced;
- verified, partial, conflicting, unknown, and legacy counts;
- redirects and duplicates resolved;
- category totals reconciled; and
- failures with actionable reasons.

The manifest is a release gate. “Complete” means every discovered relevant
page is accounted for, including pages that remain explicitly unresolved; it
does not mean unresolved data is treated as verified.

### Raw and normalized layers

The pipeline has three layers:

1. **Raw snapshots:** immutable wiki source and revision metadata.
2. **Parsed candidates:** typed but unpublished records with field-level source
   references and parser diagnostics.
3. **Published release:** curator-approved, internally consistent records used
   by the public optimizer.

Parser families cover list tables, infobox/item pages, acquisition tables,
and prose mechanics. Unknown layouts fail closed into review instead of
producing a plausible-looking record.

### Identity, aliases, and duplicates

Catalog IDs are stable slugs independent of display-name changes. Records can
store aliases, color/variant labels, redirect names, and variant relationships.
For example, an apparent mismatch such as “Beginner Armor” versus “Beginner
Blue” must be represented as a sourced alias or distinct variant; the importer
must not assume they are the same item.

Duplicate detection uses normalized canonical names, redirect targets,
variant relationships, and source page identifiers. A duplicate or ambiguous
merge becomes a review item.

## Catalog data model

### Equipment record

Each equipment record contains, when sourced:

- stable ID, canonical name, aliases, and variant group;
- equipment kind and usable slot or slots;
- compatible weapon path or paths;
- attack, defense, dexterity/health contribution, resistances, and structured
  special effects;
- minimum character level, floor, weapon-skill type/value, and other gates;
- one or more acquisition records, including location, enemy/shop/crafting
  source, cost/currency, event, gamepass, or badge details;
- availability/access state and whether it is currently recommendation-eligible;
- wiki source snapshot and field-level evidence;
- verification state and review note; and
- first-seen, last-reviewed, and published release versions.

Unknown fields remain absent. Zero is stored only when the wiki explicitly
supports zero or the field is structurally inapplicable.

### Acquisition records

Acquisition is a child collection rather than one comma-separated string. One
item can have several sources, each with its own floor, shop/enemy/crafting
source, cost, event state, and evidence. This lets results say exactly where an
upgrade can currently be obtained and avoids treating a historical event as an
active farming route.

### Mechanics records

A mechanic record stores:

- inputs, outputs, units, exact sourced expression when available, caps, and
  boundary behavior;
- affected weapon paths or equipment types;
- structured computability: `exact`, `descriptive`, `conflicting`, or
  `unknown`;
- source snapshot and field-level excerpt/reference; and
- verification and review metadata.

Mechanics explicitly considered include STR damage/stamina/multi-hit, DEF
reduction, AGI stamina/movement/jump/weapon interval, VIT HP multiplier,
stamina and resistance, LUK critical/drop/multi-hit and capped effects, level
progression, dexterity-to-HP, and weapon-path-specific behavior. A descriptive
wiki statement is displayed but is not converted into a numerical formula
unless the source supplies enough information.

## Armor, shield, and headwear model

The build model expands equipment slots and path rules using wiki evidence.
It supports main hand, off-hand/second weapon, shield, armor, upper headwear,
lower headwear, and non-stat overlays. Slot compatibility, dual-wield behavior,
and shield eligibility are data-driven rather than inferred from item names.

Aggregate gear totals include only equipped, verified numeric fields. The
projection layer exposes both raw gear totals and computed effects:

- attack and any path-specific modifiers;
- defense and supported reduction result;
- dexterity and supported HP result;
- resistance by status type;
- supported movement, stamina, critical, drop, multi-hit, and timing effects;
  and
- sourced special effects that cannot yet be scored numerically.

Armor comparisons show the current item, candidate item, changed raw stats,
changed computed metrics, requirement, current acquisition source, and any
unmodeled special effect. If the wiki does not support a complete total-HP or
damage-taken formula, the UI displays only the verified component rather than
inventing a final number.

## Optimizer design

### Facts versus strategy

The optimizer consumes two independent inputs:

1. **Verified game model:** published equipment and exact mechanics.
2. **Strategy policy:** transparent goal weights and tie-breaking rules.

Strategy policies are deterministic and versioned but are labeled as planner
policy, not wiki-verified facts. “Balanced,” “Damage,” “Survivability,”
“Mobility,” and “Farming” may continue to exist, but each result explains which
verified metrics the policy prioritized. Unsupported mechanics do not receive
fabricated scores.

The existing hard-coded target shares and goal weights must be audited. They
may remain only when intentionally documented as strategy policy; results must
not imply that the wiki prescribed those ratios.

### Eligibility and recommendation safety

Eligibility is evaluated before scoring. A candidate can be recommended only
when:

- its verification state is `verified`;
- the player’s path and slot are compatible;
- all required level, floor, and known skill gates are satisfied now or are
  clearly identified as future requirements;
- its acquisition is currently usable under the player’s selected access
  preferences; and
- the exact published dataset version is available.

Owned eligible items are considered first for “equip this now.” Farming
recommendations are ranked after owned upgrades. Unknown or conflicting data
can never win by using a default zero, empty requirement, or assumed source.

### Stat budget

The canonical budget is:

`available points = character level × 3`

`unspent points = available points − sum(invested stats)`

The Stats screen uses the labels **Available**, **Invested**, and **Unspent**.
Overspending blocks results. Unspent points are not merely warned about; the
optimizer allocates them in a separate spend-now plan before projecting future
levels.

### Allocation plan contract

The plan contains:

- `spendNow`: exact allocation for all currently unspent points;
- `levelRows`: ten rows for the next ten actual character levels;
- `milestones`: derived summaries, never the only source of instructions;
- `finalStats`: current invested stats + spend-now allocation + 30 future
  points; and
- explanations referencing strategy-policy and verified-mechanics versions.

Every future level row contains:

- the actual character level reached;
- exactly three added points distributed across the five stats;
- running stat totals after spending that level’s points;
- relevant stat caps, mechanic thresholds, gear eligibility, or data warnings;
  and
- an optional short reason tied to the selected strategy policy.

Required invariants:

- `sum(spendNow) = current unspent points`;
- each future row adds exactly 3 points;
- each running total equals the previous total plus that row’s additions;
- no stat exceeds its verified cap;
- final totals reconcile exactly; and
- identical inputs and dataset/policy versions serialize identically.

If there is insufficient verified information to score a requested goal, the
optimizer returns an explicit limitation rather than a confident allocation.

## Results experience

### Information hierarchy

The Results route remains a dedicated page with this order:

1. **Do now:** immediate owned-equipment action or obtainable upgrade.
2. **Spend now:** exact allocation of existing unspent points, including a
   before/after stat summary.
3. **Next ten levels:** full level-by-level sheet.
4. **Next upgrades:** two or three verified equipment targets with comparison,
   requirements, current acquisition, and source.
5. **Why this plan:** strategy-policy explanation, modeled mechanics,
   confidence/limitations, dataset version, and source links.

### Level-by-level sheet

Desktop uses an explicit two-part header:

- **Add this level:** STR+, DEF+, AGI+, VIT+, LUK+.
- **Stats after spending:** STR, DEF, AGI, VIT, LUK.

Rows use actual levels, such as Level 2 through Level 11, never ambiguous
“Level +5” labels as the primary instruction. A short note above the sheet
states: “Add this level is new spending for that level; totals are your stats
after spending.”

Milestone rows can be emphasized, and a compact +5/+10 summary can remain as
an optional secondary view. The complete ten-row allocation is always directly
available and is the authoritative instruction.

Mobile renders one compact card per level, showing the three-point action
first and running totals in a disclosure. It must not require horizontal page
scrolling. Desktop may keep the table within the results panel and use sticky
headers if vertical scrolling warrants it.

### Clarity and accessibility

- Do not rely on a plus sign without stating whether it is per-level or
  cumulative.
- Use actual level numbers and reconcile point totals visibly.
- Warnings precede affected output and identify whether the limitation comes
  from player input, wiki coverage, or strategy policy.
- Tables/cards retain proper headings, accessible names, keyboard operation,
  and readable focus states.
- Dense source and formula detail belongs in disclosures so the primary action
  remains readable.

## SpacetimeDB integration

The existing owner/curator draft, review, and atomic publication workflow is
extended rather than replaced. New typed release children cover wiki page
snapshots, aliases/variants, acquisitions, requirements, resistances/special
effects, mechanic evidence, and availability.

Private curator views expose raw snapshots, parser diagnostics, field-level
diffs, unresolved records, and coverage manifests. Protected reducers create
or update drafts, record review decisions, and publish only when every
release-gate invariant passes. Public subscriptions expose only published
release rows and necessary provenance.

Historical builds remain pinned to their original dataset and strategy-policy
versions. Publishing a new release cannot rewrite old recommendations. The
client cache stores the last valid published snapshot and rejects malformed or
noncanonical provenance.

## Validation and test strategy

### Parser and data tests

- Committed fixtures for every supported wiki layout family.
- MediaWiki continuation, redirect, duplicate, variant, and revision-diff
  tests.
- Field-level parsing tests for equipment stats, requirements, acquisition,
  prices, availability, and special effects.
- Coverage-manifest reconciliation: every discovered relevant page is parsed
  or has an explicit unresolved reason.
- Canonical source, revision, timestamp, and content-hash validation.
- No network-dependent assertions in the deterministic CI suite.
- A separate curator command fetches current revision metadata and produces a
  drift report without publishing.

### Domain tests

- Equipment-slot and path compatibility.
- Armor/shield/headwear aggregation and resistance integrity.
- Exact formula boundaries and caps for computable mechanics.
- Verified-only and availability/access recommendation filters.
- Owned-item preference and future requirement behavior.
- Spend-now, per-level, running-total, cap, reconciliation, and determinism
  invariants.
- Strategy policies tested as policy, without verification labels.

### UI and end-to-end tests

- New Level-1 character: 0 invested, 3 available/unspent.
- Under-budget profiles receive an actionable spend-now plan.
- Ten actual-level rows, each adding exactly three points.
- Desktop table and mobile cards show matching allocations and totals.
- Armor/headwear/shield selection and comparison.
- Unverified/conflicting/legacy records are visible in catalog contexts but
  never recommended as current farms.
- Source links, dataset version, policy version, and limitations remain visible.
- Existing guest persistence, cloud history, sharing, revision recovery,
  deep-link, and accessibility regression suites remain green.

## Migration and rollout

1. Preserve release `2026.08.29.1` and historical build resolution.
2. Add the raw snapshot, catalog, mechanics, and coverage structures without
   changing the public release.
3. Re-import the existing 33 records through the new evidence model and
   reconcile them against current revisions.
4. Inventory and normalize all build-relevant wiki pages, leaving unresolved
   rows explicitly excluded.
5. Complete curator review and publish a new dataset version only after the
   coverage and integrity gates pass.
6. Introduce the revised mechanics and versioned strategy policy.
7. Ship the spend-now and level-by-level results contract/UI.
8. Run the complete local reliability gate, production-shaped Pages tests,
   SpacetimeDB publication tests, and live read-only smoke before declaring the
   new release complete.

No partially reviewed wiki crawl becomes the live optimizer dataset. If UI
work is ready before the catalog is complete, it can ship against the current
release only when it preserves the current release’s limitations and labels.

## Acceptance criteria

The work is complete when all of the following are true:

- Every build-relevant page discovered from the canonical wiki inventory is
  accounted for in the coverage manifest.
- Every optimizer-used field is supported by a pinned current wiki revision or
  the narrowly identified Level-1 owner attestation.
- Conflicting, partial, unknown, legacy, inactive-event, and inaccessible paid
  records cannot appear as ordinary farm recommendations.
- Weapons, shields, armor, upper/lower headwear, and discovered build-relevant
  slots are represented with their sourced stats, requirements, availability,
  and acquisitions.
- Computed mechanics reproduce the exact documented formulas and clearly omit
  unsupported calculations.
- Strategy policy is versioned and visibly distinct from verified game facts.
- Current unspent points receive an exact spend-now allocation.
- The next ten actual levels each show exactly three new points and correct
  running totals on desktop and mobile.
- Upgrade recommendations include current/target comparison, requirements,
  current acquisition, projected verified effects, limitations, and source.
- Historical builds remain reproducible against their original dataset and
  strategy-policy versions.
- Unit, integration, Pages, accessibility, publication, and live smoke gates
  pass with no unexplained errors or warnings.

