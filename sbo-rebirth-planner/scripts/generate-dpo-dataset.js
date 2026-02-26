#!/usr/bin/env node
/**
 * DPO Dataset Generator for SBO:Rebirth Build Planner
 * Reads boss-data.js and data.js, outputs DPO-ready JSON for TRL training.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BOSS_DATA_PATH = path.join(ROOT, "boss-data.js");
const DATA_JS_PATH = path.join(ROOT, "data.js");
const OUTPUT_PATH = path.join(__dirname, "sbo-dpo-dataset.json");

// --- Data loaders ---

function loadBossData() {
  const window = {};
  const code = fs.readFileSync(BOSS_DATA_PATH, "utf8");
  const fn = new Function("window", code);
  fn(window);
  return window.SBO_BOSS_DATA || { bosses: [], miniBosses: [] };
}

function loadFormulas() {
  const window = {};
  const code = fs.readFileSync(DATA_JS_PATH, "utf8");
  const fn = new Function("window", code);
  fn(window);
  return window.SBO_DATA?.formulas || {};
}

// --- DPO pair helpers ---

function pair(prompt, chosen, rejected) {
  return {
    prompt: [{ role: "user", content: prompt }],
    chosen: [{ role: "assistant", content: chosen }],
    rejected: [{ role: "assistant", content: rejected }],
  };
}

const WRONG_BOSS_NAMES = [
  "Sanguine Harvester",
  "Shadow Lord",
  "Ancient Wyrm",
  "Void Walker",
  "Dragon Emperor",
  "Crystal Guardian",
];

// --- Boss pairs ---

function generateBossPairs(bossData) {
  const pairs = [];
  const allBosses = [
    ...(bossData.bosses || []).filter((b) => b.hp > 0 && b.floor > 0),
    ...(bossData.miniBosses || []).filter((b) => b.hp > 0 && b.floor > 0),
  ];

  // Floor -> bosses mapping (some floors have multiple)
  const floorToBosses = new Map();
  for (const boss of allBosses) {
    if (!floorToBosses.has(boss.floor)) floorToBosses.set(boss.floor, []);
    floorToBosses.get(boss.floor).push(boss);
  }

  // One "boss of floor N" question per floor (not per boss)
  const floorsDone = new Set();
  for (const [floor, bossesOnFloor] of floorToBosses) {
    const wrongName = WRONG_BOSS_NAMES[floor % WRONG_BOSS_NAMES.length];
    const namesList =
      bossesOnFloor.length > 1
        ? bossesOnFloor.map((b) => b.name).join(" and ")
        : bossesOnFloor[0].name;
    pairs.push(
      pair(
        `What's the boss of floor ${floor}?`,
        bossesOnFloor.length > 1
          ? `Floor ${floor} bosses: ${namesList}.`
          : `${namesList} is the boss of Floor ${floor}.`,
        `The boss of Floor ${floor} is ${wrongName}.`
      )
    );
  }

  for (const boss of allBosses) {
    const wrongName = WRONG_BOSS_NAMES[pairs.length % WRONG_BOSS_NAMES.length];
    const vagueLow = Math.floor(boss.hp * 0.6);
    const vagueHigh = Math.floor(boss.hp * 1.2);

    // HP
    pairs.push(
      pair(
        `How much HP does ${boss.name} have?`,
        `${boss.name} has ${boss.hp.toLocaleString()} HP.`,
        `Around ${vagueLow.toLocaleString()}-${vagueHigh.toLocaleString()} HP depending on phase.`
      )
    );

    // Location
    if (boss.location) {
      pairs.push(
        pair(
          `Where is ${boss.name}?`,
          `${boss.name} is on Floor ${boss.floor} — ${boss.location}.`,
          `${boss.name} is on Floor ${Math.max(1, boss.floor - 1)}. You need to complete the quest first.`
        )
      );
    }

    // Drops
    const drops = [...(boss.drops || []), ...(boss.rareDrops || [])];
    if (boss.lastHitDrop) drops.push(`${boss.lastHitDrop} (last hit)`);
    if (drops.length) {
      const chosenDrops = drops.slice(0, 5).join(", ");
      const more = drops.length > 5 ? ` and more` : "";
      pairs.push(
        pair(
          `What does ${boss.name} drop?`,
          `${boss.name} drops ${chosenDrops}${more}.`,
          `${boss.name} drops various crafting materials and equipment. Drops vary by luck and party size.`
        )
      );
    }

    // Rec level / skill
    if (boss.recLevel > 0 || boss.recSkill > 0) {
      const recs = [];
      if (boss.recLevel > 0) recs.push(`Lv${boss.recLevel}+`);
      if (boss.recSkill > 0) recs.push(`Skill ${boss.recSkill}+`);
      pairs.push(
        pair(
          `What level for ${boss.name}?`,
          `Recommended: ${recs.join(", ")}.`,
          `Around level ${Math.max(1, boss.recLevel - 10)}-${boss.recLevel + 20} depending on your gear and skill.`
        )
      );
    }
  }

  return pairs;
}

// --- Stat formula pairs ---

function generateStatPairs(formulas) {
  const statCap = 500;
  const pairs = [];

  const statData = [
    {
      name: "STR",
      prompt: "How does STR affect damage?",
      chosen:
        "STR adds +0.4% damage per point (max +200% at 500). Also boosts crit damage: STRmulti = STR/500 × 2.",
      rejected:
        "STR is important for physical damage. The exact formula varies by weapon. Generally, more STR means more damage, but balance it with AGI for attack speed.",
    },
    {
      name: "DEF",
      prompt: "How does DEF work?",
      chosen:
        "DEF multiplies gear Defense. Base ×5 (5 DR per Defense point). Each DEF adds +0.01 to the multiplier; at 500 DEF it's ×10.",
      rejected:
        "DEF increases your damage reduction. The formula is complex and depends on your level and armor. Generally more DEF means you take less damage.",
    },
    {
      name: "VIT",
      prompt: "How does VIT work?",
      chosen:
        "VIT multiplies gear Dexterity into HP: DEX × (10 + VIT×0.01). At 500 VIT the multiplier is ×15. Also +0.01% debuff resistance per point (max +5%). +10 Stamina at 500.",
      rejected:
        "VIT adds +10 HP per point and improves survivability. It also helps with debuff resistance. Good for tank builds.",
    },
    {
      name: "AGI",
      prompt: "What does AGI do?",
      chosen:
        "AGI boosts attack speed, movement speed, and lowers skill cooldowns. Per-weapon max speed gain: 2H/1H 30%, Rapier 60%, Dagger 30%, Dual 50%, Melee 50%. +10 Stamina at 500.",
      rejected:
        "AGI increases attack speed and movement. The exact values depend on your weapon. More AGI means faster attacks and better mobility.",
    },
    {
      name: "LUK",
      prompt: "What does LUK do?",
      chosen:
        "LUK adds +0.01% crit chance per point (base 15%, max 20% at 500). Also increases drop chance.",
      rejected:
        "LUK affects crit chance and drop rates. Higher LUK means more crits and better loot. The formula varies by game version.",
    },
  ];

  for (const s of statData) {
    pairs.push(pair(s.prompt, s.chosen, s.rejected));
    pairs.push(
      pair(
        `What's the cap for ${s.name}?`,
        `${s.name} caps at ${statCap}.`,
        `${s.name} doesn't have a hard cap, but diminishing returns start around 300-400.`
      )
    );
  }

  // Extra formula questions
  pairs.push(
    pair(
      "How does DEF affect damage reduction?",
      "DR = Defense × (5 + DEF×0.01). Base multiplier is ×5; at 500 DEF it's ×10.",
      "DEF increases damage reduction. The exact formula depends on your armor and level."
    )
  );
  pairs.push(
    pair(
      "What's the multi-hit formula?",
      "50% base. STR and LUK add up to +10% each, combined cap +15% → 65% total. Requires 200+ Sword Skill (except 2H).",
      "Multi-hit chance is affected by STR and LUK. The base is around 50% and it can go higher with the right stats."
    )
  );

  return pairs;
}

// --- Build advice pairs (manual) ---

function generateBuildAdvicePairs() {
  return [
    pair(
      "What should I focus on for Illfang?",
      "Lv10+, Skill 60+, solid DEF for survivability. He blocks often—attack from the side. At 33% HP he switches to Nodachi; stay mobile.",
      "Illfang is a challenging early boss. Level up and get better gear. Consider increasing defense and damage. Party play is recommended. Make sure you have enough HP and damage reduction. Watch out for his phase change. Good luck!"
    ),
    pair(
      "What's my current equipment?",
      "Weapon: Master Steel Greatsword; Armor: Swamp Legend; Upper: Enhanced Coned Helmet; Lower: Enhanced Cloak.",
      "I can't see your equipment. Check your inventory. Also, focus on defense for survivability—consider Swamp Legend or Coat of Midnight. Your defense is quite low for a balanced playstyle. Increasing defense will be crucial for Illfang..."
    ),
    pair(
      "What should I focus on for Stallord?",
      "Lv30+, Skill 80+, solid DEF. Straightforward melee fight—stay mobile and punish openings. Good for farming Gold Ore.",
      "Stallord is a mid-game boss. You'll need good gear and levels. Consider a party. He has various attack patterns. Watch for his telegraphed moves and dodge. Farm him for materials when you're ready."
    ),
    pair(
      "What does Dexterity do in SBO:R?",
      "Dexterity (from gear) = bonus HP. Formula: DEX × (10 + VIT×0.01). Not dodge—bonus HP only.",
      "Dexterity improves your accuracy and dodging. It also gives a small crit bonus. Some armor pieces have high DEX for agile builds."
    ),
    pair(
      "How does crit work?",
      "15% base, +5% from LUK (20% max at 500). Crit damage = (base × critMulti) + (base × STRmulti). Per-weapon: 2H ×1.5, 1H ×2, Rapier ×2.4, Dagger ×2.7, Dual ×2, Melee ×3.",
      "Crit chance is affected by LUK. Different weapons have different crit multipliers. Generally you want high STR and LUK for crit builds."
    ),
    pair(
      "What's the best stat for DPS?",
      "STR is primary for damage: +0.4% per point (max +200%). AGI for attack speed. Balance with DEF/VIT for survivability.",
      "It depends on your build. STR is good for raw damage, AGI for speed, LUK for crits. Try different combinations and see what works for your playstyle. Weapon choice matters too."
    ),
    pair(
      "Where is Lord Slug?",
      "Lord Slug is the Floor 3 boss, in the Floor 3 Dungeon Boss Room.",
      "Lord Slug can be found in various dungeon areas. Some players say he's in the swamp, others the caves. Explore Floor 3 to find him."
    ),
    pair(
      "What does X'rphan drop?",
      "X'rphan the White Wyrm drops Bourne Ore. Rare: Xrphans Feather, Auroras Cloak. Floor 5 boss.",
      "X'rphan drops various crafting materials and rare equipment. Drops depend on your luck stat and whether you get the last hit."
    ),
  ];
}

// --- Main ---

function main() {
  const bossData = loadBossData();
  const formulas = loadFormulas();

  const pairs = [
    ...generateBossPairs(bossData),
    ...generateStatPairs(formulas),
    ...generateBuildAdvicePairs(),
  ];

  // Deduplicate by prompt+chosen
  const seen = new Set();
  const deduped = pairs.filter((p) => {
    const key = p.prompt[0].content + "|||" + p.chosen[0].content;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(deduped, null, 2),
    "utf8"
  );
  console.log(
    `Generated ${deduped.length} DPO pairs → ${path.relative(ROOT, OUTPUT_PATH)}`
  );
}

main();
