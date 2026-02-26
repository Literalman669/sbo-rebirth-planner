#!/usr/bin/env node
/**
 * SBO:Rebirth Wiki Extraction — MediaWiki API (free, no auth)
 * Discovers pages, fetches wikitext, parses templates/tables, outputs JSON.
 * Requires Node 18+ (built-in fetch).
 */

const fs = require('fs');
const path = require('path');
const {
  parseTemplate,
  parseWikitable,
  parseWeaponTemplate,
  parseArmorTemplate,
  parseMobsTemplate,
} = require('./parse-templates.js');

const API_BASE = 'https://swordbloxonlinerebirth.fandom.com/api.php';
const BATCH_SIZE = 50;
const DELAY_MS = 1500;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'wiki-raw');
const LOG_FILE = path.join(__dirname, 'wiki-extract.log');

let logBuffer = [];

function log(msg, isError = false) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logBuffer.push(line);
  if (isError) console.error(line);
  else console.log(line);
}

function writeLog() {
  try {
    fs.appendFileSync(LOG_FILE, logBuffer.join('\n') + '\n');
  } catch (e) {
    console.error('Failed to write log:', e.message);
  }
  logBuffer = [];
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchApi(params) {
  const url = `${API_BASE}?${new URLSearchParams({ ...params, format: 'json' })}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.min(2000 * Math.pow(2, attempt), 10000);
        log(`Rate limit/server error ${res.status}, retry in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function getCategoryMembers(category) {
  const all = [];
  let cmcontinue;
  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: 500,
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const data = await fetchApi(params);
    cmcontinue = data.continue?.cmcontinue;
    const members = data.query?.categorymembers || [];
    for (const m of members) {
      if (m.ns === 0 && !m.title.startsWith('Category:')) {
        all.push({ pageid: m.pageid, title: m.title });
      }
    }
    if (cmcontinue) await sleep(500);
  } while (cmcontinue);
  return all;
}

async function getPageContent(titles) {
  if (titles.length === 0) return {};
  const data = await fetchApi({
    action: 'query',
    titles: titles.join('|'),
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
  });
  const pages = data.query?.pages || {};
  const result = {};
  for (const [pid, page] of Object.entries(pages)) {
    if (page.missing || page.invalid) continue;
    const rev = page.revisions?.[0];
    const content = rev?.slots?.main?.['*'];
    if (content) result[page.title] = { pageid: page.pageid, content };
  }
  return result;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log(`Created ${OUTPUT_DIR}`);
  }
}

function writeJson(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  log(`Wrote ${filename}`);
}

async function extractCategory(category, options = {}) {
  const { templateName, parser, slot } = options;
  const members = await getCategoryMembers(category);
  const titles = members.map((m) => m.title);
  log(`Category:${category} — ${titles.length} pages`);

  const items = [];
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    const contents = await getPageContent(batch);
    for (const [title, { content }] of Object.entries(contents)) {
      const params = templateName && parseTemplate(content, templateName);
      if (params && parser) {
        const parsed = parser(params, title);
        parsed.wikiTitle = title;
        parsed.wikiUrl = `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
        if (slot) parsed.slot = slot;
        items.push(parsed);
      } else if (!templateName) {
        items.push({ title, content: content.slice(0, 5000) });
      }
    }
    if (i + BATCH_SIZE < titles.length) await sleep(DELAY_MS);
  }
  return items;
}

async function extractCorePages() {
  const coreTitles = [
    'Stats',
    'Two-Handed',
    'One-Handed',
    'Rapier',
    'Dagger',
    'Dual Wield',
    'Armor',
    'Upper Headwear',
    'Lower Headwear',
    'Shields',
    'Gamepass_and_Badge_Equipment',
  ];
  const contents = await getPageContent(coreTitles);
  const result = {};
  for (const [title, { content }] of Object.entries(contents)) {
    const tables = parseWikitable(content);
    result[title] = {
      wikitext: content.slice(0, 15000),
      tables: tables.map((t) => ({
        headers: t.headers,
        rowCount: t.rows.length,
        sampleRows: t.rows.slice(0, 5),
        allRows: t.rows,
      })),
    };
  }
  return result;
}

async function main() {
  ensureOutputDir();

  try {
    log('Starting SBO:Rebirth wiki extraction...');

    log('Fetching Weapons...');
    const weapons = await extractCategory('Weapons', {
      templateName: 'Weapon',
      parser: parseWeaponTemplate,
      slot: 'weapon',
    });
    writeJson('weapons.json', { extractedAt: new Date().toISOString(), count: weapons.length, items: weapons });
    await sleep(DELAY_MS);

    log('Fetching Armor...');
    const armor = await extractCategory('Armor', {
      templateName: 'Armor',
      parser: parseArmorTemplate,
      slot: 'armor',
    });
    writeJson('armor.json', { extractedAt: new Date().toISOString(), count: armor.length, items: armor });
    await sleep(DELAY_MS);

    log('Fetching Shields...');
    const shields = await extractCategory('Shields', {
      templateName: 'Armor',
      parser: parseArmorTemplate,
      slot: 'shield',
    });
    writeJson('shields.json', { extractedAt: new Date().toISOString(), count: shields.length, items: shields });
    await sleep(DELAY_MS);

    log('Fetching Bosses...');
    const bosses = await extractCategory('Boss', {
      templateName: 'Mobs',
      parser: parseMobsTemplate,
    });
    const minibosses = await extractCategory('Miniboss', {
      templateName: 'Mobs',
      parser: parseMobsTemplate,
    });
    writeJson('bosses.json', {
      extractedAt: new Date().toISOString(),
      bosses: bosses.filter((b) => b.hp || b.name),
      minibosses: minibosses.filter((b) => b.hp || b.name),
    });
    await sleep(DELAY_MS);

    log('Fetching core pages (Stats, weapon classes, armor tables)...');
    const corePages = await extractCorePages();
    writeJson('stats-page.json', {
      extractedAt: new Date().toISOString(),
      pages: corePages,
    });

    log('Extraction complete.');
  } catch (e) {
    log(`Error: ${e.message}`, true);
    log(e.stack, true);
    process.exitCode = 1;
  } finally {
    writeLog();
  }
}

main();
