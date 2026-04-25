(function projectionCoreInit() {
  function computeBuildMetrics(options) {
    const data = options?.data;
    const stats = options?.stats || {};
    const gear = options?.gear || {};
    const weaponClass = options?.weaponClass || "one-handed";
    const projectedLevel = Number(options?.projectedLevel) || 1;

    if (!data || !data.formulas || !data.weaponProfiles) {
      return {
        dpsProjection: 0,
        damageReduction: 0,
        bonusHp: 0,
        staminaPool: 0,
        critChancePct: 0,
        dropBonusPct: 0,
        multiHitPct: 50,
        debuffResPct: 0,
        attackSpeedPct: 100,
      };
    }

    const formulas = data.formulas;
    const profile = data.weaponProfiles[weaponClass] || data.weaponProfiles["one-handed"];
    const statCap = Number(data.statCap) || 500;

    const strDamageMult = 1 + (Number(stats.str) || 0) * (formulas.strDamagePerPointPct / 100);
    const agiSpeedMult = 1 + profile.maxAgiSpeedGain * ((Number(stats.agi) || 0) / statCap);

    const baseCrit = formulas.baseCritChancePct / 100;
    const lukCritBonus = Math.min(0.05, (Number(stats.luk) || 0) * (formulas.lukCritChancePerPointPct / 100));
    const critChance = baseCrit + lukCritBonus;

    const strCritMulti = ((Number(stats.str) || 0) / statCap) * (formulas.strCritMultiMax || 2);
    const critExpectedMult = 1 + critChance * (profile.critMultiplier - 1) + critChance * strCritMulti;

    const dpsProjection = (Number(gear.attack) || 0) * strDamageMult * agiSpeedMult * critExpectedMult;

    const defenseMultiplier = (formulas.defMultiplierBase || 5) + (Number(stats.def) || 0) * formulas.defMultiplierPerPoint;
    const damageReduction = (Number(gear.defense) || 0) * defenseMultiplier;

    const dexterityMultiplier = (formulas.vitDexterityMultiplierBase || 10) + (Number(stats.vit) || 0) * formulas.vitDexterityMultiplierPerPoint;
    const bonusHp = (Number(gear.dexterity) || 0) * dexterityMultiplier;

    const staminaPool = 100 + projectedLevel * 5 + 0.1 * ((Number(stats.str) || 0) + (Number(stats.agi) || 0) + (Number(stats.vit) || 0));
    const dropBonusPct = Math.min(5, (Number(stats.luk) || 0) * formulas.lukDropChancePerPointPct);

    const strMultiHit = Math.min(formulas.multiHitStatCapPct || 10, (Number(stats.str) || 0) * (formulas.strMultiHitPerPointPct || 0.02));
    const lukMultiHit = Math.min(formulas.multiHitStatCapPct || 10, (Number(stats.luk) || 0) * (formulas.lukMultiHitPerPointPct || 0.02));
    const combinedMultiHitBonus = Math.min(15, strMultiHit + lukMultiHit);
    const multiHitPct = (formulas.baseMultiHitPct || 50) + combinedMultiHitBonus;

    return {
      dpsProjection,
      damageReduction,
      bonusHp,
      staminaPool,
      critChancePct: critChance * 100,
      dropBonusPct,
      multiHitPct,
      debuffResPct: Math.min(5, 0.01 * (Number(stats.vit) || 0)),
      attackSpeedPct: agiSpeedMult * 100,
    };
  }

  window.SBO_PROJECTION_CORE = Object.freeze({
    computeBuildMetrics,
  });
})();
