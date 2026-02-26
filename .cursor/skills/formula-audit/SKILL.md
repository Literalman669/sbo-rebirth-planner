---
name: formula-audit
description: Verifies formula changes against SBO:Rebirth wiki and calibration. Use when modifying damage, defense, stamina, crit, or multi-hit formulas in data.js or app.js.
---

# Formula Audit

## Wiki Reference

https://swordbloxonlinerebirth.fandom.com/wiki/Stats

## Key Formulas

- **Multi-hit**: base 50%; STR +10% (0.02%/pt); LUK +10% (0.02%/pt); combined cap +15% → max 65%
- **Crit damage**: `(base × critMultiplier) + (base × STRmulti)`; STRmulti 0–2 by STR
- **Defense**: `(5 + DEF × 0.01) × totalDefense`
- **Dexterity/HP**: `(10 + VIT × 0.01) × totalDexterity`
- **Stamina**: `100 + level × 5 + 0.1 × (STR + AGI + VIT)`; max stat bonus +150

## Calibration

Calibration multipliers in app.js override projections. Document formula changes in changelog; note if calibration impact is expected.
