const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = process.cwd();
const dataPath = path.join(ROOT, "data.js");
const bossPath = path.join(ROOT, "boss-data.js");
const wikiDir = path.join(ROOT, "data", "wiki-raw");
const syncReportPath = path.join(wikiDir, "WIKI_SYNC_REPORT.md");
const syncReportJsonPath = path.join(wikiDir, "WIKI_SYNC_REPORT.json");
const syncReport = {
  generatedAt: new Date().toISOString(),
  accepted: { weapons: 0, armor: 0, shields: 0, bosses: 0, minibosses: 0 },
  rejected: [],
};

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['�]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFloor(...candidates) {
  const wordToNum = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, twentyone: 21, twentytwo: 22, twentythree: 23,
    twentyfour: 24, twentyfive: 25,
  };
  for (const c of candidates) {
    const s = String(c || "");
    const m = s.match(/floor\s*[-:]?\s*(\d{1,3})/i);
    if (m) return Number(m[1]);
    const words = s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      if (words[i] === "floor" && words[i + 1]) {
        const compact = words[i + 1].replace(/[^a-z]/g, "");
        if (wordToNum[compact]) return wordToNum[compact];
        if (words[i + 2]) {
          const combined = `${compact}${words[i + 2].replace(/[^a-z]/g, "")}`;
          if (wordToNum[combined]) return wordToNum[combined];
        }
      }
    }
  }
  return null;
}

function inferSourceType(text) {
  const s = String(text || "").toLowerCase();
  if (s.includes("shop")) return "shop";
  if (s.includes("craft") || s.includes("blacksmith")) return "crafted";
  if (s.includes("event") || s.includes("halloween") || s.includes("easter") || s.includes("christmas") || s.includes("valentine")) return "event";
  if (s.includes("boss")) return "boss";
  if (s.includes("badge") || s.includes("gamepass")) return "gamepass";
  if (s.includes("drop") || s.includes("mob")) return "mob";
  return "mob";
}

const FLOOR_19_SHOP_PRICE = new Map([
  ["aurora rapier", 107299],
  ["frostbound traveler garb", 88800],
  ["frostfang dagger", 107299],
  ["glacial ward shield", 66500],
  ["glacier splitter", 107299],
  ["icebound slasher", 107299],
  ["warbound vestments", 88800],
]);

function weaponClassFromType(weaponType) {
  const t = String(weaponType || "").toLowerCase();
  if (t.includes("two") || t.includes("greatsword")) return "two-handed";
  if (t.includes("dual")) return "dual-wield";
  if (t.includes("rapier")) return "rapier";
  if (t.includes("dagger")) return "dagger";
  if (t.includes("melee")) return "melee";
  if (t.includes("one")) return "one-handed";
  return "one-handed";
}

function loadDataObject(filePath, expr) {
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return expr(sandbox);
}

const dataObj = loadDataObject(dataPath, (s) => s.window.SBO_DATA || s.SBO_DATA);
const bossObj = loadDataObject(bossPath, (s) => s.window.SBO_BOSS_DATA || s.SBO_BOSS_DATA);

const wikiWeapons = readJson(path.join(wikiDir, "weapons.json")).items || [];
const wikiArmor = readJson(path.join(wikiDir, "armor.json")).items || [];
const wikiShields = readJson(path.join(wikiDir, "shields.json")).items || [];
const wikiBossesRaw = readJson(path.join(wikiDir, "bosses.json"));
const wikiBosses = wikiBossesRaw.bosses || [];
const wikiMinis = wikiBossesRaw.minibosses || [];

const items = Array.isArray(dataObj.itemCatalog) ? dataObj.itemCatalog : [];
const idSet = new Set(items.map((i) => i.id));

function ensureId(base) {
  let id = base;
  let i = 2;
  while (idSet.has(id)) {
    id = `${base}-${i++}`;
  }
  idSet.add(id);
  return id;
}

function rejectEntry(category, name, reason) {
  syncReport.rejected.push({ category, name: name || "Unknown", reason });
}

function isValidFloor(value) {
  return Number.isFinite(value) && value >= 1 && value <= 200;
}

function upsertWeapon(w) {
  if (!w || !w.name) return;
  if (!Number.isFinite(w.skillReq) || w.skillReq < 1 || w.skillReq > 1000) {
    rejectEntry("weapon", w.name, "invalid skillReq");
    return;
  }
  if (!Number.isFinite(w.attack) || w.attack <= 0) {
    rejectEntry("weapon", w.name, "missing or invalid attack");
    return;
  }
  const weaponClass = weaponClassFromType(w.weaponType);
  const nameNorm = normalizeName(w.name);
  const matches = items.filter((it) => it.slot === "weapon" && normalizeName(it.name) === nameNorm && it.weaponClass === weaponClass);

  for (const it of matches) {
    if (Number.isFinite(w.attack)) it.attack = w.attack;
    if (Number.isFinite(w.skillReq)) it.skillReq = w.skillReq;
    if (Number.isFinite(w.colValue)) it.colValue = w.colValue;
    const inferredFloor = inferFloor(w.location);
    it.floorMin = Number.isFinite(inferredFloor) ? Math.max(1, inferredFloor) : (it.floorMin || 1);
    it.exactStats = Number.isFinite(it.attack);
    if (w.location) it.notes = (it.notes && it.notes.length > 0) ? it.notes : `Wiki location: ${w.location}`;
    syncReport.accepted.weapons += 1;
  }

  if (matches.length === 0) {
    const floorMin = Math.max(1, inferFloor(w.location) || 1);
    const attack = Number.isFinite(w.attack) ? w.attack : null;
    const skillReq = Number.isFinite(w.skillReq) ? w.skillReq : 1;
    const colValue = Number.isFinite(w.colValue) ? w.colValue : floorMin * floorMin * 300;
    const sourceType = inferSourceType(`${w.location} ${(w.raw && (w.raw.craftable || ""))}`);
    const baseId = `w-${slugify(w.name)}${weaponClass !== "one-handed" ? `-${weaponClass}` : ""}`;
    items.push({
      id: ensureId(baseId),
      name: w.name,
      slot: "weapon",
      weaponClass,
      floorMin,
      levelReq: 1,
      skillReq,
      attack,
      sourceType,
      scalingType: "fixed",
      colValue,
      exactStats: Number.isFinite(attack),
      notes: w.location ? `Wiki location: ${w.location}` : "Wiki sync import",
    });
    syncReport.accepted.weapons += 1;
  }
}

function upsertDefenseItem(w, slot) {
  if (!w || !w.name) return;
  const hasDefense = Number.isFinite(w.defense) && w.defense > 0;
  const hasDexterity = Number.isFinite(w.dexterity) && w.dexterity > 0;
  if (!hasDefense && !hasDexterity) {
    rejectEntry(slot, w.name, "missing both defense and dexterity");
    return;
  }
  const nameNorm = normalizeName(w.name);
  const matches = items.filter((it) => it.slot === slot && normalizeName(it.name) === nameNorm);

  for (const it of matches) {
    if (Number.isFinite(w.levelReq)) it.levelReq = w.levelReq;
    if (Number.isFinite(w.defense)) it.defense = w.defense;
    if (Number.isFinite(w.dexterity)) it.dexterity = w.dexterity;
    if (Number.isFinite(w.worth)) it.colValue = w.worth;
    const inferredFloor = inferFloor(w.howToObtain);
    it.floorMin = Number.isFinite(inferredFloor) ? Math.max(1, inferredFloor) : (it.floorMin || 1);
    it.exactStats = Number.isFinite(it.defense) || Number.isFinite(it.dexterity);
    if (slot === "shield") syncReport.accepted.shields += 1;
    else syncReport.accepted.armor += 1;
  }

  if (matches.length === 0) {
    const floorMin = Math.max(1, inferFloor(w.howToObtain) || 1);
    const levelReq = Number.isFinite(w.levelReq) ? w.levelReq : 1;
    const colValue = Number.isFinite(w.worth) ? w.worth : floorMin * floorMin * 120;
    const sourceType = inferSourceType(w.howToObtain);
    const baseId = `${slot === "shield" ? "s" : "a"}-${slugify(w.name)}`;
    items.push({
      id: ensureId(baseId),
      name: w.name,
      slot,
      floorMin,
      levelReq,
      defense: Number.isFinite(w.defense) ? w.defense : undefined,
      dexterity: Number.isFinite(w.dexterity) ? w.dexterity : undefined,
      sourceType,
      scalingType: "fixed",
      colValue,
      exactStats: Number.isFinite(w.defense) || Number.isFinite(w.dexterity),
      notes: w.howToObtain ? `Wiki source: ${w.howToObtain}` : "Wiki sync import",
    });
    if (slot === "shield") syncReport.accepted.shields += 1;
    else syncReport.accepted.armor += 1;
  }
}

wikiWeapons.forEach(upsertWeapon);
wikiArmor.forEach((a) => upsertDefenseItem(a, "armor"));
wikiShields.forEach((s) => upsertDefenseItem(s, "shield"));

const floor19ShopNames = [...FLOOR_19_SHOP_PRICE.keys()];
for (const item of items) {
  const norm = normalizeName(item.name);
  if (!floor19ShopNames.includes(norm)) continue;
  item.floorMin = 19;
  item.sourceType = "shop";
  const price = FLOOR_19_SHOP_PRICE.get(norm);
  if (Number.isFinite(price)) item.colValue = price;
  if (item.slot === "weapon") item.skillReq = Math.max(Number(item.skillReq) || 1, 370);
  if (item.slot !== "weapon") item.levelReq = Math.max(Number(item.levelReq) || 1, 180);
}

if (!items.some((i) => normalizeName(i.name) === "glacial ward shield")) {
  items.push({
    id: ensureId("s-glacial-ward-shield"),
    name: "Glacial Ward Shield",
    slot: "shield",
    floorMin: 19,
    levelReq: 180,
    defense: 160,
    sourceType: "shop",
    scalingType: "fixed",
    colValue: 66500,
    exactStats: false,
    notes: "Floor 19 shop shield. Defense value pending direct stat confirmation.",
  });
}

items.sort((a, b) => {
  if (a.slot !== b.slot) return String(a.slot).localeCompare(String(b.slot));
  if ((a.slot || "") === "weapon") {
    const wc = String(a.weaponClass || "").localeCompare(String(b.weaponClass || ""));
    if (wc !== 0) return wc;
  }
  const f = (Number(a.floorMin) || 0) - (Number(b.floorMin) || 0);
  if (f !== 0) return f;
  return String(a.name || "").localeCompare(String(b.name || ""));
});

dataObj.itemCatalog = items;

const allBosses = [...(bossObj.bosses || []), ...(bossObj.minibosses || [])];
const bossIndex = new Map(allBosses.map((b) => [normalizeName(b.name), b]));

function upsertBoss(entry, type) {
  if (!entry || !entry.name) return;
  if (!Number.isFinite(entry.recLevel) || entry.recLevel < 1 || entry.recLevel > 1000) {
    rejectEntry(type === "mini" ? "miniboss" : "boss", entry.name, "invalid recLevel");
    return;
  }
  const key = normalizeName(entry.name);
  const existing = bossIndex.get(key);
  const inferredFloor = inferFloor(entry.location, entry.wikiTitle);
  const floor = Number.isFinite(inferredFloor) ? Math.max(1, inferredFloor) : (existing?.floor ?? 1);
  if (!isValidFloor(floor)) {
    rejectEntry(type === "mini" ? "miniboss" : "boss", entry.name, "invalid floor");
    return;
  }
  const recLevel = Number.isFinite(entry.recLevel) ? entry.recLevel : (existing?.recLevel ?? 1);
  const hp = Number.isFinite(entry.hp) ? entry.hp : (existing?.hp ?? 0);
  const exp = Number.isFinite(entry.exp) ? entry.exp : (existing?.exp ?? 0);
  const col = Number.isFinite(entry.col) ? entry.col : (existing?.col ?? 0);
  const drops = String(entry.drops || "").split(/,\s*/).filter(Boolean);
  const rareDrops = String(entry.rareDrops || "").split(/,\s*/).filter(Boolean);

  if (existing) {
    existing.name = entry.name;
    existing.floor = floor;
    existing.recLevel = recLevel;
    existing.recSkill = Number.isFinite(existing.recSkill) ? existing.recSkill : Math.max(1, recLevel * 2);
    existing.hp = hp;
    existing.exp = exp;
    existing.col = col;
    existing.location = entry.location || existing.location || "Unknown";
    existing.respawnTime = entry.respawn || existing.respawnTime || "Unknown";
    existing.wikiUrl = entry.wikiUrl || existing.wikiUrl;
    existing.drops = drops.length ? drops : existing.drops || [];
    existing.rareDrops = rareDrops.length ? rareDrops : existing.rareDrops || [];
    existing.lastHitDrop = entry.lastHitBonus || existing.lastHitDrop || null;
    existing.statusEffect = (entry.raw && entry.raw.status_effect) ? String(entry.raw.status_effect).trim() : (existing.statusEffect || null);
    existing.type = existing.type || type;
    existing.exactStats = Number.isFinite(entry.hp) && Number.isFinite(entry.exp) && Number.isFinite(entry.col);
    if (type === "mini") syncReport.accepted.minibosses += 1;
    else syncReport.accepted.bosses += 1;
  } else {
    const idBase = slugify(entry.name) || `boss-${Math.random().toString(36).slice(2, 8)}`;
    const newBoss = {
      id: idBase,
      name: entry.name,
      wikiUrl: entry.wikiUrl || "",
      floor,
      type,
      recLevel,
      recSkill: Math.max(1, recLevel * 2),
      hp,
      exp,
      col,
      statusEffect: (entry.raw && entry.raw.status_effect) ? String(entry.raw.status_effect).trim() : null,
      phases: [
        { hpThresholdPct: 100, name: "Normal", notes: "Wiki sync import." },
      ],
      resistances: { slash: 0, pierce: 0, blunt: 0 },
      weaknesses: [],
      drops,
      rareDrops,
      lastHitDrop: entry.lastHitBonus || null,
      location: entry.location || "Unknown",
      respawnTime: entry.respawn || "Unknown",
      notes: "Imported from latest wiki extraction.",
      exactStats: Number.isFinite(entry.hp) && Number.isFinite(entry.exp) && Number.isFinite(entry.col),
    };
    if (type === "mini") {
      bossObj.minibosses = bossObj.minibosses || [];
      bossObj.minibosses.push(newBoss);
      syncReport.accepted.minibosses += 1;
    } else {
      bossObj.bosses = bossObj.bosses || [];
      bossObj.bosses.push(newBoss);
      syncReport.accepted.bosses += 1;
    }
    bossIndex.set(key, newBoss);
  }
}

wikiBosses.forEach((b) => upsertBoss(b, "boss"));
wikiMinis.forEach((b) => upsertBoss(b, "mini"));

const floor19BossSeeds = [
  {
    name: "Ice Spirit",
    floor: 19,
    type: "boss",
    recLevel: 220,
    recSkill: 440,
    hp: null,
    exp: 39600,
    col: 5280,
    statusEffect: null,
    drops: [],
    rareDrops: ["Glacial Crystal Gem", "Shard of Regret", "Frozen Tear", "Spiritbound Frost"],
    location: "Floor 19",
    respawnTime: "180s",
    notes: "Floor 19 boss. HP listed as N/A on wiki at extraction time.",
    exactStats: false,
    wikiUrl: "https://swordbloxonlinerebirth.fandom.com/wiki/Ice_Spirit",
  },
  {
    name: "Sunwarden Caelis",
    floor: 19,
    type: "mini",
    recLevel: 210,
    recSkill: 420,
    hp: null,
    exp: 37800,
    col: 5040,
    statusEffect: null,
    drops: ["Glacial Dust", "Veilpiecer", "Radiant Frost Sigil", "Pure Glacial Essence"],
    rareDrops: [],
    location: "Floor 19",
    respawnTime: "180s",
    notes: "Floor 19 miniboss. HP listed as ??? on wiki at extraction time.",
    exactStats: false,
    wikiUrl: "https://swordbloxonlinerebirth.fandom.com/wiki/Sunwarden_Caelis",
  },
  {
    name: "Oslund the Hollow Flame",
    floor: 19,
    type: "mini",
    recLevel: 200,
    recSkill: 400,
    hp: null,
    exp: 36000,
    col: 4800,
    statusEffect: "Bleed",
    drops: [],
    rareDrops: ["Emberfrost Residue", "Ruin of the North", "Oslund Coat", "Hollow Flame Fragment", "Oslund Headguard", "Glacial Dust"],
    location: "Floor 19",
    respawnTime: "180s",
    notes: "Floor 19 miniboss. HP listed as ??? on wiki at extraction time.",
    exactStats: false,
    wikiUrl: "https://swordbloxonlinerebirth.fandom.com/wiki/Oslund_the_Hollow_Flame",
  },
  {
    name: "Frostveil Echo",
    floor: 19,
    type: "mini",
    recLevel: 215,
    recSkill: 430,
    hp: null,
    exp: 38700,
    col: 5160,
    statusEffect: "Bleed",
    drops: [],
    rareDrops: ["Glacial Crystal Shard", "Frostveil Echo Mantle", "Veiled Core", "Frostveil Echo Helm", "Blackfrost Oathblade"],
    location: "Floor 19",
    respawnTime: "180s",
    notes: "Floor 19 miniboss. HP listed as N/A on wiki at extraction time.",
    exactStats: false,
    wikiUrl: "https://swordbloxonlinerebirth.fandom.com/wiki/Frostveil_Echo",
  },
  {
    name: "Wendigo",
    floor: 19,
    type: "mini",
    recLevel: 350,
    recSkill: 500,
    hp: null,
    exp: 68000,
    col: 8400,
    statusEffect: null,
    drops: [],
    rareDrops: [],
    location: "Floor 19",
    respawnTime: "500s",
    notes: "Floor 19 miniboss. HP not listed in wiki template at extraction time.",
    exactStats: false,
    wikiUrl: "https://swordbloxonlinerebirth.fandom.com/wiki/Wendigo",
  },
];

for (const seed of floor19BossSeeds) {
  upsertBoss(seed, seed.type);
}

if (Array.isArray(bossObj.bosses)) {
  bossObj.bosses.sort((a, b) => (a.floor - b.floor) || String(a.name).localeCompare(String(b.name)));
}
if (Array.isArray(bossObj.minibosses)) {
  bossObj.minibosses.sort((a, b) => (a.floor - b.floor) || String(a.name).localeCompare(String(b.name)));
}

const dataOut = `const SBO_DATA = ${JSON.stringify(dataObj, null, 2)};\n\nwindow.SBO_DATA = SBO_DATA;\n`;
const bossOut = `window.SBO_BOSS_DATA = ${JSON.stringify(bossObj, null, 2)};\n`;

fs.writeFileSync(dataPath, dataOut, "utf8");
fs.writeFileSync(bossPath, bossOut, "utf8");

const mdReport = [
  `# Wiki Sync Report`,
  ``,
  `Generated: ${syncReport.generatedAt}`,
  ``,
  `## Accepted`,
  `- Weapons: ${syncReport.accepted.weapons}`,
  `- Armor: ${syncReport.accepted.armor}`,
  `- Shields: ${syncReport.accepted.shields}`,
  `- Bosses: ${syncReport.accepted.bosses}`,
  `- Minibosses: ${syncReport.accepted.minibosses}`,
  ``,
  `## Rejected`,
  ...(syncReport.rejected.length
    ? syncReport.rejected.map((entry) => `- [${entry.category}] ${entry.name}: ${entry.reason}`)
    : ["- None"]),
  ``,
].join("\n");

fs.writeFileSync(syncReportPath, mdReport, "utf8");
fs.writeFileSync(syncReportJsonPath, JSON.stringify(syncReport, null, 2), "utf8");

console.log(`Updated itemCatalog size: ${dataObj.itemCatalog.length}`);
console.log(`Updated bosses: ${(bossObj.bosses || []).length}, minibosses: ${(bossObj.minibosses || []).length}`);
console.log(`Sync report: ${syncReportPath}`);
