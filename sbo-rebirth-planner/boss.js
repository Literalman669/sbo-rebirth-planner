(function bossPlannerInit() {
  const data = window.SBO_DATA;
  const bossData = window.SBO_BOSS_DATA;
  const FORM_DRAFT_KEY = "sbo-rebirth-planner.form-draft.v1";
  const EQUIPPED_KEY = "sbo-rebirth-planner.equipped.v1";

  // ── DOM refs ──────────────────────────────────────────────
  const buildSnapshotEl = document.getElementById("buildSnapshot");
  const bossListEl = document.getElementById("bossList");
  const refreshBtn = document.getElementById("refreshBuildBtn");
  const filterFloorEl = document.getElementById("filterFloor");
  const filterReadinessEl = document.getElementById("filterReadiness");
  const filterUnlockedEl = document.getElementById("filterUnlocked");
  const filterSearchEl = document.getElementById("filterSearch");
  const filterSortEl = document.getElementById("filterSort");
  const filterShowMiniEl = document.getElementById("filterShowMini");
  const filterHideBeatenEl = document.getElementById("filterHideBeaten");
  const buildStaleBannerEl = document.getElementById("buildStaleBanner");
  const bossListSummaryEl = document.getElementById("bossListSummary");
  const readinessPillsEl = document.getElementById("readinessPills");
  const bossModal = document.getElementById("bossModal");
  const bossModalContent = document.getElementById("bossModalContent");

  const FILTER_KEY = "sbo-rebirth-planner.boss-filters.v1";
  const BOSS_BEATEN_KEY = "sbo-rebirth-planner.boss-beaten.v1";
  const LAST_SYNCED_KEY = "sbo-rebirth-planner.boss-last-synced.v1";

  let currentBuild = null;
  let buildStaleFromOtherTab = false;
  let lastSyncedAt = null;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    currentBuild = loadBuildFromStorage();
    lastSyncedAt = Date.now();
    try { localStorage.setItem(LAST_SYNCED_KEY, String(lastSyncedAt)); } catch {}
    renderStaleBanner();
    renderBuildSnapshot(currentBuild);
    renderBossList();

    refreshBtn.addEventListener("click", () => {
      currentBuild = loadBuildFromStorage();
      lastSyncedAt = Date.now();
      buildStaleFromOtherTab = false;
      try { localStorage.setItem(LAST_SYNCED_KEY, String(lastSyncedAt)); } catch {}
      renderStaleBanner();
      renderBuildSnapshot(currentBuild);
      renderBossList();
      refreshBtn.classList.remove("needs-attention");
    });

    window.addEventListener("storage", (e) => {
      if (e.key === FORM_DRAFT_KEY || e.key === EQUIPPED_KEY) {
        buildStaleFromOtherTab = true;
        if (refreshBtn) refreshBtn.classList.add("needs-attention");
        renderStaleBanner();
        renderBuildSnapshot(currentBuild);
      }
    });

    loadFilters();

    filterFloorEl.addEventListener("input", () => { saveFilters(); renderBossList(); });
    filterReadinessEl.addEventListener("change", () => { saveFilters(); renderBossList(); });
    filterUnlockedEl.addEventListener("change", () => { saveFilters(); renderBossList(); });
    filterSearchEl.addEventListener("input", renderBossList);
    filterSortEl.addEventListener("change", () => { saveFilters(); renderBossList(); });
    filterShowMiniEl.addEventListener("change", () => { saveFilters(); renderBossList(); });
    if (filterHideBeatenEl) filterHideBeatenEl.addEventListener("change", () => { saveFilters(); renderBossList(); });

    bossModal.addEventListener("click", (e) => {
      if (e.target === bossModal) bossModal.close();
    });

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (themeToggleBtn) {
      const isDark = () =>
        document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);

      const syncThemeBtn = () => {
        const dark = isDark();
        themeToggleBtn.textContent = dark ? "☀" : "🌙";
        themeToggleBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
      };

      themeToggleBtn.addEventListener("click", () => {
        const next = isDark() ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("sbo-theme", next); } catch (e) {}
        syncThemeBtn();
      });

      syncThemeBtn();
    }

    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const sidebarContent   = document.getElementById("sidebarContent");
    if (sidebarToggleBtn && sidebarContent) {
      sidebarToggleBtn.addEventListener("click", () => {
        const collapsed = sidebarContent.classList.toggle("collapsed");
        sidebarToggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    }

    document.addEventListener("keydown", (e) => {
      if (!bossModal.open) return;
      if (e.key === "ArrowRight") document.getElementById("modalNextBtn")?.click();
      if (e.key === "ArrowLeft")  document.getElementById("modalPrevBtn")?.click();
      if (e.key === "Escape")     bossModal.close();
    });

    bossListEl.addEventListener("click", (e) => {
      const beatenBtn = e.target.closest(".boss-beaten-btn");
      if (beatenBtn) {
        toggleBossBeaten(beatenBtn.dataset.bossId);
        renderBossList();
        return;
      }
      const card = e.target.closest("[data-boss-id]");
      if (!card) return;
      const bossId = card.dataset.bossId;
      const boss =
        bossData.bosses.find((b) => b.id === bossId) ||
        (bossData.miniBosses || []).find((b) => b.id === bossId);
      if (boss) openBossModal(boss, currentBuild);
    });
  }

  // ── Load build from localStorage draft ───────────────────
  function loadBuildFromStorage() {
    try {
      const raw = localStorage.getItem(FORM_DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);

      const equippedRaw = localStorage.getItem(EQUIPPED_KEY);
      const equipped = equippedRaw ? JSON.parse(equippedRaw) : {};

      return buildFromDraft(draft, equipped);
    } catch {
      return null;
    }
  }

  function readBossBeatenStorage() {
    try {
      const raw = localStorage.getItem(BOSS_BEATEN_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeBossBeatenStorage(ids) {
    try {
      localStorage.setItem(BOSS_BEATEN_KEY, JSON.stringify(ids));
    } catch {}
  }

  function toggleBossBeaten(id) {
    const beaten = readBossBeatenStorage();
    const idx = beaten.indexOf(id);
    if (idx >= 0) {
      beaten.splice(idx, 1);
    } else {
      beaten.push(id);
    }
    beaten.sort();
    writeBossBeatenStorage(beaten);
  }

  function buildFromDraft(draft, equipped) {
    const toInt = (v, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
    const toNum = (v, def) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const currentLevel = clamp(toInt(draft.currentLevel, 1), 1, 1000);
    const levelsToPlan = clamp(toInt(draft.levelsToPlan, 20), 1, 200);
    const projectedLevel = currentLevel + levelsToPlan;
    const weaponClass = draft.weaponClass || "one-handed";
    const playstyle = draft.playstyle || "balanced";
    const weaponSkill = clamp(toInt(draft.weaponSkill, 1), 1, 10000);
    const maxFloor = clamp(toInt(draft.maxFloorReached, 1), 1, 18);

    const stats = {
      str: clamp(toInt(draft.str, 0), 0, 500),
      def: clamp(toInt(draft.def, 0), 0, 500),
      agi: clamp(toInt(draft.agi, 0), 0, 500),
      vit: clamp(toInt(draft.vit, 0), 0, 500),
      luk: clamp(toInt(draft.luk, 0), 0, 500),
    };

    const gear = {
      attack: Math.max(1, toNum(draft.gearAttack, 30)),
      defense: Math.max(0, toNum(draft.gearDefense, 35)),
      dexterity: Math.max(0, toNum(draft.gearDexterity, 140)),
    };

    const metrics = computeMetrics(stats, gear, weaponClass, projectedLevel);

    return {
      currentLevel,
      projectedLevel,
      weaponClass,
      playstyle,
      weaponSkill,
      maxFloor,
      stats,
      gear,
      metrics,
      equipped,
    };
  }

  // ── Replicate evaluateBuild formula from app.js ───────────
  function computeMetrics(stats, gear, weaponClass, projectedLevel) {
    const f = data.formulas;
    const profile = data.weaponProfiles[weaponClass] || data.weaponProfiles["one-handed"];

    const strDamageMult = 1 + stats.str * (f.strDamagePerPointPct / 100);
    const agiSpeedMult = 1 + profile.maxAgiSpeedGain * (stats.agi / data.statCap);

    const baseCrit = f.baseCritChancePct / 100;
    const lukCritBonus = Math.min(0.05, stats.luk * (f.lukCritChancePerPointPct / 100));
    const critChance = baseCrit + lukCritBonus;

    const strCritMulti = (stats.str / data.statCap) * (f.strCritMultiMax || 2);
    const critExpectedMult = 1 + critChance * (profile.critMultiplier - 1) + critChance * strCritMulti;

    const dpsProjection = gear.attack * strDamageMult * agiSpeedMult * critExpectedMult;

    const defenseMultiplier = (f.defMultiplierBase || 5) + stats.def * f.defMultiplierPerPoint;
    const damageReduction = gear.defense * defenseMultiplier;

    const dexterityMultiplier = (f.vitDexterityMultiplierBase || 10) + stats.vit * f.vitDexterityMultiplierPerPoint;
    const bonusHp = gear.dexterity * dexterityMultiplier;

    const staminaPool = 100 + projectedLevel * 5 + 0.1 * (stats.str + stats.agi + stats.vit);

    const strMultiHit = Math.min(f.multiHitStatCapPct || 10, stats.str * (f.strMultiHitPerPointPct || 0.02));
    const lukMultiHit = Math.min(f.multiHitStatCapPct || 10, stats.luk * (f.lukMultiHitPerPointPct || 0.02));
    const multiHitPct = (f.baseMultiHitPct || 50) + Math.min(15, strMultiHit + lukMultiHit);

    const debuffResPct = Math.min(5, 0.01 * stats.vit);
    const dropBonusPct = Math.min(5, stats.luk * f.lukDropChancePerPointPct);

    return {
      dpsProjection,
      damageReduction,
      bonusHp,
      staminaPool,
      critChancePct: critChance * 100,
      multiHitPct,
      debuffResPct,
      dropBonusPct,
      attackSpeedPct: agiSpeedMult * 100,
    };
  }

  // ── Boss readiness (shared module) ────────────────────────
  const readiness = window.SBO_BOSS_READINESS;
  const scoreBossReadiness = readiness ? (b, build) => readiness.scoreBossReadiness(b, build) : () => ({ verdict: "unknown", score: 0, checks: [] });
  const getNextBoss = readiness ? (build) => readiness.getNextBoss(build) : () => null;
  const getStatAdvice = readiness ? (build, next) => readiness.getStatAdvice(build, next) : () => null;

  // ── Playstyle badge helper ────────────────────────────────
  function getPlaystyleBadge(stats) {
    const { str, def, agi, vit, luk } = stats;
    const total = str + def + agi + vit + luk;
    if (total === 0) return { label: "No Stats", cls: "badge-unknown" };
    const pct = (v) => v / total;
    const dominant = Object.entries({ str, agi, vit, luk })
      .sort((a, b) => b[1] - a[1])[0];
    const domPct = pct(dominant[1]);
    if (domPct >= 0.45) {
      const map = { str: ["Damage", "badge-str"], agi: ["Speed", "badge-agi"], vit: ["Tank", "badge-vit"], luk: ["Farmer", "badge-luk"] };
      const [label, cls] = map[dominant[0]] || ["Balanced", "badge-balanced"];
      return { label, cls };
    }
    if (pct(str) >= 0.28 && pct(vit) >= 0.22) return { label: "Bruiser", cls: "badge-bruiser" };
    if (pct(agi) >= 0.28 && pct(str) >= 0.22) return { label: "Skirmisher", cls: "badge-skirmisher" };
    return { label: "Balanced", cls: "badge-balanced" };
  }

  // ── Build strength bar helper ─────────────────────────────
  function getBuildStrength(build) {
    const allBosses = bossData.bosses.filter(b => b.hp > 0);
    if (!allBosses.length) return 0;
    const readyCount = allBosses.filter(b => scoreBossReadiness(b, build).verdict === "ready").length;
    return Math.round((readyCount / allBosses.length) * 100);
  }

  function renderStaleBanner() {
    if (!buildStaleBannerEl) return;
    buildStaleBannerEl.hidden = !buildStaleFromOtherTab;
  }

  function formatLastSynced(ms) {
    if (!ms) return "";
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    return `${hr} hr ago`;
  }

  // ── Render build snapshot ─────────────────────────────────
  function renderBuildSnapshot(build) {
    if (!build) {
      buildSnapshotEl.innerHTML = `
        <p class="muted-text">No build found. Open the <a href="./index.html">Build Planner</a>, fill in your stats, and generate a plan.</p>
        <div class="snapshot-no-build-cta">
          <a href="./index.html" class="cta-btn">Go to Build Planner →</a>
        </div>
      `;
      return;
    }

    const m = build.metrics;
    const profile = data.weaponProfiles[build.weaponClass];
    const badge = getPlaystyleBadge(build.stats);
    const strengthPct = getBuildStrength(build);
    const nextBoss = getNextBoss(build);
    const advice = getStatAdvice(build, nextBoss);

    const strengthFillClass = strengthPct >= 70 ? "fill-good" : strengthPct >= 40 ? "fill-warn" : "fill-danger";

    // Gear name lookup
    const catalog = data.itemCatalog || [];
    const lookupItem = (id) => id ? catalog.find((it) => it.id === id) : null;
    const eq = build.equipped?.slots || {};
    const weaponItem = lookupItem(eq.weapon);
    const armourItems = ["armor", "upper", "lower", "shield"].map((s) => lookupItem(eq[s])).filter(Boolean);
    const hasGear = weaponItem || armourItems.length > 0;

    buildSnapshotEl.innerHTML = `
      <div class="snapshot-header-row">
        <div class="snapshot-grid">
          <div class="snapshot-item">
            <span class="snapshot-label">Level</span>
            <strong>${build.currentLevel} → ${build.projectedLevel}</strong>
          </div>
          <div class="snapshot-item">
            <span class="snapshot-label">Weapon</span>
            <strong>${escHtml(profile?.label || build.weaponClass)}</strong>
          </div>
          <div class="snapshot-item">
            <span class="snapshot-label">Skill</span>
            <strong>${build.weaponSkill}</strong>
          </div>
          <div class="snapshot-item">
            <span class="snapshot-label">Max Floor</span>
            <strong>${build.maxFloor}</strong>
          </div>
        </div>
        <span class="playstyle-badge ${badge.cls}">${badge.label}</span>
      </div>

      <div class="snapshot-stats">
        <span title="STR">STR ${build.stats.str}</span>
        <span title="DEF">DEF ${build.stats.def}</span>
        <span title="AGI">AGI ${build.stats.agi}</span>
        <span title="VIT">VIT ${build.stats.vit}</span>
        <span title="LUK">LUK ${build.stats.luk}</span>
      </div>

      ${hasGear ? `<div class="snapshot-gear-row">
        ${weaponItem ? `<span class="snapshot-gear-item gear-weapon" title="Equipped weapon">⚔ ${escHtml(weaponItem.name)}</span>` : ""}
        ${armourItems.length ? `<span class="snapshot-gear-item gear-armour" title="Equipped armour">🛡 ${armourItems.map((i) => escHtml(i.name)).join(", ")}</span>` : ""}
      </div>` : ""}

      <div class="snapshot-metrics">
        <div class="snap-metric">
          <span>DPS Index</span>
          <strong>${round(m.dpsProjection, 1)}</strong>
        </div>
        <div class="snap-metric">
          <span>Dmg Reduction</span>
          <strong>${round(m.damageReduction, 0)}</strong>
        </div>
        <div class="snap-metric">
          <span>Bonus HP</span>
          <strong>${round(m.bonusHp, 0)}</strong>
        </div>
        <div class="snap-metric">
          <span>Crit %</span>
          <strong>${round(m.critChancePct, 1)}%</strong>
        </div>
        <div class="snap-metric">
          <span>Stamina</span>
          <strong>${round(m.staminaPool, 0)}</strong>
        </div>
        <div class="snap-metric">
          <span>Multi-Hit %</span>
          <strong>${round(m.multiHitPct, 1)}%</strong>
        </div>
      </div>

      <div class="build-strength-section">
        <div class="build-strength-label">
          <span>Build Strength</span>
          <span class="build-strength-pct">${strengthPct}% of bosses ready</span>
        </div>
        <div class="build-strength-bar">
          <div class="build-strength-fill ${strengthFillClass}" style="width:${strengthPct}%"></div>
        </div>
      </div>

      ${nextBoss ? `
      <div class="next-boss-rec">
        <div class="next-boss-top">
          <span class="next-boss-label">Next Target</span>
          <span class="next-boss-floor">Floor ${nextBoss.floor}</span>
        </div>
        <span class="next-boss-name">${escHtml(nextBoss.name)}</span>
      </div>` : `<p class="next-boss-done">✓ All bosses ready!</p>`}

      ${advice ? `<div class="snapshot-advice"><span class="advice-icon">💡</span><span>${escHtml(advice)}</span></div>` : ""}

      ${buildStaleFromOtherTab ? `<div class="snapshot-stale-banner">Build updated — click <strong>Refresh from Planner</strong> to see latest.</div>` : ""}
      ${lastSyncedAt ? `<div class="snapshot-last-synced">Last synced ${formatLastSynced(lastSyncedAt)}</div>` : ""}
    `;
  }

  // ── Filter persistence ────────────────────────────────────
  function saveFilters() {
    try {
      const obj = {
        floor: filterFloorEl.value,
        readiness: filterReadinessEl.value,
        unlocked: filterUnlockedEl.checked,
        sort: filterSortEl.value,
        showMini: filterShowMiniEl.checked,
      };
      if (filterHideBeatenEl) obj.hideBeaten = filterHideBeatenEl.checked;
      localStorage.setItem(FILTER_KEY, JSON.stringify(obj));
    } catch {}
  }

  function loadFilters() {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (!raw) return;
      const f = JSON.parse(raw);
      if (f.floor) filterFloorEl.value = f.floor;
      if (f.readiness) filterReadinessEl.value = f.readiness;
      if (f.unlocked !== undefined) filterUnlockedEl.checked = f.unlocked;
      if (f.sort) filterSortEl.value = f.sort;
      if (f.showMini !== undefined) filterShowMiniEl.checked = f.showMini;
      if (filterHideBeatenEl && f.hideBeaten !== undefined) filterHideBeatenEl.checked = f.hideBeaten;
    } catch {}
  }

  // ── Render boss list ──────────────────────────────────────
  function renderBossList() {
    const maxFloor = parseInt(filterFloorEl.value, 10) || 18;
    const readinessFilter = filterReadinessEl.value;
    const unlockedOnly = filterUnlockedEl.checked;
    const showMini = filterShowMiniEl.checked;
    const hideBeaten = filterHideBeatenEl?.checked || false;
    const sortBy = filterSortEl.value;
    const searchTerm = filterSearchEl.value.trim().toLowerCase();
    const playerMaxFloor = currentBuild?.maxFloor || 18;
    const beatenIds = readBossBeatenStorage();

    const applySearch = (b) => !searchTerm || b.name.toLowerCase().includes(searchTerm);
    const applyBeatenFilter = (b) => !hideBeaten || !beatenIds.includes(b.id);

    // Floor bosses
    let bosses = bossData.bosses.filter((b) => b.floor <= maxFloor && applySearch(b) && applyBeatenFilter(b));
    if (unlockedOnly) bosses = bosses.filter((b) => b.floor <= playerMaxFloor);
    const scoredBosses = bosses.map((boss) => ({ boss, readiness: scoreBossReadiness(boss, currentBuild) }));
    const filteredBosses = scoredBosses.filter(({ readiness }) => applyReadinessFilter(readiness, readinessFilter));

    // Mini bosses
    let filteredMini = [];
    if (showMini) {
      const allMini = bossData.miniBosses || [];
      const knownMini = allMini.filter((b) => b.hp > 0);
      const stubMini = allMini.filter((b) => b.hp === 0);
      let miniBosses = knownMini.filter((b) => b.floor <= maxFloor && applySearch(b) && applyBeatenFilter(b));
      if (unlockedOnly) miniBosses = miniBosses.filter((b) => b.floor <= playerMaxFloor);
      if (!unlockedOnly) {
        const matchingStubs = stubMini.filter((b) => applySearch(b) && applyBeatenFilter(b));
        miniBosses = [...miniBosses, ...matchingStubs];
      }
      const scoredMini = miniBosses.map((boss) => ({ boss, readiness: scoreBossReadiness(boss, currentBuild) }));
      filteredMini = scoredMini.filter(({ readiness }) => applyReadinessFilter(readiness, readinessFilter));
    }

    // Sort
    const sortFn = (a, b) => {
      if (sortBy === "hp-asc") return a.boss.hp - b.boss.hp;
      if (sortBy === "hp-desc") return b.boss.hp - a.boss.hp;
      if (sortBy === "readiness") return b.readiness.score - a.readiness.score;
      return a.boss.floor - b.boss.floor;
    };
    filteredBosses.sort(sortFn);
    filteredMini.sort(sortFn);

    // Summary bar
    const allFiltered = [...filteredBosses, ...filteredMini];
    const readyCnt = allFiltered.filter(({ readiness }) => readiness.verdict === "ready").length;
    const closeCnt = allFiltered.filter(({ readiness }) => readiness.verdict === "close").length;
    const notReadyCnt = allFiltered.filter(({ readiness }) => readiness.verdict === "notready").length;
    const unknownCnt = allFiltered.filter(({ readiness }) => readiness.verdict === "unknown").length;

    bossListSummaryEl.textContent = `Showing ${filteredBosses.length} floor boss${filteredBosses.length !== 1 ? "es" : ""}${
      showMini ? `, ${filteredMini.length} mini boss${filteredMini.length !== 1 ? "es" : ""}` : ""
    }`;

    readinessPillsEl.innerHTML = [
      readyCnt ? `<span class="rpill verdict-ready">✓ ${readyCnt} Ready</span>` : "",
      closeCnt ? `<span class="rpill verdict-close">~ ${closeCnt} Close</span>` : "",
      notReadyCnt ? `<span class="rpill verdict-notready">✗ ${notReadyCnt} Not Ready</span>` : "",
      unknownCnt ? `<span class="rpill verdict-unknown">? ${unknownCnt} Unknown</span>` : "",
      beatenIds.length > 0 ? `<span class="rpill boss-beaten-pill">✓ Beaten: ${beatenIds.length}</span>` : "",
    ].filter(Boolean).join("");

    if (!allFiltered.length) {
      bossListEl.innerHTML = `<p class="muted-text" style="padding:2rem">No bosses match the current filters.</p>`;
      return;
    }

    let html = "";

    if (filteredBosses.length) {
      html += `<div class="boss-section-header"><h2>Floor Bosses</h2></div>`;
      html += filteredBosses.map(({ boss, readiness }) => renderBossCard(boss, readiness)).join("");
    }

    if (filteredMini.length) {
      html += `<div class="boss-section-header mini-section"><h2>Mini Bosses</h2></div>`;
      html += filteredMini.map(({ boss, readiness }) => renderBossCard(boss, readiness)).join("");
    }

    bossListEl.innerHTML = html;
  }

  function applyReadinessFilter(readiness, filter) {
    if (filter === "all") return true;
    if (filter === "ready") return readiness.verdict === "ready";
    if (filter === "close") return readiness.verdict === "ready" || readiness.verdict === "close";
    if (filter === "notready") return readiness.verdict === "notready";
    return true;
  }

  function renderBossCard(boss, readiness) {
    const beatenIds = readBossBeatenStorage();
    const isBeaten = beatenIds.includes(boss.id);

    const verdictClass = {
      ready: "verdict-ready",
      close: "verdict-close",
      notready: "verdict-notready",
      unknown: "verdict-unknown",
    }[readiness.verdict] || "verdict-unknown";

    const verdictLabel = {
      ready: "Ready",
      close: "Close",
      notready: "Not Ready",
      unknown: "Unknown",
    }[readiness.verdict] || "Unknown";

    const beatenBadge = isBeaten ? '<span class="boss-beaten-badge">✓ Beaten</span>' : "";
    const beatenBtn = isBeaten
      ? `<button type="button" class="boss-beaten-btn secondary compact" data-boss-id="${escHtml(boss.id)}" title="Unmark as beaten">Unmark</button>`
      : `<button type="button" class="boss-beaten-btn secondary compact" data-boss-id="${escHtml(boss.id)}" title="Mark as beaten">Mark beaten</button>`;

    const checksHtml = readiness.checks.map((c) => {
      const cls = c.ok ? "check-ok" : c.close ? "check-close" : "check-fail";
      const icon = c.ok ? "✓" : c.close ? "~" : "✗";
      return `<span class="boss-check ${cls}" title="${escHtml(c.detail)}">${icon} ${escHtml(c.label)}</span>`;
    }).join("");

    const phases = boss.phases || [];
    const phasePips = phases.map((p, i) => {
      const pct = 100 - (phases[i + 1]?.hpThresholdPct ?? 0);
      return `<span class="phase-pip" title="${escHtml(p.name)}: ${escHtml(p.notes)}" style="width:${pct}%"></span>`;
    }).join("");

    const weakHtml = (boss.weaknesses || []).length
      ? `<span class="boss-tag weak">Weak: ${(boss.weaknesses || []).join(", ")}</span>`
      : "";

    const estimateNote = !boss.exactStats
      ? `<span class="boss-tag estimate" title="${escHtml(boss.estimateNote || 'Stats not confirmed from wiki')}">⚠ Estimated</span>`
      : "";

    const floorLabel = boss.floor > 0 ? `Floor ${boss.floor}` : `Floor ?`;

    const scoreBarFillClass = { ready: "fill-ready", close: "fill-close", notready: "fill-notready", unknown: "fill-unknown" }[readiness.verdict] || "fill-unknown";
    const scoreBarPct = Math.round(readiness.score * 100);

    return `
      <article class="boss-card ${verdictClass}${isBeaten ? " boss-beaten" : ""}" data-boss-id="${escHtml(boss.id)}">
        <div class="card-readiness-bar" title="Readiness: ${scoreBarPct}%">
          <div class="card-readiness-fill ${scoreBarFillClass}" style="width:${scoreBarPct}%"></div>
        </div>
        <div class="boss-card-header">
          <div class="boss-card-title">
            <span class="boss-floor-badge">${floorLabel}</span>
            <h3>${escHtml(boss.name)}</h3>
            ${beatenBadge}
          </div>
          <span class="boss-verdict ${verdictClass}">${verdictLabel}</span>
        </div>

        ${boss.location ? `<p class="boss-location">📍 ${escHtml(boss.location)}</p>` : ""}

        <div class="boss-card-stats">
          ${boss.hp > 0 ? `<span title="HP">HP ${formatNum(boss.hp)}</span>` : ""}
          ${boss.recLevel > 0 ? `<span title="Recommended Level">Rec Lv${boss.recLevel}</span>` : ""}
          ${boss.recSkill > 0 ? `<span title="Recommended Skill">Skill ${boss.recSkill}+</span>` : ""}
          ${boss.exp ? `<span title="Experience">EXP ${formatNum(boss.exp)}</span>` : ""}
        </div>

        <div class="boss-phase-bar" title="Boss phases">
          ${phasePips}
        </div>

        <div class="boss-checks">${checksHtml}</div>

        <div class="boss-tags">
          ${boss.type === "mini" ? `<span class="boss-tag mini-boss-badge">Mini Boss</span>` : ""}
          ${boss.statusEffect ? `<span class="boss-tag status-effect" title="Status effect this boss inflicts">⚡ ${escHtml(boss.statusEffect)}</span>` : ""}
          ${weakHtml}
          ${estimateNote}
          ${phases.length > 1 ? `<span class="boss-tag phases">${phases.length} phases</span>` : ""}
        </div>

        <p class="boss-notes">${escHtml(boss.notes)}</p>
        <div class="boss-card-actions">
          ${beatenBtn}
          <button type="button" class="boss-card-cta">View Details →</button>
        </div>
      </article>
    `;
  }

  // ── Boss detail modal ─────────────────────────────────────
  function openBossModal(boss, build) {
    const readiness = scoreBossReadiness(boss, build);

    const verdictClass = {
      ready: "verdict-ready",
      close: "verdict-close",
      notready: "verdict-notready",
      unknown: "verdict-unknown",
    }[readiness.verdict] || "verdict-unknown";

    const verdictLabel = { ready: "Ready", close: "Close", notready: "Not Ready", unknown: "Unknown" }[readiness.verdict] || "Unknown";
    const floorLabel = boss.floor > 0 ? `Floor ${boss.floor}` : `Floor ?`;
    const wikiName = boss.name.replace(/ /g, "_").replace(/'/g, "%27").replace(/,/g, "%2C");
    const wikiUrl = boss.wikiUrl || `https://swordbloxonlinerebirth.fandom.com/wiki/${wikiName}`;

    const modalPhases = boss.phases || [];
    const phasesHtml = modalPhases.map((p, i) => `
      <div class="modal-phase">
        <span class="phase-number phase-${i + 1}">${i + 1}</span>
        <div class="phase-content">
          <div class="phase-name-row">
            <strong>${escHtml(p.name)}</strong>
            ${p.hpThresholdPct < 100 ? `<span class="phase-threshold">≤${p.hpThresholdPct}% HP</span>` : ""}
          </div>
          <p>${escHtml(p.notes)}</p>
        </div>
      </div>
    `).join("");

    const checksHtml = readiness.checks.map((c) => {
      const cls = c.ok ? "check-ok" : c.close ? "check-close" : "check-fail";
      const icon = c.ok ? "✓" : c.close ? "~" : "✗";
      return `
        <div class="modal-check ${cls}">
          <span class="check-icon">${icon}</span>
          <div class="modal-check-text">
            <strong>${escHtml(c.label)}</strong>
            <p>${escHtml(c.detail)}</p>
          </div>
        </div>
      `;
    }).join("");

    const dropsHtml = [
      ...(boss.drops || []).map((d) => `<span class="drop-tag">${escHtml(d)}</span>`),
      ...(boss.rareDrops || []).map((d) => `<span class="drop-tag rare">${escHtml(d)}</span>`),
      boss.lastHitDrop ? `<span class="drop-tag last-hit" title="Last hit bonus">⭐ ${escHtml(boss.lastHitDrop)}</span>` : "",
    ].filter(Boolean).join("");

    const resistHtml = Object.entries(boss.resistances || {})
      .filter(([, v]) => v !== 0)
      .map(([type, v]) => {
        const cls = v < 0 ? "res-weak" : "res-resist";
        const label = v < 0 ? `Weak to ${type} (${Math.round(Math.abs(v) * 100)}% bonus dmg)` : `Resists ${type} (${Math.round(v * 100)}% less dmg)`;
        return `<span class="res-tag ${cls}">${escHtml(label)}</span>`;
      }).join("") || `<span class="muted-text">No special resistances</span>`;

    bossModalContent.innerHTML = `
      <div class="modal-sticky-header">
        <div class="modal-title-group">
          <span class="boss-floor-badge">${floorLabel}</span>
          <div>
            <h2>${escHtml(boss.name)}</h2>
            ${boss.location ? `<p class="modal-location">📍 ${escHtml(boss.location)}</p>` : ""}
          </div>
        </div>
        <div class="modal-header-right">
          <span class="boss-verdict ${verdictClass}">${verdictLabel}</span>
          <button type="button" class="boss-modal-close" id="bossModalClose" aria-label="Close">✕</button>
        </div>
      </div>

      <div class="modal-body">
        ${!boss.exactStats ? `
        <div class="modal-estimate-banner">
          <span class="estimate-icon">⚠️</span>
          <span>${escHtml(boss.estimateNote || "Some stats for this boss are unconfirmed. Values are estimated from game formula patterns.")}</span>
        </div>` : ""}

        <div class="modal-section">
          <p class="modal-section-title">Boss Stats</p>
          <div class="modal-stats-grid">
            <div class="modal-stat-cell"><span>HP</span><strong>${boss.hp > 0 ? formatNum(boss.hp) : "?"}</strong></div>
            <div class="modal-stat-cell"><span>EXP</span><strong>${boss.exp > 0 ? formatNum(boss.exp) : "?"}</strong></div>
            <div class="modal-stat-cell"><span>Col</span><strong>${boss.col > 0 ? formatNum(boss.col) : "?"}</strong></div>
            <div class="modal-stat-cell"><span>Rec Level</span><strong>${boss.recLevel > 0 ? boss.recLevel + "+" : "?"}</strong></div>
            <div class="modal-stat-cell"><span>Rec Skill</span><strong>${boss.recSkill > 0 ? boss.recSkill + "+" : "?"}</strong></div>
            <div class="modal-stat-cell"><span>Status</span><strong>${escHtml(boss.statusEffect || "None")}</strong></div>
            ${boss.respawnTime ? `<div class="modal-stat-cell"><span>Respawn</span><strong>${escHtml(boss.respawnTime)}</strong></div>` : ""}
            ${build ? `<div class="modal-stat-cell"><span>Drop Bonus</span><strong>+${round(build.metrics.dropBonusPct, 1)}%</strong></div>` : ""}
          </div>
        </div>

        <div class="modal-section">
          <p class="modal-section-title">Your Readiness</p>
          <div class="modal-checks">${checksHtml}</div>
        </div>

        <div class="modal-section">
          <p class="modal-section-title" data-collapsible>Phases <span class="collapse-caret">▾</span></p>
          <div class="modal-phases">${phasesHtml}</div>
        </div>

        <div class="modal-section">
          <p class="modal-section-title" data-collapsible>Resistances &amp; Weaknesses <span class="collapse-caret">▾</span></p>
          <div class="res-tags">${resistHtml}</div>
        </div>

        <div class="modal-section">
          <p class="modal-section-title" data-collapsible>Drops <span class="collapse-caret">▾</span></p>
          <div class="drop-tags">${dropsHtml || "<span class='muted-text'>No known drops</span>"}</div>
        </div>

        <div class="modal-footer">
          <a href="${wikiUrl}" target="_blank" rel="noopener" class="wiki-link">🔗 View on Wiki ↗</a>
          <div class="modal-footer-right">
            <button type="button" class="modal-copy-btn" id="modalCopyBtn">Copy Info</button>
            <div class="modal-nav">
              <button type="button" class="modal-nav-btn" id="modalPrevBtn">← Prev</button>
              <button type="button" class="modal-nav-btn" id="modalNextBtn">Next →</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("bossModalClose").addEventListener("click", () => bossModal.close());
    document.getElementById("modalPrevBtn").addEventListener("click", () => navigateModal(boss, -1));
    document.getElementById("modalNextBtn").addEventListener("click", () => navigateModal(boss, 1));
    document.getElementById("modalCopyBtn").addEventListener("click", () => copyBossInfo(boss, build));

    // Collapsible sections
    bossModalContent.querySelectorAll(".modal-section-title[data-collapsible]").forEach((title) => {
      title.addEventListener("click", () => {
        const section = title.closest(".modal-section");
        section.classList.toggle("collapsed");
      });
    });

    bossModal.showModal();
    bossModalContent.scrollTop = 0;
  }

  function navigateModal(currentBoss, direction) {
    const allBosses = [
      ...bossData.bosses,
      ...(bossData.miniBosses || []).filter((b) => b.hp > 0),
    ];
    const idx = allBosses.findIndex((b) => b.id === currentBoss.id);
    const next = allBosses[idx + direction];
    if (next) openBossModal(next, currentBuild);
  }

  function copyBossInfo(boss, build) {
    const drops = [
      ...(boss.drops || []),
      ...(boss.rareDrops || []).map((d) => d + " (rare)"),
      boss.lastHitDrop ? boss.lastHitDrop + " (last hit)" : null,
    ].filter(Boolean).join(", ") || "None";

    const readiness = build ? scoreBossReadiness(boss, build) : null;
    const readinessLine = readiness ? `Readiness: ${readiness.verdict}` : "";

    const text = [
      `${boss.name} — Floor ${boss.floor}`,
      `HP: ${boss.hp > 0 ? boss.hp.toLocaleString() : "?"}  |  EXP: ${boss.exp > 0 ? boss.exp.toLocaleString() : "?"}  |  Col: ${boss.col > 0 ? boss.col.toLocaleString() : "?"}`,
      `Status: ${boss.statusEffect || "None"}  |  Respawn: ${boss.respawnTime || "Unknown"}`,
      `Location: ${boss.location || "Unknown"}`,
      `Drops: ${drops}`,
      readinessLine,
      boss.estimateNote ? `Note: ${boss.estimateNote}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("modalCopyBtn");
      if (btn) { btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = "Copy Info"; }, 1800); }
    }).catch(() => {});
  }

  // ── Utilities ─────────────────────────────────────────────
  function round(v, dp) {
    const f = Math.pow(10, dp);
    return Math.round(v * f) / f;
  }

  function formatNum(n) {
    if (n >= 1000000) return `${round(n / 1000000, 1)}M`;
    if (n >= 1000) return `${round(n / 1000, 1)}k`;
    return String(n);
  }

  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  init();
})();
