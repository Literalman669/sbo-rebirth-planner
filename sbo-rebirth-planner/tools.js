(function bootstrapToolsPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const exportableKeys = [
    keys.formDraft,
    keys.equipped,
    keys.builds,
    keys.floorTracker,
    keys.calibration,
    keys.bossFilters,
    keys.bossBeaten,
    keys.pinnedPresets,
    keys.presetFilter,
  ].filter(Boolean);

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

  function renderStorageSummary() {
    const target = document.getElementById("toolsStorageSummary");
    if (!target || !state) return;
    const watched = [
      keys.formDraft,
      keys.equipped,
      keys.builds,
      keys.floorTracker,
      keys.calibration,
      keys.bossFilters,
      keys.bossBeaten,
    ];
    const rows = watched.map((key) => {
      const raw = state.getRaw(key);
      return `${key}: ${raw ? `${raw.length} bytes` : "empty"}`;
    });
    let runtimeTail = "";
    try {
      const runtimeRaw = localStorage.getItem("sbo-rebirth-planner.runtime-events.v1");
      const runtimeEvents = runtimeRaw ? JSON.parse(runtimeRaw) : [];
      const lastEvent = Array.isArray(runtimeEvents) && runtimeEvents.length
        ? runtimeEvents[runtimeEvents.length - 1]
        : null;
      runtimeTail = lastEvent
        ? ` | runtime events: ${runtimeEvents.length} (last: ${lastEvent.kind} @ ${lastEvent.at})`
        : " | runtime events: none";
    } catch (_) {
      runtimeTail = " | runtime events: unavailable";
    }
    target.textContent = rows.join(" | ") + runtimeTail;
  }

  function setMessage(text, kind = "info") {
    const el = document.getElementById("toolsBackupMessage");
    if (!el) return;
    el.textContent = text;
    el.className = `build-action-message ${kind}`;
  }

  function buildBackupObject() {
    const payload = { exportedAt: new Date().toISOString(), schemaVersion: 1, state: {} };
    exportableKeys.forEach((key) => {
      payload.state[key] = state.getJson(key, null);
    });
    return payload;
  }

  function writeBackupTextarea(obj) {
    const textarea = document.getElementById("toolsBackupJson");
    if (textarea) textarea.value = JSON.stringify(obj, null, 2);
  }

  async function copyBackupToClipboard() {
    const textarea = document.getElementById("toolsBackupJson");
    if (!textarea || !textarea.value.trim()) {
      setMessage("Nothing to copy. Export first.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(textarea.value);
      setMessage("Backup JSON copied to clipboard.", "success");
    } catch (_) {
      setMessage("Clipboard copy failed in this browser.", "error");
    }
  }

  function importBackupFromTextarea() {
    const textarea = document.getElementById("toolsBackupJson");
    if (!textarea || !textarea.value.trim()) {
      setMessage("Paste backup JSON first.", "error");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (_) {
      setMessage("Invalid JSON format.", "error");
      return;
    }
    const incomingState = parsed?.state;
    if (!incomingState || typeof incomingState !== "object") {
      setMessage("Backup JSON missing state payload.", "error");
      return;
    }
    let applied = 0;
    exportableKeys.forEach((key) => {
      if (!(key in incomingState)) return;
      const value = incomingState[key];
      if (value == null) return;
      if (state.setJson(key, value)) applied += 1;
    });
    renderStorageSummary();
    setMessage(`Imported ${applied} state key(s). Open Planner/Bosses to verify.`, "success");
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("toolsRefreshStorageBtn");
    const exportBtn = document.getElementById("toolsExportJsonBtn");
    const copyBtn = document.getElementById("toolsCopyJsonBtn");
    const importBtn = document.getElementById("toolsImportJsonBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", renderStorageSummary);
    if (exportBtn) exportBtn.addEventListener("click", () => {
      const payload = buildBackupObject();
      writeBackupTextarea(payload);
      setMessage("Exported current workspace state to JSON.", "success");
    });
    if (copyBtn) copyBtn.addEventListener("click", copyBackupToClipboard);
    if (importBtn) importBtn.addEventListener("click", importBackupFromTextarea);
  }

  syncThemeToggle();
  renderStorageSummary();
  bindEvents();
})();
