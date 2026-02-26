# SBO:Rebirth Planner Scripts

## Wiki Extraction (`wiki-extract.js`)

Extracts SBO:Rebirth wiki data via the **MediaWiki API** — free, no authentication required.

### Requirements

- Node.js 18+ (uses built-in `fetch`)
- No npm dependencies

### Usage

```bash
node scripts/wiki-extract.js
```

### Output

Writes to `data/wiki-raw/`:

| File | Contents |
|------|----------|
| `weapons.json` | Parsed `{{Weapon}}` templates from Category:Weapons |
| `armor.json` | Parsed `{{Armor}}` templates from Category:Armor |
| `shields.json` | Parsed `{{Armor}}` templates from Category:Shields |
| `bosses.json` | Parsed `{{Mobs}}` templates from Category:Boss and Category:Miniboss |
| `stats-page.json` | Core pages (Stats, Two-Handed, Armor, etc.) with parsed tables and wikitext |

### Rate limiting

- 1.5 s delay between API batches
- Retries with exponential backoff on 429/5xx
- Logs to `wiki-extract.log`

### Workflow

1. `node scripts/wiki-extract.js` — fetch wiki data
2. `node scripts/wiki-diff.js` — compare with catalog, output `data/wiki-raw/DIFF_REPORT.md`
3. Review DIFF_REPORT, manually update `data.js` or `boss-data.js`
4. Optionally: `node scripts/wiki-to-supabase.js` — sync to Supabase

---

## Wiki Diff (`wiki-diff.js`)

Compares wiki-raw JSON with `data.js` and `boss-data.js`, outputs a markdown report.

```bash
node scripts/wiki-diff.js
```

Writes `data/wiki-raw/DIFF_REPORT.md` with NEW (in wiki, not catalog), CHANGED (stats differ), and IN_CATALOG_ONLY items. Run after `wiki-extract.js`.

---

## Supabase Sync (`wiki-to-supabase.js`)

Syncs wiki-raw data to Supabase tables. Requires `.env` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**First time:** Run `supabase-schema.sql` in Supabase Dashboard → SQL Editor to create tables.

```bash
node scripts/wiki-to-supabase.js
```

Upserts into `wiki_weapons`, `wiki_armor`, `wiki_shields`, `wiki_bosses`.

---

## DPO Dataset Generator (`generate-dpo-dataset.js`)

Generates a DPO (Direct Preference Optimization) training dataset from `boss-data.js` and `data.js`. Output is TRL-compatible JSON for fine-tuning the AI advisor.

```bash
node scripts/generate-dpo-dataset.js
```

**Output:** `scripts/sbo-dpo-dataset.json` — preference pairs (prompt, chosen, rejected) for boss facts, stat formulas, and build advice.

---

### Parse helpers (`parse-templates.js`)

Shared parsers for MediaWiki wikitext:

- `parseTemplate(wikitext, name)` — extract template params
- `parseWikitable(wikitext)` — parse `{| |}` tables
- `parseWeaponTemplate`, `parseArmorTemplate`, `parseMobsTemplate` — item-specific parsers
