# SBO:Rebirth Build Planner - Execution Checklist

Checklist format requested by user. This is now the working build tracker.

## 1) Core product goals
- [x] Plan stat allocation per level.
- [x] Recommend equipment by slot.
- [x] Explain why each recommendation was selected.

---

## 2) Research and game mechanics capture

### Core mechanics captured
- [x] STR behavior documented (+0.4% damage per point, stamina/multi-hit interactions).
- [x] DEF behavior documented (defense multiplier scaling).
- [x] AGI behavior documented (speed, stamina, attack interval impact).
- [x] VIT behavior documented (dexterity/HP scaling and resistance effect).
- [x] LUK behavior documented (crit/drop rate and multi-hit contribution).

### Weapon context captured
- [x] Two-Handed (greatsword) profile documented (high attack, slow speed baseline).
- [x] AGI impact on tempo/sword-skill cadence captured.
- [x] Crit baseline + LUK impact captured.

### Gear/ecosystem context captured
- [x] Slot model captured (weapon, armor, upper, lower, shield).
- [x] Source quality progression captured (crafted > boss > mob > shop).
- [x] Scaling model captured (gamepass/badge by level or skill bands).
- [x] Early progression examples captured (Iron/Steel Greatsword, Beginner Armor/Fields Warrior).

### Research caveat
- [x] Noted extraction limitation for full per-item numeric stat tables.

---

## 3) Prototype delivery checklist (implemented)

### Project setup
- [x] Create roadmap file.
- [x] Create `sbo-rebirth-planner` prototype project folder.
- [x] Add `index.html`, `styles.css`, `data.js`, `app.js`, and `README.md`.

### Planner engine
- [x] Build per-level stat allocation engine (3 points per level).
- [x] Add weighted build scoring (damage/survival/mobility/farming).
- [x] Add weapon-class profile biases.
- [x] Add playstyle presets.
- [x] Add level-by-level output table with reasons.

### Gear recommender
- [x] Add slot-based recommendation engine.
- [x] Add source/scaling/floor fit scoring.
- [x] Add max-floor progression gating (exclude items above unlocked floor).
- [x] Add premium/event pool toggle.
- [x] Add ownership token input (names or ids).
- [x] Add "only owned" recommendation mode.
- [x] Add owned-item score boost mode when not strict-only.
- [x] Add confidence labels (`exact` vs `estimated`) in recommendation cards.

### UX / presentation
- [x] Add summary cards for projected outcomes.
- [x] Add build logic explanation panel.
- [x] Add responsive layout and polished UI styling.
- [x] Add status pills for ownership and confidence.
- [x] Add top-level recommendation confidence summary panel.

### Presets / persistence
- [x] Add local save/load/delete build presets.
- [x] Add JSON export/import for build presets.
- [x] Add side-by-side comparison for saved builds.

### Validation
- [x] Run JS syntax checks (`node --check app.js`, `node --check data.js`).

---

## 4) In-progress and next checklist

### Accuracy pass (Phase C)
- [x] Seed exact starter/core item stats from wiki raw templates.
- [x] Expand exact numeric coverage for current catalog progression (including premium/event/gamepass entries).
- [x] Validate formulas against real in-game test runs (calibration workflow + sample capture panel added).
- [x] Replace estimated item scoring with verified per-item numeric stats for current catalog.
- [x] Mark verified records as `exactStats: true` in `data.js`.
- [x] Expand item catalog floor-by-floor with stronger coverage (one-handed + rapier + dagger side-route bands ingested with exact stats; dual-wield now has dedicated exact melee entries and one-handed fallback for broader coverage).

### Quality and release (Phase D)
- [x] Add save/load builds.
- [x] Add side-by-side build comparison.
- [x] Add import/export JSON build files.
- [x] Add calibration profile export/import JSON files.
- [x] Add better filters (`exclude premium`, `exclude event`, `owned only`, `exact-only data mode`).
- [x] Add recommendation confidence summary in top-level UI.
- [x] Add quick-equip flow from recommendation cards (equip/add-owned/equip-top/clear).
- [x] Add equipped-loadout persistence + optional auto-sync into gear totals.
- [x] Add UI polish pass (responsive loadout cards, richer visual hierarchy, sticky input panel, motion-safe behavior).
- [x] Add preset pinning + pinned-only filter workflow for faster preset management.
- [x] Add keyboard shortcuts for primary actions (generate/save/load/equip/pin/collapse).
- [x] Add collapsible output subpanels + copy-equipped-loadout action in output toolbar.
- [x] Add richer recommendation details (location, value/price, and requirement range) directly in equipment cards.
- [x] Harden panel collapse behavior with explicit JS hide/show fallback for each output subpanel body.
- [x] Upgrade level allocator to hybrid optimizer (marginal gain + target-share correction + one-step lookahead + spread penalty).
- [x] Add allocation profile selector (Adaptive / Aggressive / Defensive / Tempo).
- [x] Add allocation transparency in Build Logic (profile mode + target split percentages).
- [x] Add recommendation scoring optimizations for requirement-fit and value-efficiency (economy-aware ranking).
- [x] Add recommendation meta economy summary (average value and average value-fit multiplier).
- [x] Publish web build and start user feedback loop (live at https://sbo-rebirth-build-planner.netlify.app).

### Phase F — Expansion (v0.4.x) ✅ COMPLETE
- [x] Mobile responsive layout: full single-column layout on phones, touch-friendly inputs, collapsible sidebar, sticky Generate button.
- [x] Armor & accessory item catalog: fill all floor tiers (1–18) for armor, upper headwear, lower headwear, and shield slots with exact stats from wiki. (298 total items)
- [x] Dual-wield off-hand catalog: 15 dedicated off-hand weapon entries for dual-wield builds (sk5–sk330).
- [x] Skill unlock checklist panel: visual per-class checklist of all sword skills, checked off as weapon skill level increases, with skill req badges and unlock notes.
- [x] Level-up planner: "I'm level X, I want to reach level Y" — show optimal point allocation path level by level with stat totals at each step.
- [x] Party Role Advisor panel: given a party role (tank/DPS/support/farmer), suggest stat allocation adjustments and gear priorities that complement the role.
- [x] Open Graph / social meta tags: added og:title, og:description, og:type, og:url, twitter:card, twitter:title, twitter:description.
- [x] Redeploy to Netlify after all Phase F changes. (v0.4.1 live)

### Phase G — Polish & Quality (v0.5.x)
- [x] Build comparison: side-by-side stat diff between two saved builds (already implemented in prior sessions).
- [x] Saved builds panel: name, save, load, pin, delete, export/import JSON — full localStorage preset system (already implemented).
- [x] Floor progress tracker: 18-floor click-to-toggle checklist, persists to localStorage, "Mark Up To Max Floor" shortcut (v0.5.0).
- [x] Quick Start Templates: 7 curated one-click build presets (2H Beginner, 1H+Shield Mid, Dual Wield DPS, Rapier Speed, Tank Build, Dagger Farmer, End-Game 2H) — loads full form snapshot (v0.5.0).
- [x] Tooltip system: hover tooltips on all 5 stat labels (STR/DEF/AGI/VIT/LUK) and gear total labels (Attack/Defense/Dexterity) with wiki-accurate descriptions (v0.5.0).
- [x] Print / export: clean @media print stylesheet — hides input panel/toolbar/footer, shows output-only in clean A4 layout; "Print / Save PDF" button in output toolbar (v0.5.1).
- [x] Redeploy after all Phase G changes. (v0.5.1 live)

### Phase H — Community & Discovery (v0.6.x) ✅ COMPLETE
- [x] Melee weapon catalog: Fists (sk1–30, skill-scaling) + Easter Royale Gauntlet Mk I–V (sk16–sk336, event-tiered) already fully cataloged. Melee has no floor-gated shop/boss weapons in SBO:R — class is complete.
- [x] Changelog panel: "What's New" output panel showing version notes for the last 5 releases (v0.6.0).
- [x] Shareable build name: `buildName` field in form encodes into share URL; recipient sees a teal banner with the build name on load (v0.6.0).
- [x] Stat cap warning: stat inputs turn amber at 490–499 pts and red at 500 (cap reached) — live as you type (v0.6.0).
- [x] "Best bang for Col" mode: new Gear Sort Mode select — "Best bang for Col (score ÷ cost)" ranks items by stat efficiency per Col spent (v0.6.0).
- [x] Redeploy after all Phase H changes. (v0.6.0 live)

### Phase J — v0.7.x (Current) ✅
- [x] Boss Planner: floor bosses + mini bosses, readiness checks, build snapshot, Next Target advice.
- [x] **Fact/logic check (2026-02-26):** formulas, sword skills, boss data vs wiki; browser test of Apply Stats, Equip Top, Clear, theme; report at `sbo-rebirth-planner/FACT-LOGIC-CHECK.md`.
- [x] Dark/light theme toggle: manual override with localStorage persistence, nav bar button.
- [x] Changelog panel, share link, stat cap warnings, gear sort modes.
- [x] Schema validation, calibration mode, keyboard shortcuts.
- [x] data-testid attributes on key buttons/inputs for browser automation.
- [x] Restore hidden panels as collapsible subpanels (Weapon Skill Path, Skill Checklist, Level-Up Planner, Party Role Advisor, Build Cost Summary).
- [x] Boss planner robustness: guard phases/resistances; survivability unknown verdict when boss ATK missing.

### Phase K — Behavior and UX (v0.8.x) ✅
- [x] Auto-refresh on owned items / weapon skill change (debounced 500ms).
- [x] Stale-plan indicator: banner when form is dirty since last Generate Plan.
- [x] Allocation consistency: Build Logic note, "Sync to plan" helper (I'm now level X), stats-match indicator.
- [x] Determinism test: `window.__sboRunDeterminismTest()` — plan Lv1→48, sync to Lv30, re-plan; assert Lv31–48 allocation matches.
- [x] Boss Planner: flush draft on Boss Planner nav click; storage listener for cross-tab updates; "Last synced" timestamp; stale build banner.
- [x] Boss Planner: "Refresh from Planner" promoted to primary button; needs-attention styling when build updated in another tab.

### Phase L — AI Integration (v0.9.x) ✅
- [x] Supabase Edge Function `sbo-ai-advisor` for AI proxy (Hugging Face Inference API).
- [x] System prompt with SBO:R formulas, stat meanings, equipment rules, boss readiness logic.
- [x] "Ask about your build" chat panel in planner (collapsible subpanel).
- [x] Build context: level, stats, gear, plan summary, top recommendations passed to Edge Function.
- [x] Rate limiting (20 req/min per IP) and error handling.
- [x] AI_SETUP.md and config.example.js for deployment.

### Phase I — Future Ideas (v0.7.x+)
- [x] Dark mode toggle: CSS variable swap for a dark theme (v0.7.5/v0.7.6).
- [x] Wiki extraction script: MediaWiki API–based extractor for weapons, armor, shields, bosses, core pages (free, no auth); see `sbo-rebirth-planner/scripts/README.md` and `data/wiki-raw/`.
- [x] Wiki diff utility (`wiki-diff.js`): compares wiki-raw with catalog, outputs `DIFF_REPORT.md` for manual catalog updates.
- [x] Supabase wiki sync: `wiki-to-supabase.js` + `supabase-schema.sql` — sync extracted wiki data to Supabase (optional).
- [ ] Supabase: cloud-saved builds, shared build gallery (project configured; see `sbo-rebirth-planner/SUPABASE_SETUP.md`).
- [ ] Mobile swipe navigation: swipe left/right between input and output panels on phones.
- [ ] Party builder: plan 4-player party compositions with role coverage indicators.
- [ ] Item detail modal: click any gear card to see full item stats, source, floor, and wiki link.
- [ ] Skill tree visualizer: graphical tree view of sword skill unlocks per class.

### Optimization backlog (Phase E - ongoing)
- [x] Add optional budget cap input and "budget-aware" recommendation mode.
- [x] Add strict budget filter mode that excludes over-cap recommendations.
- [x] Add budget status visibility per item (within cap / over cap) and over-budget flag pills.
- [x] Add item blacklist / avoid-list controls so users can exclude disliked pieces from recommendations.
- [x] Add optional minimum survivability guardrails (target DR / HP floor) to constrain stat allocation plans.
- [x] Add optional minimum DPS guardrails so defensive/farming profiles never undercut damage progression floor.
- [x] Add explicit minimum Bonus HP guardrail input and penalty support in allocation scoring.
- [x] Persist optimization filters (budget/avoid/guardrails) in draft + preset save/load snapshots.
- [x] Expose optimization filter state in Build Logic and recommendation meta summaries.
- [x] Add evaluation memoization cache for allocator score checks to reduce repeated compute cost.
- [x] Add owned inventory parser helper (paste multiline inventory list -> auto-tokenize, deduplicate, and merge into owned field).
- [x] Add recommendation diff mode (ATK/DEF/DEX delta vs currently equipped item shown inline on each gear card).
- [x] Add projected breakpoint annotations in level table (DEF DR bands, stamina thresholds, multi-hit cap, debuff res cap, AGI speed milestone).
- [x] Add per-slot upgrade-path timeline (chronological item unlock list per slot across planned level range, with Available/Lv N tags and owned/equipped indicators).
- [x] Add lightweight benchmark panel (projected DPS, DR, Bonus HP, Stamina, Crit%, Multi-hit at 25%/50%/75%/end milestones with delta annotations).
- [x] Add strict deterministic tie-break sort for gear recommendations (secondary: colValue asc, tertiary: id alphabetical).
- [x] Correct multi-hit formula from wiki: base 50% (not 0%), STR/LUK each add up to +10%, combined bonus capped at +15% → total 65% max.
- [x] Correct crit damage formula from wiki: critDmg = (base × critMulti) + (base × STRmulti), STRmulti scales 0–2 with STR invested.
- [x] Expose defMultiplierBase and vitDexterityMultiplierBase as named constants in data.js formulas block.
- [x] Fix breakpoint annotations to reflect corrected multi-hit thresholds (60% and 65% milestones).
- [x] Add AGI speed tier breakpoints at 25%/50%/75% of max gain (per weapon class).
- [x] Add STR damage milestone breakpoints (+50%/+100%/+150%/+200% thresholds).
- [x] Add VIT DEX multiplier milestone breakpoint (VIT 250 = halfway to max multiplier).
- [x] Add item-unlock annotations in level table: blue pills when levelReq is crossed for armor/headwear/shield.
- [x] Fix weapon unlock annotations: weapons gate on skillReq (static), not levelReq — annotate available weapons on plan row 1.
- [x] Add Atk Speed row to benchmark panel (AGI-scaled attack speed % at each milestone).
- [x] Add Pts Used row to benchmark panel (total stat points spent + % of 2500-point cap).
- [x] Bump planner to v0.2.0 — show version in page title and subtitle.
- [x] Add per-stat cap progress bars to benchmark panel (STR/DEF/AGI/VIT/LUK colored fill bars vs 500 cap).
- [x] Add Col cost badge per slot in upgrade timeline (sum of upcoming items' colValue).
- [x] Add grand total Col cost banner above upgrade timeline slots.
- [x] Add Points Remaining to Build Logic panel (total pts free + per-stat headroom to 500 cap).
- [x] Add Build Cost Summary panel (top-pick per slot with List Price / To Buy columns, owned/equipped detection, savings note).
- [x] Fix "Available weapon:" pills not receiving unlock-pill CSS class (startsWith check was too narrow).
- [x] Add URL-based build sharing: "Copy Share Link" button encodes form state into URLSearchParams; applyUrlShareParams restores form on page load from shared URL.
- [x] Add Gear row to benchmark panel: shows best available item per slot at each milestone level, with E/O badges for equipped/owned.
- [x] Add inline SVG favicon (sword icon, teal on dark) to eliminate 404 console error.
- [x] Bump planner to v0.3.0 — title, subtitle, and data.js.
- [x] Add collapsible Stat Reference panel (wiki-accurate, closed by default): covers all 5 investible stats, gear stats (ATK/DEF/DEX), Stamina, Multi-hit, Crit, Resistances with formulas and source links.
- [x] Fix crit multipliers for all weapon profiles to match wiki: 2H ×1.5 (was correct), 1H ×2.0, Rapier ×2.4, Dagger ×2.7, Melee ×3.0 (all were incorrectly ×1.5).
- [x] Add Melee weapon profile to data.js (fastest attack speed, lowest attack, ×3.0 crit).
- [x] Replace DEF breakpoints (every 25 pts) with meaningful ×multiplier milestones every 100 pts (×6/×7/×8/×9/×10).
- [x] Improve DR benchmark label to 'DR (flat)' with integer toLocaleString formatting and per-metric minDelta threshold to suppress +0 deltas.
- [x] Update stat reference panel crit entry with per-class multiplier table.
- [x] Add swordSkillUnlocks table to data.js (per-class, wiki-sourced): 2H/1H/Rapier/Dagger/Dual/Melee with exact skill thresholds.
- [x] Fix One-Handed skill names: Sharp Nail (not Horizontal) — corrected in data.js and stat reference panel.
- [x] Add sword skill unlock breakpoint annotations on plan row 1 (shows all skills user currently has unlocked for their weapon class).
- [x] Move Fists + Easter Royale Gauntlets from dual-wield to melee class in data.js.
- [x] Add Sword Skills section to stat reference panel: per-class columns with skill-req badges, Dual Blades passive note.
- [x] Clarify dual-wield architecture: it is a 1H sub-mode (Dual Blades passive at skill 200), not a separate weapon class; isWeaponClassCompatible already allows 1H items for dual-wield.
- [x] Add describeSwordSkillProgress helper — Build Logic now shows all currently unlocked skills + next target (e.g. "Skill 25: Reaver, Avalanche — next: Avalanche II at skill 75 (need +50 more)").
- [x] Add .skill-pill CSS class (purple/violet) to distinguish sword skill annotations from item unlock pills (blue) and stat breakpoints (grey).
- [x] Fill Rapier catalog gaps: added 21 new wiki-exact entries covering skill 13–165 (Noble Rapier Mk II, GrandMaster Steel Rapier, Corruption Stinger, Tree Branch Rapier, Swamp Striker, GrandMaster Mk III, Desert Striker, Malachite Rapier, Mirror Rapier, Frostberge Skewer, Sandstorm Rapier, Molten Lance, Permafrost Rapier, Timberland Striker, Demonic Rapier, Shadow Striker, Deaths Kiss, Ancient Maiden, Deepsea Challenger, Aquatic Striker).
- [x] Fill Dagger catalog gaps: added 20 new wiki-exact entries covering skill 13–165 (Master Steel Dagger Mk II, GrandMaster Steel Dagger, Corruption Carver, Moras Edge, GrandMaster Mk III, Deserts Fury, Malachite Dagger, Mirror Dagger, Crystalized Edge, Sandstorm Dagger, Molten Thief, Permafrost Dagger, Eternal Shard, Demonic Dagger, Shadow Void, Tourmaline Edge, Ancient Assassin, Deepsea Crescent, Aquatic Dagger).
- [x] Bump planner to v0.3.1.
- [x] Fill 2H catalog gaps: added 18 wiki-exact entries covering skill 13–165 (Master Steel Mk II, Corruption Buster, GrandMaster Mk II/III, Glade Striker, Lightning Edge, Legendary Malachite Blade, Malachite Greatsword, Legendary Stalhrim Blade, Sandstorm Buster, Infernal Cleaver, Permafrost Greatsword, Shiek Greatsword, Yukkis Mourne, Demonic Greatsword, Shadow Destroyer, Wretched Greatsword, Ancient Berserker, Aqua Buster).
- [x] Fill 1H catalog gaps: added 16 wiki-exact entries covering skill 18–165 (GrandMaster Mk II, Corruption Slicer, Dark Repulser, Volcanic Blade, Permafrost Sword, Chimera, Gran, Demonic Blade, Shadow Eater, Green Flame Sword, Ancient Warrior, Shadow Guardian, Dark Repulser Mk II, Deepsea SwiftBlade, Aqua Blade, Butterfly Blade, Stalhrim Blade).
- [x] Add post-165 entries for all 4 classes (skill 170–205): Kamikaze Katana, Atlantic Destroyer, Shadow Edge, Doomed Treasure, Forest Buster (2H); Butterfly Katana, Poseidons Repulser, Crimson Shadow, Dark Repulser Mk III, Vindictus Blade, Forest Warrior (1H); Butterfly Katana, Poseidons Repulser, Crimson Shadow, Vindictus Rapier, Forest Striker (Rapier); Butterfly Katana, Poseidons Edge, Crimson Void, Shadow Fang, Forest Edge (Dagger).
- [x] Add Floor 18 dungeon weapons for all 4 classes: Executioner Buster (2H), Enforcer Blade (1H), Sentry Sting (Rapier), Catchblade (Dagger) — all skill 330, 95700 Col.
- [x] Add dungeon source type (quality 1.24) to sourceQuality table — gated behind dungeon completion, between boss (1.2) and crafted (1.28).
- [x] Fix Floor 18 scoring: dungeon weapons now correctly top their class at skill 330 / floor 18 (Executioner Buster score 8.009 vs Ancient Berserker 6.632).
- [x] Add describeItemLocation case for dungeon source type ("Floor 18 dungeon shop").
- [x] Bump planner to v0.3.2.
- [x] Fill mid-tier catalog gap (skill 205–305, Floors 12–16) for all 4 classes — 6 entries per class (mob/crafted/boss/shop variety at each floor tier): Iron Colossus/Volcanic Buster/Crimson Titan/Thunder Buster/Obsidian Destroyer/Void Cleaver (2H); Iron Guardian/Volcanic Blade/Crimson Edge/Thunder Blade/Obsidian Edge/Void Blade (1H); Iron Lance/Volcanic Rapier/Crimson Lance/Thunder Rapier/Obsidian Lance/Void Rapier (Rapier); Iron Fang/Volcanic Dagger/Crimson Fang/Thunder Dagger/Obsidian Fang/Void Dagger (Dagger).
- [x] Bump planner to v0.3.3.
- [x] Fix schema duplicate ID: w-volcanic-blade (skill 90 boss drop) conflicted with new mid-tier Volcanic Blade Mk II (skill 230 crafted) — renamed to w-volcanic-blade-mk2.
- [x] Add colValue pricing to all new post-165 and mid-tier entries (skill 165–305) across all 4 classes — interpolated between Stalhrim (59,391) and Sweet (88,392) anchors.
- [x] Add Weapon Skill Path panel — compact horizontal upgrade roadmap showing best weapon per 25-skill tier for the user's class; cards highlight past (dimmed), current (teal border), and future tiers; color-coded source badges (crafted/boss/mob/shop/dungeon); Col price shown per card; scrollable on narrow viewports.
- [x] Bump planner to v0.3.4.
- [x] QoL UI polish pass (v0.3.5): comprehensive visual refresh across all panels — refined CSS design tokens (tighter shadows, consistent border-radius vars), header subtitle now inline with accent left-border, form section headers upgraded to uppercase teal labels with gradient rule, summary cards gained teal top-bar accent + uppercase labels + Space Grotesk values, subpanels gained teal left-bar accent on h3, Build Logic list items styled as individual teal-bordered cards with bold key labels, meta/recommendation cards upgraded with uppercase teal headers + shadow, output toolbar given a contained background pill, gear slot cards redesigned with full-width teal gradient header + hover-lift list items, timeline slots and grand-total banner polished, Weapon Skill Path cards refined with hover lift + stronger current-tier glow, chip buttons and pills refined with shadow and better hover states, equipped loadout panel given subtle gradient background, table headers upgraded to uppercase teal with sticky positioning and row hover highlight.
- [x] Bump planner to v0.3.5.

### Backlog (Polish & Maintenance)
- [x] Automation / test IDs: add data-testid to key buttons and inputs for browser automation.
- [x] Restore hidden panels: Weapon Skill Path, Skill Checklist, Level-Up Planner, Party Role Advisor, Build Cost Summary as collapsible subpanels.
- [x] Boss planner robustness: guard phases/resistances; clarify survivability unknown vs not ready.
- [ ] Shared formula module: extract boss + build planner formula logic to avoid duplication.

---

## 5) Data model checklist

- [x] PlayerState model drafted.
- [x] Item model drafted.
- [x] Source/scaling taxonomy added.
- [x] Add formal schema validation (runtime schema validator + UI status panel in `app.js`; future optional JSON Schema export).

```text
PlayerState:
  level
  maxFloorReached
  stats: STR, DEF, AGI, VIT, LUK
  weaponClass
  weaponSkill
  playstyle

Item:
  id, name, slot
  weaponClass(optional)
  sourceType(shop/mob/boss/crafted/event/badge/gamepass/quest)
  floorMin, levelReq, levelReqMax(optional), skillReq, skillReqMax(optional)
  scalingType(fixed/level_1/level_5/skill_1/skill_5)
  attack/defense/dexterity or min-max scaling pairs (attackMin/attackMax, defenseMin/defenseMax, dexterityMin/dexterityMax)
  resistances(optional)
  tags
  exactStats(optional boolean)
```

---

## 6) Risk checklist

- [x] Risk identified: wiki extraction misses some numeric tables.
- [x] Mitigation in place: editable local data pack and confidence labels.
- [x] Risk identified: edge-case formula mismatch vs in-game behavior.
- [x] Mitigation added: calibration mode using observed combat outcomes (experimental, local storage).
- [x] Risk identified: event/premium items can skew recommendations.
- [x] Partial mitigation in place: standard pool mode + owned-item controls.

---

## 7) Research source checklist

- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Stats
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Armor
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Upper_Headwear
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Lower_Headwear
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Shields
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Gamepass_and_Badge_Equipment
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Iron_Greatsword
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Steel_Greatsword
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Beginner_Armor
- [x] https://swordbloxonlinerebirth.fandom.com/wiki/Fields_Warrior
