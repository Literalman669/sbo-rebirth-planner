(function bootstrapProgressPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const data = window.SBO_DATA || {};
  const bossData = window.SBO_BOSS_DATA || {};
  const allBosses = [...(bossData.bosses || []), ...(bossData.minibosses || [])];
  const bossById = new Map(allBosses.map((boss) => [String(boss.id || ""), boss]));
  const FLOOR_TRACKER_MAX = 18;
  const LAST_GENERATED_PLAN_KEY = "sbo-rebirth-planner.last-generated-plan.v1";
  const STAT_KEYS = ["str", "def", "agi", "vit", "luk"];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function readDraft() {
    return state?.getJson(keys.formDraft, {}) || {};
  }

  function readLastPlan() {
    return state?.getJson(LAST_GENERATED_PLAN_KEY, null) || null;
  }

  function getCurrentStats(draft, lastPlan) {
    if (lastPlan?.finalStats && String(lastPlan.weaponClass || "") === String(draft.weaponClass || "")) {
      return lastPlan.finalStats;
    }
    return {
      str: Number(draft.str) || 0,
      def: Number(draft.def) || 0,
      agi: Number(draft.agi) || 0,
      vit: Number(draft.vit) || 0,
      luk: Number(draft.luk) || 0,
    };
  }

  function writeFloorTracker(floors) {
    state?.setJson(keys.floorTracker, Array.from(floors).sort((a, b) => a - b));
  }

  function renderFloorTracker(floorArr) {
    const tracker = document.getElementById("progressFloorTracker");
    const summary = document.getElementById("progressFloorTrackerSummary");
    if (!tracker) return;
    const cleared = new Set(floorArr);
    const cells = [];
    for (let floor = 1; floor <= FLOOR_TRACKER_MAX; floor += 1) {
      const isCleared = cleared.has(floor);
      cells.push(`<button type="button" class="floor-tracker-cell${isCleared ? " cleared" : ""}" data-floor="${floor}" aria-pressed="${isCleared}" title="Floor ${floor}${isCleared ? " - Cleared" : ""}">
        <span class="ft-num">F${floor}</span>
        <span class="ft-check">✓</span>
      </button>`);
    }
    tracker.innerHTML = cells.join("");
    if (summary) {
      if (!cleared.size) summary.textContent = "No floors cleared yet. Click a floor to mark it.";
      else if (cleared.size === FLOOR_TRACKER_MAX) summary.textContent = `All ${FLOOR_TRACKER_MAX} floors cleared.`;
      else summary.innerHTML = `<strong>${cleared.size}</strong> of ${FLOOR_TRACKER_MAX} floors cleared - highest: <strong>Floor ${Math.max(...cleared)}</strong>`;
    }
  }

  function renderSkillChecklist(draft) {
    const target = document.getElementById("progressSkillChecklist");
    if (!target) return;
    const weaponClass = String(draft.weaponClass || "two-handed");
    const currentSkill = Math.max(1, Number(draft.weaponSkill) || 1);
    const skills = data.swordSkillUnlocks?.[weaponClass] || [];
    if (!skills.length) {
      target.innerHTML = `<p class="muted-text">No skill unlock data for this weapon class.</p>`;
      return;
    }
    const unlockedCount = skills.filter((entry) => currentSkill >= Number(entry.skill || 0)).length;
    target.innerHTML = `
      <div class="sc-header">
        <span class="sc-progress-label">${unlockedCount} / ${skills.length} tiers unlocked</span>
        <div class="sc-progress-bar"><div class="sc-progress-fill" style="width:${Math.round((unlockedCount / skills.length) * 100)}%"></div></div>
      </div>
      <div class="sc-list">${skills.map((entry, index) => {
        const unlocked = currentSkill >= entry.skill;
        const nextLocked = !unlocked && (index === 0 || currentSkill >= skills[index - 1].skill);
        const stateClass = unlocked ? "sc-unlocked" : nextLocked ? "sc-next" : "sc-locked";
        const needed = unlocked ? "" : `<span class="sc-needed">need ${entry.skill - currentSkill} more skill</span>`;
        return `<div class="sc-row ${stateClass}">
          <span class="sc-icon">${unlocked ? "✓" : nextLocked ? "→" : "○"}</span>
          <span class="sc-req">Skill ${entry.skill}</span>
          <span class="sc-names">${escapeHtml(entry.name)}</span>
          ${needed}
        </div>`;
      }).join("")}</div>`;
  }

  function renderPartyRoleAdvisor(draft, lastPlan) {
    const target = document.getElementById("progressPartyRoleAdvisor");
    if (!target) return;
    const stats = getCurrentStats(draft, lastPlan);
    const fs = { STR: stats.str || 0, DEF: stats.def || 0, AGI: stats.agi || 0, VIT: stats.vit || 0, LUK: stats.luk || 0 };
    const total = Object.values(fs).reduce((sum, value) => sum + value, 0) || 1;
    const roles = [
      { id: "dps", label: "DPS", desc: "Damage-first role for clearing mobs and bosses.", priorities: ["STR", "AGI", "LUK"], gearFocus: "Highest ATK weapon available." },
      { id: "tank", label: "Tank", desc: "Survival-first role for absorbing burst hits.", priorities: ["DEF", "VIT", "STR"], gearFocus: "Highest DEF armor and shield if your weapon path supports one." },
      { id: "support", label: "Support", desc: "Flexible role built around tempo and staying alive.", priorities: ["AGI", "VIT", "LUK"], gearFocus: "Balanced gear with DEX-heavy defensive pieces." },
      { id: "farmer", label: "Farmer", desc: "Drop-rate and clear-speed role for repeat farming.", priorities: ["LUK", "AGI", "STR"], gearFocus: "Enough ATK to clear quickly, then utility." },
    ];
    const strShare = fs.STR / total;
    const defShare = fs.DEF / total;
    const agiShare = fs.AGI / total;
    const lukShare = fs.LUK / total;
    const bestFit = defShare > 0.28 ? "tank" : lukShare > 0.22 ? "farmer" : agiShare > 0.25 && strShare < 0.35 ? "support" : "dps";
    target.innerHTML = `<div class="pra-grid">${roles.map((role) => `
      <div class="pra-card${role.id === bestFit ? " pra-best-fit" : ""}">
        <div class="pra-card-header">
          <span class="pra-label">${escapeHtml(role.label)}</span>
          ${role.id === bestFit ? `<span class="pra-fit-badge">Best fit for your build</span>` : ""}
        </div>
        <p class="pra-desc">${escapeHtml(role.desc)}</p>
        <div class="pra-stats">${role.priorities.map((stat) => `<span class="pra-stat-badge pra-stat-${stat.toLowerCase()}">${stat} ${fs[stat]} <span class="pra-pct">${Math.round((fs[stat] / total) * 100)}%</span></span>`).join("")}</div>
        <div class="pra-gear"><strong>Gear focus:</strong> ${escapeHtml(role.gearFocus)}</div>
      </div>
    `).join("")}</div>`;
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
    const draft = readDraft();
    const lastPlan = readLastPlan();
    const floorArr = Array.isArray(floorTracker) ? floorTracker.slice().sort((a, b) => a - b) : [];
    const beatenIds = Array.isArray(bossBeaten) ? bossBeaten : [];

    setText("progFloors", Array.isArray(floorTracker) ? floorTracker.length : 0);
    setText("progBosses", Array.isArray(bossBeaten) ? bossBeaten.length : 0);
    setText("progOwned", parseOwnedCount(draft.ownedItems));

    const floorPillsEl = document.getElementById("progFloorPills");
    if (floorPillsEl) {
      floorPillsEl.innerHTML = floorArr.length
        ? floorArr.map((floor) => `<span class="pill owned">F${floor}</span>`).join("")
        : `<span class="muted-text">No floors marked as cleared yet.</span>`;
    }
    renderFloorTracker(floorArr);
    renderSkillChecklist(draft);
    renderPartyRoleAdvisor(draft, lastPlan);

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
  document.getElementById("progressFloorTracker")?.addEventListener("click", (event) => {
    const cell = event.target.closest(".floor-tracker-cell");
    if (!cell) return;
    const floor = Number(cell.dataset.floor);
    if (!Number.isFinite(floor) || floor < 1 || floor > FLOOR_TRACKER_MAX) return;
    const current = new Set(state?.getJson(keys.floorTracker, []) || []);
    if (current.has(floor)) current.delete(floor);
    else current.add(floor);
    writeFloorTracker(current);
    render();
  });
  document.getElementById("progressClearFloorsBtn")?.addEventListener("click", () => {
    writeFloorTracker(new Set());
    render();
  });
  document.getElementById("progressMarkToFloorBtn")?.addEventListener("click", () => {
    const draft = readDraft();
    const cap = Math.min(FLOOR_TRACKER_MAX, Math.max(1, Number(draft.maxFloorReached) || 1));
    const next = new Set(state?.getJson(keys.floorTracker, []) || []);
    for (let floor = 1; floor <= cap; floor += 1) next.add(floor);
    writeFloorTracker(next);
    render();
  });
  state?.subscribe([keys.floorTracker, keys.bossBeaten, keys.formDraft, LAST_GENERATED_PLAN_KEY], render);
})();
