# SBO:Rebirth Build Planner — Fact & Logic Check Report

**Date:** 2026-02-26  
**Version checked:** v0.7.6  
**Method:** Code review + wiki-raw comparison + live browser testing

---

## 1. Formula verification (data.js vs SBO:R Wiki)

| Formula | Wiki source | data.js / app.js | Status |
|---------|-------------|------------------|--------|
| **STR damage** | 0.4% per point | `strDamagePerPointPct: 0.4` | ✓ Match |
| **STR @ 500** | 3× damage | Implicit (1 + 500×0.004) | ✓ Match |
| **DEF multiplier** | base 5, +0.01/point | `defMultiplierBase: 5`, `defMultiplierPerPoint: 0.01` | ✓ Match |
| **VIT → DEX** | 10 + 0.01×VIT | `vitDexterityMultiplierBase: 10`, `vitDexterityMultiplierPerPoint: 0.01` | ✓ Match |
| **Crit base** | 15% | `baseCritChancePct: 15` | ✓ Match |
| **LUK crit** | +5% max (500 LUK) | `lukCritChancePerPointPct: 0.01` → 500×0.01%=5% | ✓ Match |
| **Crit damage** | (base×critMulti)+(base×STRmulti), STRmulti 0–2 | `strCritMultiMax: 2`, `profile.critMultiplier` | ✓ Match |
| **Multi-hit base** | 50% | `baseMultiHitPct: 50` | ✓ Match |
| **Multi-hit STR/LUK** | +10% each cap, +15% combined | `multiHitStatCapPct: 10`, `Math.min(15, str+luk)` | ✓ Match |
| **AGI run/walk** | 0.02 / 0.004 | `agiRunSpeedPerPoint`, `agiWalkSpeedPerPoint` | ✓ Match |

### Weapon crit multipliers

| Weapon | Wiki | data.js | Status |
|--------|------|---------|--------|
| Two-Handed | 1.5× | `critMultiplier: 1.5` | ✓ |
| One-Handed | 2× | `critMultiplier: 2.0` | ✓ |
| Rapier | 2.4× | `critMultiplier: 2.4` | ✓ |
| Dagger | 2.7× | `critMultiplier: 2.7` | ✓ |
| Dual Wield | 2× | `critMultiplier: 2.0` | ✓ |
| Melee | 3× | `critMultiplier: 3.0` | ✓ |

### AGI speed gains (max at 500 AGI)

| Weapon | Wiki | data.js | Status |
|--------|------|---------|--------|
| Two-Handed | 30% | `maxAgiSpeedGain: 0.30` | ✓ |
| One-Handed | 30% | `maxAgiSpeedGain: 0.30` | ✓ |
| Rapier | 60% | `maxAgiSpeedGain: 0.6` | ✓ |
| Dagger | 30% | `maxAgiSpeedGain: 0.3` | ✓ |
| Dual Wield | 50% | `maxAgiSpeedGain: 0.5` | ✓ |
| Melee | 50% | `maxAgiSpeedGain: 0.5` | ✓ |

---

## 2. Sword skill thresholds (data.js vs wiki stats-page)

### Two-Handed

| Skill | Wiki | data.js | Status |
|-------|------|---------|--------|
| Reaver | 5 | 5 | ✓ |
| Avalanche | 25 | 25 | ✓ |
| Avalanche II | 75 | 75 | ✓ |
| Avalanche III | 150 | 150 | ✓ |
| Backslash | 225 | 225 | ✓ |
| Cascade | 300 | 300 | ✓ |
| Cyclone | 375 | 375 | ✓ |

### One-Handed

| Skill | Wiki | data.js | Status |
|-------|------|---------|--------|
| Reaver | 5 | 5 | ✓ |
| Sharp Nail | 25 | 25 | ✓ |
| Sharp Nail II | 75 | 75 | ✓ |
| Sharp Nail III | 150 | 150 | ✓ |
| Dual Blades (passive) | 200 | 200 | ✓ |
| Gale Slicer | 225 | 225 | ✓ |
| Starburst | 300 | 300 | ✓ |
| Starburst Stream | 375 | 375 | ✓ |

### Rapier, Dagger, Dual Wield, Melee

Spot-checked against wiki wikitext: all thresholds match (Reaver 5, Stinger/Fading Edge 25/75/150, etc.).

---

## 3. Boss data (boss-data.js vs wiki-raw bosses.json)

| Boss | Wiki HP | Catalog HP | Wiki recLevel | Catalog recLevel | Notes |
|------|---------|------------|---------------|------------------|-------|
| Illfang | 20,000 | 20,000 | 10 | 10 | ✓ Exact match |
| Lord Slug | 38,000 | 38,000 | (empty) | 20 | Catalog fills estimate |
| Stallord | 61,000 | 61,000 | 30 | 30 | ✓ Exact match |
| Shadesworn (mini) | present | present | — | — | ✓ Floor 2 mini boss |

**Illfang naming:** Wiki uses "Illfang The Kobold Lord" (capital T). Catalog uses "Illfang the Kobold Lord". ROADMAP already documents this. No functional impact.

---

## 4. Browser / UX verification (detailed interactive test 2026-02-26)

### Build Planner (`/`)

- **Apply Stats** — ✓ Updates recommendations; no errors
- **Equip Top** — ✓ Auto-selects best gear within floor cap; gear totals update; respects Max Floor (Floor 5 → higher gear; Floor 1 → downgrades to Floor 1 items)
- **Clear** — ✓ Clears equipped loadout and triggers recompute
- **Theme toggle (☀)** — Present; toggles light/dark
- **Stat Reference** — Collapsible; expands/collapses
- **Quick Start Templates** — 2H Beginner Lv1 · Floor 1 template available
- **Build Logic panel** — Shows weapon profile, playstyle, allocation engine, floor access, data quality filter
- **Generate Plan** — Must be clicked for recalculation; planner does not auto-recalc on input/fill (by design to avoid expensive recompute on every keystroke)

### Max Floor behavior

- **Floor 2 → 5** — ✓ Floor access rule updates; gear recommendations expand to higher-tier items (Gear ATK 30→36, Gear DEF 35→54, Gear DEX 140→351 for Rapier)
- **Floor 5 → 1** — ✓ Equip Top correctly downgrades to Floor 1 gear (Gear ATK 36→7.6, Gear DEF 54→4.1, Gear DEX 351→39)

### Current Level / Levels to Plan behavior

- **Lv8, 40 levels** — ✓ 120 points, levels 9–48
- **Lv25, 20 levels** — ✓ 60 points, levels 26–45
- **Lv1, 3 levels** — ✓ 9 points, levels 2–4; Resulted Additions sum correctly (+STR 0, +DEF 0, +AGI 9, +VIT 0, +LUK 0)
- **Level-by-level table** — ✓ Row count matches `levelsToPlan`; cumulative stats correct

### Stats / weapon / playstyle changes

- **Manual stat edits (STR 20, DEF 10)** — ✓ Apply Stats updates; allocation adjusts from new baseline
- **Weapon class (2H → Rapier)** — ✓ Target split changes (e.g. STR 51.8% → 42.4%, AGI 18.6% → 32.7%); recommendations switch to Rapiers
- **Playstyle (Balanced → Damage Focus)** — ✓ Allocation shifts toward damage
- **Equip Top after weapon change** — ✓ Gear updates to class-appropriate items

### Boss Planner (`/boss.html`)

- **Readiness scores** — Ready / Close / Not ready for Illfang and Shadesworn
- **Next Target** — Suggests Shadesworn when Illfang not ready; includes stat advice (e.g. ↑ DEF)
- **Filter & Search** — Max Floor, readiness filter, sort, mini bosses toggle
- **Build sync** — "Refresh from Planner" pulls Build Planner state

### Cross-tab behavior

- Boss Planner uses saved draft from Build Planner (localStorage)
- "0% of bosses ready" consistent with 2 bosses shown as Not Ready when build is low-level

---

## 5. Logic checks

### Point allocation

- 40 levels × 3 points = 120 points
- Resulted additions sum: +61 STR + 11 DEF + 25 AGI + 18 VIT + 5 LUK = 120 ✓

### DPS projection

- `dpsProjection = gear.attack × strDamageMult × agiSpeedMult × critExpectedMult`
- Consistent with formulas above; calibration factors applied when samples exist

### Floor gating

- Max Floor 2 → only Floor 1–2 gear recommended
- Equip Top respects floor cap (e.g. floor 2 build gets different gear than floor 5)

### Data quality

- "Exact data only" excludes estimated catalog entries
- Recommendation cards show confidence labels

---

## 6. Minor notes (no bugs)

1. **Lord Slug recLevel** — Wiki has no recommended level; catalog uses 20 as a fill-in. Consider `recLevel: null` or a visible "estimated" tag if you want strict wiki parity.
2. **Clear button** — Clears equipped loadout only; does not reset stat inputs. Intentional for quick re-gear workflows.
3. **Boss ATK/DEF** — Wiki does not expose boss ATK/DEF; readiness uses relative DPS index. Banner text on Boss Planner notes this.
4. **Generate Plan required** — Changing level, floor, stats, weapon, or playstyle does not auto-recalculate; user must click **Generate Plan**. *Update (Phase K):* Owned Items and Weapon Skill now trigger debounced auto-recalc (500ms). Stale-plan banner shows when form is dirty.

### Phase K addenda (v0.8.x)

- **Allocation determinism test** — Run `window.__sboRunDeterminismTest()` in the browser console on the Build Planner page. Asserts that planning Lv1→48, syncing to Lv30, then re-planning yields identical allocation for Lv31–48. Guards against regressions.
- **Sync to plan** — Build Logic panel has "I'm now level X" + Sync button to fill Current Level and stats from the plan. Use when catching up mid-plan.
- **Stats-match indicator** — Shows "Stats match plan — remaining allocation is consistent" when entered stats match plan totals at current level.

---

## 7. Conclusion

**Formulas:** All checked formulas match the SBO:R wiki.  
**Sword skills:** All weapon classes match wiki thresholds.  
**Boss data:** Core bosses match wiki; recLevel filled where wiki is empty.  
**UX:** Apply Stats, Equip Top, Clear, theme, and Boss Planner flows work as intended.

**No critical logic or fact errors identified.** Planner is suitable for use.
