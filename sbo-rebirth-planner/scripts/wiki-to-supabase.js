#!/usr/bin/env node
/**
 * Sync wiki-raw JSON to Supabase tables.
 * Requires .env with SUPABASE_URL and SUPABASE_ANON_KEY.
 * Run supabase-schema.sql in Supabase Dashboard first.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WIKI_RAW = path.join(ROOT, 'data', 'wiki-raw');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env. Create from .env.example and set SUPABASE_URL, SUPABASE_ANON_KEY.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

async function supabaseFetch(url, key, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${res.status}: ${text}`);
  }
  return res;
}

async function upsertTable(baseUrl, key, table, rows, mapRow, conflictCol = 'name') {
  const url = `${baseUrl}/rest/v1/${table}?on_conflict=${conflictCol}`;
  const batchSize = 100;
  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(mapRow).filter(Boolean);
    if (batch.length === 0) continue;
    await supabaseFetch(url, key, 'POST', batch);
    count += batch.length;
    process.stdout.write(`  ${table}: ${count}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${count} rows`);
}

function main() {
  const env = loadEnv();
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const read = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(WIKI_RAW, f), 'utf8'));
    } catch (e) {
      console.warn(`Could not read ${f}:`, e.message);
      return null;
    }
  };

  const weapons = read('weapons.json');
  const armor = read('armor.json');
  const shields = read('shields.json');
  const bosses = read('bosses.json');

  if (!weapons?.items?.length) {
    console.error('No wiki-raw data. Run node scripts/wiki-extract.js first.');
    process.exit(1);
  }

  (async () => {
    console.log('Syncing to Supabase...');
    const baseUrl = `${url}/rest/v1`;

    await upsertTable(
      url,
      key,
      'wiki_weapons',
      (weapons?.items || []).filter((w) => w.name && !w.name.includes('{{')),
      (w) => ({
        name: w.name,
        attack: w.attack ?? null,
        skill_req: w.skillReq ?? null,
        skill_max: w.skillMax ?? false,
        col_value: w.colValue ?? null,
        location: w.location || null,
        weapon_type: w.weaponType || null,
        wiki_url: w.wikiUrl || null,
      })
    );

    await upsertTable(
      url,
      key,
      'wiki_armor',
      armor?.items || [],
      (a) => ({
        name: a.name,
        level_req: a.levelReq ?? null,
        defense: a.defense ?? null,
        dexterity: a.dexterity ?? null,
        worth: a.worth ?? null,
        how_to_obtain: a.howToObtain || null,
        wiki_url: a.wikiUrl || null,
      })
    );

    await upsertTable(
      url,
      key,
      'wiki_shields',
      shields?.items || [],
      (s) => ({
        name: s.name,
        level_req: s.levelReq ?? null,
        defense: s.defense ?? null,
        dexterity: s.dexterity ?? null,
        worth: s.worth ?? null,
        how_to_obtain: s.howToObtain || null,
        wiki_url: s.wikiUrl || null,
      })
    );

    const allBosses = [...(bosses?.bosses || []), ...(bosses?.minibosses || [])];
    await upsertTable(
      url,
      key,
      'wiki_bosses',
      allBosses.filter((b) => b.name && !b.name.includes('{{')),
      (b) => ({
        name: b.name,
        hp: b.hp ?? null,
        rec_level: b.recLevel ?? null,
        exp: b.exp ?? null,
        col: b.col ?? null,
        respawn: b.respawn || null,
        location: b.location || null,
        drops: b.drops || null,
        rare_drops: b.rareDrops || null,
        last_hit_bonus: b.lastHitBonus || null,
        wiki_url: b.wikiUrl || null,
      })
    );

    console.log('Done.');
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
