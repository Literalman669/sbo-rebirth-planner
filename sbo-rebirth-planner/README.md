# SBO:Rebirth Build Planner (Prototype)

A local-first planner that helps with:
- stat point allocation over a chosen level window,
- equipment recommendations by slot,
- transparent recommendation logic.

## What this version does
- Inputs: current level, levels to plan, max floor reached, current stats, weapon class, playstyle, gear totals, weapon skill, data quality mode.
- Generates a per-level allocation table (3 points/level).
- Recommends top 3 equipment candidates per slot from a curated catalog.
- Restricts recommendations to items at or below your selected max unlocked floor.
- Supports owned-item tokens (by name or id) and an optional strict "only owned" recommendation mode.
- Adds confidence badges (`exact` vs `estimated`) per recommendation.
- Shows a top-level confidence/ownership summary for recommendation output.
- Supports local build presets (save, load, delete) in browser storage.
- Supports build export/import as JSON files.
- Supports side-by-side comparison for any two saved builds.
- Supports quick-equip workflow from recommendation cards (Equip, Add to Owned, Equip Top Recommendations, Clear Equipped).
- Supports equipped loadout tracking with optional auto-sync into gear totals (ATK/DEF/DEX).
- Supports auto-adding equipped items into the owned-item list.
- Supports pinned preset workflow (pin/unpin selected presets and optional pinned-only filter).
- Supports keyboard shortcuts for common actions (generate/save/load/equip/pin/collapse).
- Supports collapsible output panels and one-click copy of equipped loadout summary.
- Supports allocation profiles (Adaptive, Aggressive Damage, Defensive Core, Tempo + Utility).
- Shows allocation profile + target stat split percentages in Build Logic output.
- Uses requirement-fit and value-efficiency factors in equipment recommendation scoring.
- Surfaces richer equipment card info (location, value/price, and requirement range).
- Surfaces economy-fit summary in recommendation metadata.
- Supports budget-cap optimization filters (soft scoring mode or strict exclusion mode).
- Supports avoid-list filters (exclude specific items by id or name tokens).
- Supports optional minimum DPS/DR/HP guardrails to keep generated builds above target progression floors.
- Supports an experimental calibration mode (observed in-game sample -> multiplier adjustment).
- Supports calibration profile export/import as JSON files.
- Runs a startup catalog schema validator and shows pass/warn/error status in the input panel.
- Explains recommendation logic and projected metric changes.
- Persists the latest form draft locally between refreshes.

## Files
- `index.html` - UI layout
- `styles.css` - styling
- `data.js` - formulas, weapon profiles, playstyles, and item catalog
- `app.js` - planner engine + rendering

## How to run
No install is needed.

1. Open `index.html` directly in your browser.
2. Edit your inputs.
3. Click **Generate Plan**.

## Formula and data notes
This prototype is based on SBO:R mechanics gathered from public wiki sources:
- STR/DEF/AGI/VIT/LUK behavior
- Two-handed (greatsword) class context
- armor/headwear/shield behavior and scaling rules
- source quality trends (shop/mob/boss/crafted)

Current catalog status:
- core progression entries remain verified (`exactStats: true`),
- one-handed side-route progression (Floor 1-5 band) is now ingested with exact wiki-backed stats,
- rapier side-route progression is now ingested with exact wiki-backed stats,
- dagger side-route progression is now ingested with exact wiki-backed stats,
- dual-wield now includes dedicated exact melee entries (Fists + Easter Royale Gauntlet line) and can still fall back to one-handed for broader progression coverage,
- scaling equipment (badge/gamepass) uses wiki min/max stat ranges interpolated by level/skill,
- recommendation scoring combines stat power with source/scaling/requirement/value quality factors,
- recommendation scoring also supports budget-fit weighting when budget cap is provided,
- stat allocation scoring applies optional DPS/DR/HP floor penalties when guardrail targets are configured,
- `Data Quality Mode` defaults to `Exact data only`,
- optional calibration multipliers can tune DPS/survival/utility projections using observed runs.

Stat allocation details:
- allocation engine uses hybrid marginal-gain optimization,
- applies profile/playstyle target-share correction,
- runs one-step lookahead for cleaner next-point decisions,
- and supports mode-specific tuning through allocation profiles.

Runtime schema guard checks include:
- top-level formulas/profiles/playstyles/source/scaling maps,
- required item fields (id/name/slot/source/scaling/floor and class-specific reqs),
- scaling range consistency (`min <= max`, paired min/max fields),
- duplicate item ids and invalid enum values.

## Calibration mode (experimental)
Use this when your live-server outcomes differ from planner projections.

1. Fill the planner normally and click **Generate Plan**.
2. Enter observed values in **Calibration Mode**:
   - required: **Observed DPS Index**, **Observed Damage Reduction**
   - optional: **Observed Stamina Pool**, **Observed Crit Chance %**, **Observed Drop Bonus %**
3. Click **Apply Calibration Sample**.
4. Check **Calibration Report** to review multipliers and sample error deltas.
5. Use **Reset Calibration** to return to neutral (`x1.0`) factors.
6. Use **Export Calibration** / **Import Calibration** to share tuning across browsers/devices.

Calibration data is stored in browser local storage (`sbo-rebirth-planner.calibration.v1`).

## QoL features
- **Inventory parser**: paste a multiline or comma-separated item list to auto-tokenize and merge into the owned items field.
- **Recommendation diff mode**: each non-equipped gear card shows ATK/DEF/DEX deltas vs the currently equipped item in that slot.
- **Breakpoint annotations**: level table rows highlight when notable thresholds are crossed (DEF DR bands, stamina thresholds, multi-hit milestones, debuff resistance cap, AGI speed milestone).
- **Upgrade path timeline**: per-slot chronological list of items that unlock across your planned level range, tagged Available or Lv N.
- **Build benchmarks**: projected DPS, DR, Bonus HP, Stamina, Crit%, Multi-hit at 25%/50%/75%/end-of-plan milestones with delta annotations between columns.

## Formula accuracy (wiki-sourced)
Formulas verified against the [SBO:R wiki](https://swordbloxonlinerebirth.fandom.com/wiki/Stats):
- **Multi-hit**: base 50% chance; STR adds up to +10% (0.02%/pt), LUK adds up to +10% (0.02%/pt); combined bonus capped at +15% → max 65% total.
- **Crit damage**: `(base × critMultiplier) + (base × STRmulti)` where STRmulti scales 0–2 based on STR invested.
- **Defense**: `(5 + DEF × 0.01) × totalDefense` damage reduction per hit.
- **Dexterity/HP**: `(10 + VIT × 0.01) × totalDexterity` bonus HP.
- **Stamina**: `100 + level × 5 + 0.1 × (STR + AGI + VIT)`; max stat bonus is +150.
- **AGI speed gains**: 2H ~30%, 1H ~30%, Dagger ~30%, Dual ~50%, Rapier ~60%.

## Next steps
1. Gather real in-game samples and iterate calibration factors/weighting defaults.
2. Expand dual-wield progression coverage beyond current melee/event entries as additional wiki pages are published.
3. Add optional deployment target (hosted web version).
