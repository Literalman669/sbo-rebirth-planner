---
name: wiki-extract-ingest
description: Runs SBO:Rebirth wiki extraction and ingests parsed data into data.js or boss-data.js. Use when updating item catalog from wiki, syncing weapons/armor/shields/bosses from MediaWiki, or refreshing wiki-raw JSON.
---

# Wiki Extract and Ingest

## Workflow

1. **Run extraction**: `node scripts/wiki-extract.js` (from `sbo-rebirth-planner/`)
2. **Check logs**: Review `scripts/wiki-extract.log` for errors
3. **Compare output**: Inspect `data/wiki-raw/*.json` vs current catalog in `data.js` / `boss-data.js`
4. **Map fields**: weaponType → weaponClass, skill_level → skillReq, damage → attack, etc.
5. **Add items**: Insert with `exactStats: true`; ensure unique `id` (e.g. `w-butterfly-blade`)
6. **Verify**: Open index.html; confirm schema validator status panel shows pass

## Field Mapping (wiki-raw → Item)

| wiki-raw | Item field |
|----------|------------|
| weaponType | weaponClass (array) |
| skill_level | skillReq |
| damage | attack |
| col_value | colValue |
| location | derive sourceType, floorMin |

## Tips

- Resolve ID conflicts (e.g. `w-volcanic-blade` vs `w-volcanic-blade-mk2`) before merge
- Use `parseWeaponTemplate`, `parseArmorTemplate`, `parseMobsTemplate` from parse-templates.js when extending extraction
