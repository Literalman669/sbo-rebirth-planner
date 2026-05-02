(function bootstrapDashboardPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};

  function parseOwnedItems(raw) {
    return String(raw || "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function getBuildNames(builds) {
    if (Array.isArray(builds)) return builds.map((entry) => entry?.name).filter(Boolean);
    if (builds && typeof builds === "object") return Object.keys(builds);
    return [];
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function createBuildFromDraft(draft) {
    if (!draft || typeof draft !== "object" || !Object.keys(draft).length) return null;
    const currentLevel = Math.max(1, Math.trunc(toNumber(draft.currentLevel, 0)));
    if (!currentLevel) return null;
    const levelsToPlan = Math.max(1, Math.trunc(toNumber(draft.levelsToPlan, 1)));
    const projectedLevel = currentLevel + levelsToPlan;
    const stats = {
      str: toNumber(draft.str, 0),
      def: toNumber(draft.def, 0),
      agi: toNumber(draft.agi, 0),
      vit: toNumber(draft.vit, 0),
      luk: toNumber(draft.luk, 0),
    };
    const gear = {
      attack: Math.max(1, toNumber(draft.gearAttack, 1)),
      defense: Math.max(0, toNumber(draft.gearDefense, 0)),
      dexterity: Math.max(0, toNumber(draft.gearDexterity, 0)),
    };
    const weaponClass = String(draft.weaponClass || "two-handed");
    const metrics = window.SBO_PROJECTION_CORE?.computeBuildMetrics
      ? window.SBO_PROJECTION_CORE.computeBuildMetrics({ data: window.SBO_DATA, stats, gear, weaponClass, projectedLevel })
      : null;
    if (!metrics) return null;
    return {
      buildName: String(draft.buildName || "").trim(),
      currentLevel,
      projectedLevel,
      maxFloorReached: Math.max(1, Math.trunc(toNumber(draft.maxFloorReached, 1))),
      weaponClass,
      weaponSkill: Math.max(1, Math.trunc(toNumber(draft.weaponSkill, 1))),
      stats,
      gear,
      metrics,
    };
  }

  function renderActionCards({ draft, ownedItems, hasBuild, buildNames = [] }) {
    const build = createBuildFromDraft(draft);
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    const emptyState = document.getElementById("dashboardEmptyState");
    const actionGrid = document.getElementById("dashboardActionGrid");
    if (emptyState) emptyState.hidden = hasBuild;
    if (actionGrid) actionGrid.hidden = !hasBuild;

    if (!hasBuild) return;

    const buildLabel = build?.buildName || (build ? `Lv${build.currentLevel} ${build.weaponClass}` : "");
    const savedBuildLabel = buildNames[0] ? `"${buildNames[0]}"` : "a saved build";
    setText(
      "dashContinuePlanning",
      build ? `Resume ${buildLabel} in the Planner.` : `Open Planner to load ${savedBuildLabel}.`,
    );
    setText("dashInventoryStatus", ownedItems.length ? `${ownedItems.length} owned item token${ownedItems.length === 1 ? "" : "s"} saved. Open Inventory to review.` : "No owned inventory saved yet. Add items to improve gear recommendations.");

    const bossData = window.SBO_BOSS_DATA;
    const readiness = window.SBO_BOSS_READINESS;
    if (build && bossData && readiness?.getNextBoss && readiness?.scoreBossReadiness) {
      const beaten = state?.getJson(keys.bossBeaten, []) || [];
      const nextBoss = readiness.getNextBoss(build, { beatenIds: beaten });
      if (nextBoss) {
        const score = readiness.scoreBossReadiness(nextBoss, build);
        setText("dashNextBoss", `${nextBoss.name} on Floor ${nextBoss.floor || "?"}: ${score.verdict} (${Math.round(score.score * 100)}%).`);
      } else {
        setText("dashNextBoss", "No unbeaten boss target found for the current filters.");
      }
    } else {
      setText("dashNextBoss", "Boss readiness data is unavailable on this page.");
    }

    const catalog = window.SBO_DATA?.itemCatalog || [];
    const maxFloor = build?.maxFloorReached || 1;
    const ownedSet = new Set(ownedItems.map((item) => item.toLowerCase()));
    const upgrade = catalog.find((item) => {
      const floor = Number(item.floorMin) || 1;
      const id = String(item.id || "").toLowerCase();
      const name = String(item.name || "").toLowerCase();
      return floor <= maxFloor + 1 && !ownedSet.has(id) && !ownedSet.has(name);
    });
    setText(
      "dashNextGear",
      upgrade
        ? `${upgrade.name} (${upgrade.slot || "gear"}, Floor ${upgrade.floorMin || "?"}) is a missing catalog item near your progress.`
        : "No missing upgrade found from saved inventory and current floor.",
    );
  }

  function updateThemeToggle() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const isDark = () =>
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const sync = () => {
      btn.textContent = isDark() ? "☀" : "🌙";
      btn.title = isDark() ? "Switch to light mode" : "Switch to dark mode";
    };
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("sbo-theme", next); } catch (_) {}
      sync();
    });
    sync();
  }

  function renderDashboardSnapshot() {
    const builds = state?.getJson(keys.builds, {}) || {};
    const draft = state?.getJson(keys.formDraft, {}) || {};
    const equipped = state?.getJson(keys.equipped, { slots: {} }) || { slots: {} };
    const floorTracker = state?.getJson(keys.floorTracker, []) || [];

    const ownedCount = parseOwnedItems(draft.ownedItems).length;
    const equippedCount = Object.values(equipped?.slots || {}).filter(Boolean).length;
    const floorCount = Array.isArray(floorTracker) ? floorTracker.length : 0;
    const hasDraft = Boolean(Object.keys(draft || {}).length);
    const updatedAt = draft?.updatedAt || equipped?.updatedAt || null;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    const buildNames = getBuildNames(builds);
    const hasBuild = Boolean(hasDraft || buildNames.length);

    setText("dashSavedBuilds", buildNames.length);
    setText("dashOwnedItems", ownedCount);
    setText("dashEquipped", equippedCount);
    setText("dashFloors", floorCount);

    const updatedEl = document.getElementById("dashLastUpdated");
    if (updatedEl) {
      if (updatedAt) {
        const date = new Date(updatedAt);
        updatedEl.textContent = `Last updated: ${Number.isNaN(date.getTime()) ? updatedAt : date.toLocaleString()}`;
      } else if (hasDraft) {
        updatedEl.textContent = "Planner draft exists, but no update timestamp was saved.";
      } else if (buildNames.length) {
        updatedEl.textContent = "No current planner draft saved yet. Saved builds are available.";
      } else {
        updatedEl.textContent = "No draft state saved yet. Create your first build plan.";
      }
    }
    renderActionCards({ draft, ownedItems: parseOwnedItems(draft.ownedItems), hasBuild, buildNames });
  }

  updateThemeToggle();
  renderDashboardSnapshot();
  state?.subscribe([keys.builds, keys.formDraft, keys.equipped, keys.floorTracker], renderDashboardSnapshot);
})();
