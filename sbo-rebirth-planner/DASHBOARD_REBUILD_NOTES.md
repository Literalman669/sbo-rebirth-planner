# Dashboard Rebuild Notes (v0.9.4)

This document tracks the dashboard-first migration work introduced for the SBO planner refactor.

## Completed in this pass

- Shared projection module added: `shared/projection-core.js`.
- Build planner now consumes shared projection metrics in `app.js`.
- Boss planner now consumes shared projection metrics in `boss.js` (formula parity path).
- Dashboard shell prep:
  - `index.html` now uses `dashboard-shell` layout class.
  - Added owned inventory manager UI controls (`ownedInventorySearch`, `ownedInventoryList`, bulk add/clear actions).
  - Added gear compare drawer (`gearCompareDrawer`, `gearComparePanel`).
- Gear recommendation explainability:
  - Rationale chips for requirement fit, value efficiency, ownership, and confidence.
  - Compare action on recommendation cards.
- Data governance:
  - `scripts/wiki-sync-apply.js` now writes:
    - `data/wiki-raw/WIKI_SYNC_REPORT.md`
    - `data/wiki-raw/WIKI_SYNC_REPORT.json`
  - Accepted/rejected ingest accounting with sanity checks.
- Verification coverage expanded:
  - `test-planner.js` now checks shared projection module load and Floor 19 data presence for items and bosses.

## Follow-up migration checkpoints

1. Split `app.js` into smaller domain and renderer modules while preserving existing IDs.
2. Replace free-text owned item entry as primary with structured inventory model.
3. Move compare drawer from proof-of-concept to a full side-by-side gear explorer with sorting.
4. Consolidate boss/build storage synchronization into one adapter contract.
5. Add CI checks for wiki sync report deltas and rejection thresholds.

## Validation commands

```bash
node scripts/wiki-sync-apply.js
node test-planner.js
```
