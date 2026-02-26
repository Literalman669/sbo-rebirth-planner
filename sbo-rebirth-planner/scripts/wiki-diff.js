#!/usr/bin/env node
/**
 * Wiki vs Catalog Diff — compare wiki-raw JSON with data.js and boss-data.js
 * Outputs DIFF_REPORT.md to data/wiki-raw/
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const WIKI_RAW = path.join(ROOT, 'data', 'wiki-raw');
const OUTPUT = path.join(WIKI_RAW, 'DIFF_REPORT.md');

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadCatalog() {
  const sandbox = { window: {}, console: console };
  const dataCode = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const bossCode = fs.readFileSync(path.join(ROOT, 'boss-data.js'), 'utf8');
  vm.runInNewContext(dataCode, sandbox);
  vm.runInNewContext(bossCode, sandbox);
  return {
    items: sandbox.window.SBO_DATA?.itemCatalog || [],
    bosses: sandbox.window.SBO_BOSS_DATA?.bosses || [],
    minibosses: sandbox.window.SBO_BOSS_DATA?.minibosses || [],
  };
}

function loadWikiRaw() {
  const read = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(WIKI_RAW, f), 'utf8'));
    } catch {
      return null;
    }
  };
  const weapons = read('weapons.json');
  const armor = read('armor.json');
  const shields = read('shields.json');
  const bosses = read('bosses.json');
  return {
    weapons: weapons?.items || [],
    armor: armor?.items || [],
    shields: shields?.items || [],
    bosses: [...(bosses?.bosses || []), ...(bosses?.minibosses || [])],
  };
}

function diffWeapons(catalogItems, wikiWeapons) {
  const catByNorm = new Map();
  for (const it of catalogItems.filter((i) => i.slot === 'weapon')) {
    catByNorm.set(normalizeName(it.name), it);
  }
  const wikiByNorm = new Map();
  for (const w of wikiWeapons) {
    if (w.name && !w.name.includes('{{') && !w.name.includes('PAGENAME')) {
      wikiByNorm.set(normalizeName(w.name), w);
    }
  }

  const newItems = [];
  const changed = [];
  const inCatalogOnly = [];

  for (const [norm, w] of wikiByNorm) {
    const cat = catByNorm.get(norm);
    if (!cat) {
      newItems.push(w);
    } else {
      const diffs = [];
      if (cat.attack != null && w.attack != null && cat.attack !== w.attack) {
        diffs.push({ field: 'attack', catalog: cat.attack, wiki: w.attack });
      }
      if (cat.skillReq != null && w.skillReq != null && cat.skillReq !== w.skillReq) {
        diffs.push({ field: 'skillReq', catalog: cat.skillReq, wiki: w.skillReq });
      }
      if (cat.colValue != null && w.colValue != null && cat.colValue !== w.colValue) {
        diffs.push({ field: 'colValue', catalog: cat.colValue, wiki: w.colValue });
      }
      if (diffs.length) changed.push({ name: w.name, diffs });
    }
  }

  for (const [norm, cat] of catByNorm) {
    if (!wikiByNorm.has(norm)) inCatalogOnly.push(cat);
  }

  return { newItems, changed, inCatalogOnly };
}

function diffArmorShields(catalogItems, wikiArmor, wikiShields, slot) {
  const items = catalogItems.filter((i) => i.slot === slot);
  const wiki = slot === 'armor' ? wikiArmor : wikiShields;

  const catByNorm = new Map();
  for (const it of items) catByNorm.set(normalizeName(it.name), it);
  const wikiByNorm = new Map();
  for (const w of wiki) wikiByNorm.set(normalizeName(w.name), w);

  const newItems = [];
  const changed = [];
  const inCatalogOnly = [];

  for (const [norm, w] of wikiByNorm) {
    const cat = catByNorm.get(norm);
    if (!cat) {
      newItems.push(w);
    } else {
      const diffs = [];
      if (cat.defense != null && w.defense != null && Math.abs((cat.defense || 0) - (w.defense || 0)) > 0.01) {
        diffs.push({ field: 'defense', catalog: cat.defense, wiki: w.defense });
      }
      if (cat.dexterity != null && w.dexterity != null && cat.dexterity !== w.dexterity) {
        diffs.push({ field: 'dexterity', catalog: cat.dexterity, wiki: w.dexterity });
      }
      const catWorth = cat.worth ?? cat.colValue;
      if (catWorth != null && w.worth != null && catWorth !== w.worth) {
        diffs.push({ field: 'worth', catalog: catWorth, wiki: w.worth });
      }
      if (diffs.length) changed.push({ name: w.name, diffs });
    }
  }

  for (const [norm, cat] of catByNorm) {
    if (!wikiByNorm.has(norm)) inCatalogOnly.push(cat);
  }

  return { newItems, changed, inCatalogOnly };
}

function diffBosses(catalogBosses, wikiBosses) {
  const catByNorm = new Map();
  for (const b of catalogBosses) catByNorm.set(normalizeName(b.name), b);
  const wikiByNorm = new Map();
  for (const b of wikiBosses) {
    if (b.name) wikiByNorm.set(normalizeName(b.name), b);
  }

  const newItems = [];
  const changed = [];
  const inCatalogOnly = [];

  for (const [norm, w] of wikiByNorm) {
    const cat = catByNorm.get(norm);
    if (!cat) {
      newItems.push(w);
    } else {
      const diffs = [];
      if (cat.hp != null && w.hp != null && cat.hp !== w.hp) {
        diffs.push({ field: 'hp', catalog: cat.hp, wiki: w.hp });
      }
      if (cat.exp != null && w.exp != null && cat.exp !== w.exp) {
        diffs.push({ field: 'exp', catalog: cat.exp, wiki: w.exp });
      }
      if (cat.col != null && w.col != null && cat.col !== w.col) {
        diffs.push({ field: 'col', catalog: cat.col, wiki: w.col });
      }
      const catLevel = cat.recLevel ?? cat.recSkill;
      if (catLevel != null && w.recLevel != null && catLevel !== w.recLevel) {
        diffs.push({ field: 'recLevel', catalog: catLevel, wiki: w.recLevel });
      }
      if (diffs.length) changed.push({ name: w.name, diffs });
    }
  }

  for (const [norm, cat] of catByNorm) {
    if (!wikiByNorm.has(norm)) inCatalogOnly.push(cat);
  }

  return { newItems, changed, inCatalogOnly };
}

function toMarkdown() {
  const catalog = loadCatalog();
  const wiki = loadWikiRaw();

  const wDiff = diffWeapons(catalog.items, wiki.weapons);
  const aDiff = diffArmorShields(catalog.items, wiki.armor, wiki.shields, 'armor');
  const sDiff = diffArmorShields(catalog.items, wiki.armor, wiki.shields, 'shield');
  const bDiff = diffBosses([...catalog.bosses, ...catalog.minibosses], wiki.bosses);

  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Wiki vs Catalog Diff — ${date}`,
    '',
    'Compare `data/wiki-raw/*.json` with `data.js` and `boss-data.js`.',
    '',
    '---',
    '',
    '## Weapons',
    `- **NEW:** ${wDiff.newItems.length} | **CHANGED:** ${wDiff.changed.length} | **IN_CATALOG_ONLY:** ${wDiff.inCatalogOnly.length}`,
    '',
  ];

  if (wDiff.newItems.length) {
    lines.push('### NEW (in wiki, not in catalog)');
    lines.push('| Name | Attack | Skill | Col | weaponType |');
    lines.push('|------|--------|-------|-----|------------|');
    for (const w of wDiff.newItems.slice(0, 30)) {
      lines.push(`| ${w.name} | ${w.attack ?? '-'} | ${w.skillReq ?? '-'} | ${w.colValue ?? '-'} | ${(w.weaponType || '-').slice(0, 20)} |`);
    }
    if (wDiff.newItems.length > 30) lines.push(`| ... and ${wDiff.newItems.length - 30} more |`);
    lines.push('');
  }

  if (wDiff.changed.length) {
    lines.push('### CHANGED (stats differ)');
    lines.push('| Name | Field | Catalog | Wiki |');
    lines.push('|------|-------|---------|------|');
    for (const { name, diffs } of wDiff.changed.slice(0, 20)) {
      for (const d of diffs) {
        lines.push(`| ${name} | ${d.field} | ${d.catalog} | ${d.wiki} |`);
      }
    }
    if (wDiff.changed.length > 20) lines.push(`| ... and ${wDiff.changed.length - 20} more |`);
    lines.push('');
  }

  lines.push('## Armor');
  lines.push(`- **NEW:** ${aDiff.newItems.length} | **CHANGED:** ${aDiff.changed.length} | **IN_CATALOG_ONLY:** ${aDiff.inCatalogOnly.length}`);
  lines.push('');

  if (aDiff.newItems.length) {
    lines.push('### NEW (sample)');
    lines.push('| Name | Level | Defense | Dexterity |');
    lines.push('|------|-------|---------|-----------|');
    for (const w of aDiff.newItems.slice(0, 15)) {
      lines.push(`| ${w.name} | ${w.levelReq ?? '-'} | ${w.defense ?? '-'} | ${w.dexterity ?? '-'} |`);
    }
    lines.push('');
  }

  lines.push('## Shields');
  lines.push(`- **NEW:** ${sDiff.newItems.length} | **CHANGED:** ${sDiff.changed.length} | **IN_CATALOG_ONLY:** ${sDiff.inCatalogOnly.length}`);
  lines.push('');

  lines.push('## Bosses');
  lines.push(`- **NEW:** ${bDiff.newItems.length} | **CHANGED:** ${bDiff.changed.length} | **IN_CATALOG_ONLY:** ${bDiff.inCatalogOnly.length}`);
  lines.push('');

  if (bDiff.changed.length) {
    lines.push('### CHANGED (sample)');
    lines.push('| Name | Field | Catalog | Wiki |');
    lines.push('|------|-------|---------|------|');
    for (const { name, diffs } of bDiff.changed.slice(0, 10)) {
      for (const d of diffs) {
        lines.push(`| ${name} | ${d.field} | ${d.catalog} | ${d.wiki} |`);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Workflow:** Run `node scripts/wiki-extract.js` then `node scripts/wiki-diff.js`. Review this report and manually update `data.js` / `boss-data.js` as needed.');
  return lines.join('\n');
}

function main() {
  const catalog = loadCatalog();
  const wiki = loadWikiRaw();

  if (!wiki.weapons.length && !wiki.armor.length) {
    console.error('No wiki-raw data found. Run node scripts/wiki-extract.js first.');
    process.exit(1);
  }

  const md = toMarkdown();
  fs.mkdirSync(WIKI_RAW, { recursive: true });
  fs.writeFileSync(OUTPUT, md, 'utf8');
  console.log(`Wrote ${OUTPUT}`);
}

main();
