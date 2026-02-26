# SBO:Rebirth Boss Planner — QoL Roadmap

## Status Key
- ✅ Done
- 🔄 In Progress
- ⬜ Pending

---

## v0.6.8 — Data, Cards & Filters ✅
- ✅ **Add `location` field to all bosses & mini bosses** — sourced from wiki infoboxes where available
- ✅ **Add `respawnTime` field to all bosses & mini bosses** — corrected from wiki (floor bosses: 180s–3min, NOT 20min)
- ✅ **Add `estimateNote` field** — specific per-boss note explaining what is estimated and why
- ✅ **Show location on boss card** — 📍 below name, muted small text
- ✅ **Show location in modal header** — under boss name
- ✅ **Fix floor badge for stubs** — floor 0 → shows "Floor ?" instead of "Floor 0"
- ✅ **Show respawn time in modal stats grid**
- ✅ **Show ⚠ Estimated tag on card** — with tooltip showing the specific estimate note
- ✅ **Show estimate warning banner in modal** — yellow banner with exact note when `exactStats: false`
- ✅ **Search/filter by name** — real-time text input
- ✅ **Filter toggle: show/hide mini bosses** — checkbox in sidebar
- ✅ **Sort options** — Floor (default), HP asc/desc, Readiness score
- ✅ **Persist filter state** — saved to localStorage
- ✅ **Count summary toolbar** — "Showing X floor bosses, Y mini bosses"
- ✅ **Readiness pills** — coloured ✓ Ready / ~ Close / ✗ Not Ready / ? Unknown counts
- ✅ **Card fade-in animation** — staggered for first 12 cards
- ✅ **Status effect check in readiness engine** — uses `boss.statusEffect` field directly
- ✅ **Drop bonus display in modal** — shows LUK-based drop bonus %
- ✅ **Prev/Next boss navigation in modal**
- ✅ **Wiki link in modal footer** — "🔗 View on Wiki ↗"
- ✅ **Scroll to top on modal open/navigate**
- ✅ **Footer updated** — links to wiki, removes stale estimate note

### Data Accuracy Audit (post full wiki audit)
Bosses with **confirmed wiki data** (`exactStats: true`):
- **Floor bosses:** Illfang (F2), Lord Slug (F3), Stallord (F4), X'rphan (F5), Uakmaroth (F6), Storm Atronach (F7), Bonnz (F8), Karth'uk (F9), Hotoke (F10), Grimlock (F11), Slime Lord Pengonis (F12), The Tormented Soul (F13), Young Celestia (F14), Two-Headed Giant (F16), Captain Sweet (F17), The Frontman (F18), Eidolon (F18)
- **Mini bosses:** Shadesworn (F2), Father Shroom (F7), Guardian of the Gate (F9), Beatrice (F11), Buffed Knight (F11), Laurellis Convict (F12), Tormented Spectrum (F13), Elder Celatid (F14), Leader Grimm (F14), Super Luo (F14), Leader Goblin (F16), Thug Boss (F18), Loan Shark Boss (F18), The Custodian (F18), The Arbitrator (F18)

Bosses with **estimated/unknown data** (`exactStats: false`) — wiki pages return no content:
- **Floor bosses:** Laurellis the Purgatory Flax (F12) — wiki page empty
- **Mini bosses:** Rejected (F18) — all stats listed as ??? on wiki
- **Stubs (floor unknown):** Golgorossa, Raws, SortNena, Super Laz — no wiki data

Wiki URL quirks found and fixed:
- Illfang: page is `Illfang_The_Kobold_Lord` (capital T), not lowercase
- Karth'uk: page is `Karth%27uk_The_Crystal_Kraken` (capital T)
- Hotoke: page is `Hotoke_The_Enlightened` (capital T)
- Grimlock: page is `Grimlock_the_Fallen_King`
- Eidolon: page is `Eidolon_the_Gilded_Omen`

---

## v0.7.0 — Readiness Engine & Build Snapshot ✅
- ✅ **Stamina pool display** — shown in build snapshot metrics grid
- ✅ **Multi-hit % display** — shown in build snapshot metrics grid
- ✅ **Playstyle badge** — Damage / Speed / Tank / Farmer / Bruiser / Skirmisher / Balanced pill next to snapshot grid
- ✅ **Build strength bar** — coloured bar showing % of floor bosses ready
- ✅ **Next recommended boss** — "Next Target" row showing closest boss to tackle
- ✅ **No-build CTA** — prominent "Go to Build Planner →" button when no build loaded

---

## v0.7.1 — Modal Polish ✅
- ✅ **Keyboard navigation** — Left/Right arrow keys cycle between bosses while modal is open; Escape closes
- ✅ **Copy boss info button** — copies boss name, HP, drops, location, respawn, readiness to clipboard
- ✅ **Collapsible modal sections** — click Phases / Resistances / Drops title to collapse/expand with caret animation

---

## v0.7.2 — Card Layout Polish ✅
- ✅ **Readiness summary bar** — thin 4px coloured bar at very top of each card (green/orange/red/grey)

---

## v0.7.3 — Build Snapshot Polish ✅
- ✅ **Gear row** — show equipped weapon/armour names in snapshot as pill tags below stat row
- ✅ **Stat allocation advice** — yellow tip box below Next Target: suggests which stat to raise based on failing checks vs next boss

---

## v0.7.4 — Mobile Layout ✅
- ✅ **Sidebar collapse toggle** — "Build & Filters" button on mobile (≤860px) collapses/expands sidebar, caret animates
- ✅ **Stacked layout** — sidebar above boss list on ≤860px, `position: sticky` removed on mobile
- ✅ **Single-column cards** — boss list forced to 1 column on ≤540px
- ✅ **Filter card 2-col grid** — filter controls laid out in 2 columns on narrow screens
- ✅ **Modal sheet on mobile** — fills 96vh, anchored to bottom, reduced padding on ≤620px
- ✅ **Reduced page padding** — tighter gutters on small screens
- ✅ **Dark mode** — moved to v0.7.5 and implemented

---

## v0.7.5 — Dark Mode (auto only) ✅
- ✅ **`prefers-color-scheme: dark` auto detection** — dark palette applied from system setting
- ✅ **Dark token set** — `#0f1419` bg, `#1c2530` panels, `#dce8f0` ink, `#2ab5c5` teal accent
- ✅ **`--bg-panel` and `--bg-1` added to `:root`** — were previously missing from light theme definition

---

## v0.7.6 — Manual Dark/Light Toggle ✅
- ✅ **☀/🌙 toggle button in nav bar** — appears on both Build Planner and Boss Planner pages
- ✅ **localStorage persistence** — saved as `sbo-theme`, survives page reload and tab switches
- ✅ **FOUC prevention** — inline `<script>` in `<head>` applies `data-theme` before first paint
- ✅ **Three-state logic** — auto (system), manual dark, manual light; manual overrides system preference
- ✅ **Flat CSS selectors** — `[data-theme="dark"] .class` pattern; no CSS nesting, fully cross-browser
- ✅ **Button syncs to actual state** — shows 🌙 when light, ☀ when dark; updates on click

---

## Notes
- Netlify deploys paused — testing locally only until further notice
- Boss respawn times corrected: floor bosses are **180 seconds** (F4–F13) or **3 minutes** (F14+), not 20 minutes
- Bosses with empty wiki pages have HP/EXP/Col interpolated from the game's linear scaling formula
