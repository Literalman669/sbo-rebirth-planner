(function bootstrapToolsPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const data = window.SBO_DATA || {};
  const LAST_GENERATED_PLAN_KEY = "sbo-rebirth-planner.last-generated-plan.v1";
  const STAT_KEYS = ["str", "def", "agi", "vit", "luk"];
  const SHARE_FIELDS = [
    "buildName", "currentLevel", "levelsToPlan", "maxFloorReached", "weaponClass", "playstyle", "allocationMode",
    "str", "def", "agi", "vit", "luk", "gearAttack", "gearDefense", "gearDexterity", "weaponSkill",
  ];
  const CALIBRATION_METRICS = [
    { key: "dpsProjection", label: "DPS Index", inputId: "toolsCalObservedDps", required: true },
    { key: "damageReduction", label: "Damage Reduction", inputId: "toolsCalObservedDamageReduction", required: true },
    { key: "staminaPool", label: "Stamina Pool", inputId: "toolsCalObservedStamina", required: false },
    { key: "critChancePct", label: "Crit Chance %", inputId: "toolsCalObservedCrit", required: false },
    { key: "dropBonusPct", label: "Drop Bonus %", inputId: "toolsCalObservedDrop", required: false },
  ];
  const DEFAULT_CALIBRATION_FACTORS = {
    dpsProjection: 1,
    damageReduction: 1,
    bonusHp: 1,
    staminaPool: 1,
    critChancePct: 1,
    dropBonusPct: 1,
  };
  const CALIBRATION_FACTOR_MIN = 0.4;
  const CALIBRATION_FACTOR_MAX = 2.5;
  const CALIBRATION_RATIO_MIN = 0.25;
  const CALIBRATION_RATIO_MAX = 4;
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function round(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getDraft() {
    return state?.getJson(keys.formDraft, {}) || {};
  }

  function getBuilds() {
    const builds = state?.getJson(keys.builds, {}) || {};
    return builds && typeof builds === "object" && !Array.isArray(builds) ? builds : {};
  }

  function getLastPlan() {
    return state?.getJson(LAST_GENERATED_PLAN_KEY, null) || null;
  }

  function setShareMessage(text, kind = "info") {
    const el = document.getElementById("toolsShareMessage");
    if (!el) return;
    el.textContent = text;
    el.className = `build-action-message ${kind}`;
  }

  function setCompareMessage(text, kind = "info") {
    const el = document.getElementById("toolsCompareMessage");
    if (!el) return;
    el.textContent = text;
    el.className = `build-action-message ${kind}`;
  }

  function setCalibrationMessage(text, kind = "info") {
    const el = document.getElementById("toolsCalibrationMessage");
    if (!el) return;
    el.textContent = text;
    el.className = `build-action-message ${kind}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  function getSlotLabel(slot) {
    return { weapon: "Weapon", armor: "Armor", upper: "Headwear", lower: "Accessory", shield: "Shield" }[slot] || slot;
  }

  function buildLoadoutText() {
    const equipped = state?.getJson(keys.equipped, { slots: {} }) || { slots: {} };
    const catalog = data.itemCatalog || [];
    const entries = Object.entries(equipped.slots || {})
      .map(([slot, itemId]) => ({ slot, item: catalog.find((item) => String(item.id) === String(itemId)) }))
      .filter((entry) => entry.item);
    if (!entries.length) return "";
    const totals = entries.reduce((sum, { item }) => {
      sum.attack += Number(item.attack) || 0;
      sum.defense += Number(item.defense) || 0;
      sum.dexterity += Number(item.dexterity) || 0;
      return sum;
    }, { attack: 0, defense: 0, dexterity: 0 });
    return [
      "SBO:Rebirth Equipped Loadout",
      ...entries.map(({ slot, item }) => `${getSlotLabel(slot)}: ${item.name} (ATK ${round(item.attack || 0, 2)} / DEF ${round(item.defense || 0, 2)} / DEX ${round(item.dexterity || 0, 2)})`),
      `Totals: ATK ${round(totals.attack, 2)} / DEF ${round(totals.defense, 2)} / DEX ${round(totals.dexterity, 2)}`,
    ].join("\n");
  }

  function buildShareUrl() {
    const draft = getDraft();
    const params = new URLSearchParams();
    SHARE_FIELDS.forEach((key) => {
      const value = `${draft[key] || ""}`.trim();
      if (value) params.set(key, value);
    });
    return `${new URL("./index.html", window.location.href).href}?${params.toString()}`;
  }

  function summarizeBuildForm(form) {
    const stats = {
      str: Number(form?.str) || 0,
      def: Number(form?.def) || 0,
      agi: Number(form?.agi) || 0,
      vit: Number(form?.vit) || 0,
      luk: Number(form?.luk) || 0,
    };
    return {
      level: Number(form?.currentLevel) || 1,
      levelsToPlan: Number(form?.levelsToPlan) || 0,
      weaponClass: String(form?.weaponClass || "unknown"),
      playstyle: String(form?.playstyle || "unknown"),
      stats,
      totalStats: STAT_KEYS.reduce((sum, key) => sum + (stats[key] || 0), 0),
      gearAttack: Number(form?.gearAttack) || 0,
      gearDefense: Number(form?.gearDefense) || 0,
      gearDexterity: Number(form?.gearDexterity) || 0,
    };
  }

  function refreshCompareOptions() {
    const builds = getBuilds();
    const names = Object.keys(builds).sort((a, b) => a.localeCompare(b));
    const emptyState = document.getElementById("toolsCompareEmptyState");
    if (emptyState) emptyState.hidden = names.length >= 2;
    ["toolsCompareBuildA", "toolsCompareBuildB"].forEach((id, idx) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = names.length
        ? names.map((name, optionIdx) => `<option value="${escapeHtml(name)}"${optionIdx === idx ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")
        : `<option value="">No saved builds</option>`;
    });
  }

  function compareBuilds() {
    const aName = document.getElementById("toolsCompareBuildA")?.value || "";
    const bName = document.getElementById("toolsCompareBuildB")?.value || "";
    const target = document.getElementById("toolsComparisonResults");
    if (!target) return;
    if (!aName || !bName || aName === bName) {
      setCompareMessage("Select two different saved builds.", "error");
      return;
    }
    const builds = getBuilds();
    const a = summarizeBuildForm(builds[aName]?.form);
    const b = summarizeBuildForm(builds[bName]?.form);
    const rows = [
      ["Level", a.level, b.level],
      ["Levels planned", a.levelsToPlan, b.levelsToPlan],
      ["Weapon class", a.weaponClass, b.weaponClass],
      ["Playstyle", a.playstyle, b.playstyle],
      ["Total invested stats", a.totalStats, b.totalStats],
      ["STR", a.stats.str, b.stats.str],
      ["DEF", a.stats.def, b.stats.def],
      ["AGI", a.stats.agi, b.stats.agi],
      ["VIT", a.stats.vit, b.stats.vit],
      ["LUK", a.stats.luk, b.stats.luk],
      ["Gear ATK", a.gearAttack, b.gearAttack],
      ["Gear DEF", a.gearDefense, b.gearDefense],
      ["Gear DEX", a.gearDexterity, b.gearDexterity],
    ];
    target.innerHTML = `<div class="comparison-header"><strong>${escapeHtml(aName)}</strong><span>vs</span><strong>${escapeHtml(bName)}</strong></div>
      <div class="table-wrap comparison-table-wrap"><table><thead><tr><th>Metric</th><th>${escapeHtml(aName)}</th><th>${escapeHtml(bName)}</th><th>Delta</th></tr></thead>
      <tbody>${rows.map(([label, aValue, bValue]) => {
        const delta = Number.isFinite(Number(aValue)) && Number.isFinite(Number(bValue)) ? Number(bValue) - Number(aValue) : "-";
        return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(aValue)}</td><td>${escapeHtml(bValue)}</td><td>${escapeHtml(delta)}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    setCompareMessage(`Compared "${aName}" vs "${bName}".`, "success");
  }

  function renderCalibrationReport() {
    const target = document.getElementById("toolsCalibrationReport");
    if (!target) return;
    const calibration = state?.getJson(keys.calibration, {}) || {};
    const factors = calibration.factors || {};
    const lastPlan = getLastPlan();
    const factorRows = CALIBRATION_METRICS.map((metric) => `<li><span>${escapeHtml(metric.label)}</span><strong>x${round(factors[metric.key] || 1, 3)}</strong></li>`).join("");
    const sampleRows = calibration.lastSample?.metrics?.length
      ? calibration.lastSample.metrics.map((entry) => `<li><strong>${escapeHtml(entry.label)}</strong> observed ${round(entry.observed, 2)} vs raw ${round(entry.predictedRaw, 2)}</li>`).join("")
      : `<li>No samples captured yet.</li>`;
    const previewRows = lastPlan?.finalMetrics
      ? CALIBRATION_METRICS.map((metric) => `<li><strong>${escapeHtml(metric.label)}</strong> ${round(lastPlan.finalMetrics[metric.key] || 0, 2)}</li>`).join("")
      : `<li>Generate a plan to see current build preview metrics.</li>`;
    target.innerHTML = `<div class="calibration-summary"><p><strong>Calibration samples:</strong> ${calibration.sampleCount || 0}</p></div>
      <div class="calibration-report-grid">
        <article><h4>Current Multipliers</h4><ul class="calibration-report-list">${factorRows}</ul></article>
        <article><h4>Last Sample</h4><ul class="calibration-report-list">${sampleRows}</ul></article>
        <article><h4>Current Build Preview</h4><ul class="calibration-report-list">${previewRows}</ul></article>
      </div>`;
  }

  function applyCalibrationSample() {
    const lastPlan = getLastPlan();
    const rawMetrics = lastPlan?.finalRawMetrics;
    if (!rawMetrics) {
      setCalibrationMessage("Generate a plan first so Tools can compare observed values against raw metrics.", "error");
      return;
    }
    const calibration = state?.getJson(keys.calibration, {}) || {};
    const currentFactors = { ...DEFAULT_CALIBRATION_FACTORS, ...(calibration.factors || {}) };
    const sampleCount = Number(calibration.sampleCount) || 0;
    const sampleMetrics = [];
    CALIBRATION_METRICS.forEach((metric) => {
      const observed = Number(document.getElementById(metric.inputId)?.value);
      if (!Number.isFinite(observed) || observed < 0) return;
      const predictedRaw = Number(rawMetrics[metric.key]);
      if (!Number.isFinite(predictedRaw) || predictedRaw <= 0) return;
      const ratio = clamp(observed / predictedRaw, CALIBRATION_RATIO_MIN, CALIBRATION_RATIO_MAX);
      const current = Number(currentFactors[metric.key]) || 1;
      currentFactors[metric.key] = clamp((current * sampleCount + ratio) / (sampleCount + 1), CALIBRATION_FACTOR_MIN, CALIBRATION_FACTOR_MAX);
      sampleMetrics.push({
        key: metric.key,
        label: metric.label,
        observed,
        predictedRaw,
        ratio,
        errorPct: ((observed - predictedRaw) / predictedRaw) * 100,
      });
    });
    if (!sampleMetrics.length) {
      setCalibrationMessage("Enter at least one valid observed value.", "error");
      return;
    }
    const capturedAt = new Date().toISOString();
    const next = {
      sampleCount: sampleCount + 1,
      factors: currentFactors,
      updatedAt: capturedAt,
      lastSample: {
        capturedAt,
        projectedLevel: Number(lastPlan.currentLevel || 0) + Number(lastPlan.levelsToPlan || 0),
        metrics: sampleMetrics,
      },
    };
    state?.setJson(keys.calibration, next);
    setCalibrationMessage(`Applied calibration sample #${next.sampleCount}.`, "success");
    renderCalibrationReport();
  }

  function resetCalibration() {
    state?.setJson(keys.calibration, {
      sampleCount: 0,
      factors: { ...DEFAULT_CALIBRATION_FACTORS },
      updatedAt: null,
      lastSample: null,
    });
    CALIBRATION_METRICS.forEach((metric) => {
      const input = document.getElementById(metric.inputId);
      if (input) input.value = "";
    });
    setCalibrationMessage("Calibration reset to neutral multipliers.", "success");
    renderCalibrationReport();
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
    const copyLoadoutBtn = document.getElementById("toolsCopyLoadoutBtn");
    const copyShareLinkBtn = document.getElementById("toolsCopyShareLinkBtn");
    const printBtn = document.getElementById("toolsPrintBtn");
    const compareBtn = document.getElementById("toolsCompareBuildBtn");
    const applyCalibrationBtn = document.getElementById("toolsApplyCalibrationBtn");
    const resetCalibrationBtn = document.getElementById("toolsResetCalibrationBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", renderStorageSummary);
    if (exportBtn) exportBtn.addEventListener("click", () => {
      const payload = buildBackupObject();
      writeBackupTextarea(payload);
      setMessage("Exported current workspace state to JSON.", "success");
    });
    if (copyBtn) copyBtn.addEventListener("click", copyBackupToClipboard);
    if (importBtn) importBtn.addEventListener("click", importBackupFromTextarea);
    if (copyLoadoutBtn) copyLoadoutBtn.addEventListener("click", async () => {
      const text = buildLoadoutText();
      if (!text) {
        setShareMessage("No equipped loadout to copy yet.", "error");
        return;
      }
      const copied = await copyText(text);
      setShareMessage(copied ? "Copied equipped loadout to clipboard." : "Clipboard copy failed.", copied ? "success" : "error");
    });
    if (copyShareLinkBtn) copyShareLinkBtn.addEventListener("click", async () => {
      const url = buildShareUrl();
      setShareMessage(await copyText(url) ? "Share link copied to clipboard." : `Share link: ${url}`, "success");
    });
    if (printBtn) printBtn.addEventListener("click", () => window.print());
    if (compareBtn) compareBtn.addEventListener("click", compareBuilds);
    if (applyCalibrationBtn) applyCalibrationBtn.addEventListener("click", applyCalibrationSample);
    if (resetCalibrationBtn) resetCalibrationBtn.addEventListener("click", resetCalibration);
  }

  syncThemeToggle();
  renderStorageSummary();
  refreshCompareOptions();
  renderCalibrationReport();
  bindEvents();
  state?.subscribe([keys.builds, keys.calibration, LAST_GENERATED_PLAN_KEY], () => {
    refreshCompareOptions();
    renderCalibrationReport();
  });
})();
