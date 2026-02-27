/**
 * Shared boss readiness logic for Build Planner (AI context) and Boss Planner.
 * Requires: window.SBO_BOSS_DATA, window.SBO_DATA (for Boss Planner's computeMetrics; Build Planner uses its own evaluateBuild)
 */
(function () {
  "use strict";

  function round(v, dp) {
    const f = Math.pow(10, dp);
    return Math.round(v * f) / f;
  }

  function scoreBossReadiness(boss, build) {
    if (!build) return { verdict: "unknown", score: 0, checks: [] };

    const m = build.metrics;
    const checks = [];

    const hitsToKill = boss.hp / Math.max(1, m.dpsProjection);
    const dpsOk = hitsToKill <= 800;
    const dpsClose = hitsToKill <= 1600;
    checks.push({
      label: "DPS",
      ok: dpsOk,
      close: dpsClose,
      detail: `~${Math.round(hitsToKill)} hits to kill (DPS index ${round(m.dpsProjection, 1)})`,
    });

    const effectiveHp = m.bonusHp + m.damageReduction * 10;
    let survivabilityUnknown = false;
    if (boss.attack > 0) {
      const bossHitsToKillPlayer = effectiveHp / boss.attack;
      const survOk = bossHitsToKillPlayer >= 8;
      const survClose = bossHitsToKillPlayer >= 4;
      checks.push({
        label: "Survivability",
        ok: survOk,
        close: survClose,
        detail: `~${round(bossHitsToKillPlayer, 1)} boss hits to die (DR ${round(m.damageReduction, 0)}, HP ${round(m.bonusHp, 0)})`,
      });
    } else {
      survivabilityUnknown = true;
      checks.push({
        label: "Survivability",
        ok: false,
        close: false,
        unknown: true,
        detail: "Survivability unknown — boss ATK not in dataset",
      });
    }

    const levelOk = build.projectedLevel >= boss.recLevel;
    const levelClose = build.projectedLevel >= boss.recLevel * 0.85;
    checks.push({
      label: "Level",
      ok: levelOk,
      close: levelClose,
      detail: `Your projected Lv${build.projectedLevel} vs rec Lv${boss.recLevel}`,
    });

    const skillOk = build.weaponSkill >= boss.recSkill;
    const skillClose = build.weaponSkill >= boss.recSkill * 0.85;
    checks.push({
      label: "Weapon Skill",
      ok: skillOk,
      close: skillClose,
      detail: `Your skill ${build.weaponSkill} vs rec ${boss.recSkill}`,
    });

    if (boss.statusEffect) {
      const debuffOk = m.debuffResPct >= 3;
      const debuffClose = m.debuffResPct >= 1;
      checks.push({
        label: `${boss.statusEffect} Res`,
        ok: debuffOk,
        close: debuffClose,
        detail: `${round(m.debuffResPct, 1)}% debuff resistance vs ${boss.statusEffect}. Raise VIT or bring antidotes.`,
      });
    }

    const okCount = checks.filter((c) => c.ok).length;
    const closeCount = checks.filter((c) => !c.ok && c.close).length;
    const failCount = checks.filter((c) => !c.ok && !c.close).length;
    const unknownCount = checks.filter((c) => c.unknown).length;

    let verdict;
    if (failCount === 0 && okCount === checks.length) {
      verdict = "ready";
    } else if (failCount === 0) {
      verdict = "close";
    } else if (failCount <= 1 && okCount >= checks.length - 2) {
      verdict = "close";
    } else if (unknownCount > 0 && survivabilityUnknown && failCount === 1) {
      verdict = "unknown";
    } else {
      verdict = "notready";
    }

    const score = (okCount * 2 + closeCount) / (checks.length * 2);
    return { verdict, score, checks };
  }

  function getNextBoss(build, opts) {
    const bossData = window.SBO_BOSS_DATA;
    if (!bossData) return null;

    const beatenIds = opts?.beatenIds || [];

    const allBosses = [
      ...(bossData.bosses || []),
      ...(bossData.miniBosses || []).filter((b) => b.hp > 0),
    ].sort((a, b) => a.floor - b.floor || a.hp - b.hp);

    const eligible = allBosses.filter((b) => !beatenIds.includes(b.id));

    const incomplete = eligible.filter((b) => {
      const v = scoreBossReadiness(b, build).verdict;
      return v !== "ready";
    });
    const nextClose = incomplete.find((b) => scoreBossReadiness(b, build).verdict === "close");
    return nextClose || incomplete[0] || null;
  }

  function getStatAdvice(build, nextBoss) {
    if (!nextBoss) return null;
    const r = scoreBossReadiness(nextBoss, build);
    const weak = r.checks.filter((c) => !c.ok);

    const hasDps = weak.some((c) => c.label === "DPS");
    const hasSurv = weak.some((c) => c.label === "Survivability");
    const hasDebuff = weak.some((c) => c.label && c.label.includes("Res"));
    const hasLevel = weak.some((c) => c.label === "Level");
    const hasSkill = weak.some((c) => c.label === "Weapon Skill");

    const { str, def, vit } = build.stats || {};

    if (hasDps && hasSurv) {
      return str <= Math.min(def || 0, vit || 0)
        ? "↑ STR — DPS is the bigger gap. Boost damage output first."
        : "↑ DEF or VIT — survivability is critical before pushing further.";
    }
    if (hasDps) return "↑ STR — DPS index too low for this boss. More STR = more damage.";
    if (hasSurv) return (def || 0) < (vit || 0) ? "↑ DEF — damage reduction is the survivability gap here." : "↑ VIT — more bonus HP will help you survive hits.";
    if (hasDebuff) return `↑ VIT — raises debuff resistance against ${nextBoss.statusEffect || "status effects"}.`;
    if (hasSkill) return "Train weapon skill — skill level is the blocker for this boss.";
    if (hasLevel) return "Level up — need more levels before this boss is reachable.";
    return null;
  }

  window.SBO_BOSS_READINESS = {
    scoreBossReadiness,
    getNextBoss,
    getStatAdvice,
  };
})();
