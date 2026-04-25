(function nextActionHintInit() {
  const container = document.getElementById("nextActionHint");
  const state = window.SBO_STATE_ADAPTER;
  if (!container || !state) return;

  function safeJson(key, fallback) {
    try {
      const value = state.getJson(key, fallback);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function countOwnedTokens(draft) {
    const raw = String(draft?.ownedItems || "");
    if (!raw.trim()) return 0;
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean).length;
  }

  function countFloorsCleared(tracker) {
    if (Array.isArray(tracker)) return tracker.filter((n) => Number.isFinite(Number(n))).length;
    if (tracker && typeof tracker === "object") {
      return Object.values(tracker).filter(Boolean).length;
    }
    return 0;
  }

  function countBossesBeaten(bossBeaten) {
    if (!bossBeaten || typeof bossBeaten !== "object") return 0;
    return Object.values(bossBeaten).filter(Boolean).length;
  }

  function buildHint() {
    const keys = state.KEYS || {};
    const draft = safeJson(keys.formDraft, {});
    const builds = safeJson(keys.builds, {});
    const floorTracker = safeJson(keys.floorTracker, []);
    const bossBeaten = safeJson(keys.bossBeaten, {});

    const ownedCount = countOwnedTokens(draft);
    const floorsCleared = countFloorsCleared(floorTracker);
    const bossesCleared = countBossesBeaten(bossBeaten);
    const buildCount = Array.isArray(builds) ? builds.length : Object.keys(builds || {}).length;
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    if (page === "index.html") {
      if (!Number(draft.currentLevel || 0)) {
        return `No active draft yet — <a href="./index.html">set your level + class and generate a first plan</a>.`;
      }
      if (ownedCount === 0) {
        return `For better recommendations, add your owned gear in <a href="./inventory.html">Inventory</a>.`;
      }
      return `Build looks active. Next step: check <a href="./boss.html">Bosses</a> readiness for your current setup.`;
    }

    if (page === "inventory.html") {
      if (ownedCount === 0) return `Mark a few items as owned, then click <strong>Save to Planner</strong> to improve gear picks.`;
      return `Owned list is populated (${ownedCount}). Next step: open <a href="./index.html">Planner</a> and regenerate.`;
    }

    if (page === "boss.html") {
      if (!Number(draft.currentLevel || 0)) return `No synced build found. Generate one in <a href="./index.html">Planner</a> first.`;
      if (bossesCleared === 0) return `Use this page to mark beaten bosses and track progression momentum.`;
      return `Nice progress (${bossesCleared} beaten). Check <a href="./progress.html">Progress</a> for overall snapshot.`;
    }

    if (page === "progress.html") {
      if (floorsCleared === 0) return `No floors marked yet — clear floors in <a href="./index.html">Planner</a> or <a href="./boss.html">Bosses</a>.`;
      return `You have ${floorsCleared} floors cleared. Next: tune your build in <a href="./index.html">Planner</a>.`;
    }

    if (page === "tools.html") {
      return `Advanced tools are here. For core flow, return to <a href="./index.html">Planner</a> or <a href="./inventory.html">Inventory</a>.`;
    }

    if (page === "dashboard.html") {
      if (buildCount === 0) return `Start by creating your first build in <a href="./index.html">Planner</a>.`;
      return `You have ${buildCount} saved build${buildCount === 1 ? "" : "s"}. Next: validate in <a href="./boss.html">Bosses</a>.`;
    }

    return `Open <a href="./index.html">Planner</a> to continue your progression flow.`;
  }

  function render() {
    container.hidden = false;
    container.innerHTML = `<strong>Next action:</strong> ${buildHint()}`;
  }

  render();
  const keys = state.KEYS || {};
  const watchedKeys = [
    keys.formDraft,
    keys.builds,
    keys.floorTracker,
    keys.bossBeaten,
  ].filter(Boolean);
  state.subscribe(watchedKeys, render);
})();
