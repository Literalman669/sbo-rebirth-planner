(function bootstrapProgressPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const bossData = window.SBO_BOSS_DATA || {};
  const allBosses = [...(bossData.bosses || []), ...(bossData.minibosses || [])];
  const bossById = new Map(allBosses.map((boss) => [String(boss.id || ""), boss]));

  function parseOwnedCount(raw) {
    return String(raw || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean).length;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function syncThemeToggle() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const isDark = () => document.documentElement.dataset.theme === "dark";
    btn.textContent = isDark() ? "☀" : "🌙";
    btn.onclick = () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("sbo-theme", next); } catch (_) {}
      btn.textContent = next === "dark" ? "☀" : "🌙";
    };
  }

  function render() {
    const floorTracker = state?.getJson(keys.floorTracker, []) || [];
    const bossBeaten = state?.getJson(keys.bossBeaten, []) || [];
    const draft = state?.getJson(keys.formDraft, {}) || {};
    const floorArr = Array.isArray(floorTracker)
      ? floorTracker.slice().filter((n) => Number.isInteger(n)).sort((a, b) => a - b)
      : [];
    const beatenIds = Array.isArray(bossBeaten) ? bossBeaten.map((id) => String(id || "")) : [];

    setText("progFloors", Array.isArray(floorTracker) ? floorTracker.length : 0);
    setText("progBosses", Array.isArray(bossBeaten) ? bossBeaten.length : 0);
    setText("progOwned", parseOwnedCount(draft.ownedItems));

    const floorPillsEl = document.getElementById("progFloorPills");
    if (floorPillsEl) {
      floorPillsEl.innerHTML = floorArr.length
        ? floorArr.map((floor) => `<span class="pill owned">F${floor}</span>`).join("")
        : `<span class="muted-text">No floors marked as cleared yet.</span>`;
    }

    const bossListEl = document.getElementById("progBossList");
    if (bossListEl) {
      const rows = beatenIds
        .slice(-12)
        .reverse()
        .map((id) => {
          const boss = bossById.get(id);
          if (!boss) return `<div class="progress-list-item"><strong>${id}</strong><span class="muted-text">Unknown boss record</span></div>`;
          return `<div class="progress-list-item"><strong>${boss.name}</strong><span class="muted-text">Floor ${boss.floor || "?"} • ${boss.type || "boss"}</span></div>`;
        });
      bossListEl.innerHTML = rows.length
        ? rows.join("")
        : `<p class="muted-text">No bosses marked beaten yet. Mark wins in Bosses tab.</p>`;
    }
  }

  syncThemeToggle();
  render();
  state?.subscribe([keys.floorTracker, keys.bossBeaten, keys.formDraft], render);
})();
