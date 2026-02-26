/**
 * Test script for SBO Build Planner frontend context capture.
 * Simulates buildContext() from app.js and verifies output.
 */

function mockGetFormInput() {
  return {
    currentLevel: 50,
    levelsToPlan: 20,
    weaponClass: "one-handed",
    playstyle: "balanced",
    allocationMode: "adaptive",
    weaponSkill: 55,
    maxFloorReached: 5,
    stats: { str: 20, def: 10, agi: 10, vit: 15, luk: 0 },
    gear: { attack: 129, defense: 61.5, dexterity: 347 }
  };
}

function mockEvaluateBuild(stats, input, projectedLevel) {
  return {
    metrics: {
      dpsProjection: 1200,
      damageReduction: 450,
      bonusHp: 1500,
      critChancePct: 16.5,
      multiHitPct: 52,
      debuffResPct: 1.5
    }
  };
}

function buildContext() {
  const input = mockGetFormInput();
  const projectedLevel = input.currentLevel + input.levelsToPlan;
  const ctx = {
    level: input.currentLevel,
    projectedLevel,
    weaponClass: input.weaponClass,
    playstyle: input.playstyle,
    allocationMode: input.allocationMode,
    weaponSkill: input.weaponSkill,
    maxFloor: input.maxFloorReached,
    stats: input.stats,
    gear: input.gear,
  };

  // Simulate plan stale logic
  const evalResult = mockEvaluateBuild(input.stats, input, projectedLevel);
  const m = evalResult.metrics;
  ctx.metrics = {
    dpsProjection: m.dpsProjection,
    damageReduction: m.damageReduction,
    bonusHp: m.bonusHp,
    critChancePct: m.critChancePct,
    multiHitPct: m.multiHitPct,
    debuffResPct: m.debuffResPct,
  };

  return ctx;
}

function testContextCapture() {
  console.log("Testing Frontend Context Capture...");
  const ctx = buildContext();

  const requiredFields = [
    'level', 'projectedLevel', 'weaponClass', 'playstyle', 
    'allocationMode', 'weaponSkill', 'maxFloor', 'stats', 
    'gear', 'metrics'
  ];

  for (const field of requiredFields) {
    if (ctx[field] === undefined) {
      console.error(`Failed: Missing field ${field}`);
      return false;
    }
  }

  if (ctx.level !== 50 || ctx.projectedLevel !== 70) {
    console.error("Failed: Level calculation incorrect.");
    return false;
  }

  if (ctx.metrics.dpsProjection !== 1200) {
    console.error("Failed: Metrics not captured correctly.");
    return false;
  }

  console.log("Frontend context capture test passed.");
  return true;
}

if (testContextCapture()) {
  console.log("All frontend logic tests passed.");
} else {
  process.exit(1);
}
