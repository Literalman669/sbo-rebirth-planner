---
name: item-catalog-update
description: Adds or updates items in the SBO:Rebirth Build Planner item catalog. Use when adding new weapons, armor, shields, headwear, or updating existing catalog entries in data.js.
---

# Item Catalog Update

## Steps

1. Use existing catalog entries as templates — copy structure for same slot and sourceType
2. **id**: lowercase, hyphens, prefix by slot (`w-`, `a-`, `u-`, `l-`, `s-`)
3. Set `exactStats: true` only when stats come from wiki or verified source
4. After edits: run `node --check data.js` (from `sbo-rebirth-planner/`)
5. Open planner in browser; confirm validator status panel shows pass

## Slot Prefixes

- weapon → `w-`
- armor → `a-`
- upper → `u-`
- lower → `l-`
- shield → `s-`

## Validation Checklist

- [ ] Unique id (grep catalog for duplicates)
- [ ] Required fields: id, name, slot, sourceType, floorMin, scalingType
- [ ] Valid sourceType and scalingType enums
- [ ] For scaling items: min ≤ max for paired stat fields
