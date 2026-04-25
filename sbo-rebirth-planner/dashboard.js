(function bootstrapDashboardPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};

  function parseOwnedItems(raw) {
    return String(raw || "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
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
    const builds = state?.getJson(keys.builds, []) || [];
    const draft = state?.getJson(keys.formDraft, {}) || {};
    const equipped = state?.getJson(keys.equipped, { slots: {} }) || { slots: {} };
    const floorTracker = state?.getJson(keys.floorTracker, []) || [];

    const ownedCount = parseOwnedItems(draft.ownedItems).length;
    const equippedCount = Object.values(equipped?.slots || {}).filter(Boolean).length;
    const floorCount = Array.isArray(floorTracker) ? floorTracker.length : 0;
    const updatedAt = draft?.updatedAt || equipped?.updatedAt || null;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    setText("dashSavedBuilds", Array.isArray(builds) ? builds.length : 0);
    setText("dashOwnedItems", ownedCount);
    setText("dashEquipped", equippedCount);
    setText("dashFloors", floorCount);

    const updatedEl = document.getElementById("dashLastUpdated");
    if (updatedEl) {
      if (updatedAt) {
        const date = new Date(updatedAt);
        updatedEl.textContent = `Last updated: ${Number.isNaN(date.getTime()) ? updatedAt : date.toLocaleString()}`;
      } else {
        updatedEl.textContent = "No draft state saved yet. Open Planner to start.";
      }
    }
  }

  updateThemeToggle();
  renderDashboardSnapshot();
  state?.subscribe([keys.builds, keys.formDraft, keys.equipped, keys.floorTracker], renderDashboardSnapshot);
})();
