(function bootstrapPlanner() {
  const data = window.SBO_DATA;
  const STAT_KEYS = ["str", "def", "agi", "vit", "luk"];
  const BUILD_STORAGE_KEY = "sbo-rebirth-planner.builds.v1";
  const FLOOR_TRACKER_STORAGE_KEY = "sbo-rebirth-planner.floor-tracker.v1";
  const FLOOR_TRACKER_MAX = 18;
  const PINNED_PRESETS_STORAGE_KEY = "sbo-rebirth-planner.pinned-presets.v1";
  const PRESET_FILTER_STORAGE_KEY = "sbo-rebirth-planner.preset-filter.v1";
  const FORM_DRAFT_STORAGE_KEY = "sbo-rebirth-planner.form-draft.v1";
  const EQUIPPED_STORAGE_KEY = "sbo-rebirth-planner.equipped.v1";
  const EXPORT_SCHEMA_VERSION = 1;
  const CALIBRATION_EXPORT_SCHEMA_VERSION = 1;
  const CALIBRATION_STORAGE_KEY = "sbo-rebirth-planner.calibration.v1";
  const FORM_DRAFT_WRITE_DELAY_MS = 180;
  const RECALC_ON_RECOMMENDATION_FIELD_CHANGE_MS = 500;
  const RECOMMENDATION_AFFECTING_FIELDS = ["ownedItems", "weaponSkill", "itemPoolMode", "dataQualityMode", "maxFloorReached"];
  const CALIBRATION_FACTOR_MIN = 0.4;
  const CALIBRATION_FACTOR_MAX = 2.5;
  const CALIBRATION_RATIO_MIN = 0.25;
  const CALIBRATION_RATIO_MAX = 4;
  const EQUIPPED_SLOTS = Object.freeze(["weapon", "armor", "upper", "lower", "shield"]);
  const DEFAULT_CALIBRATION_FACTORS = Object.freeze({
    dpsProjection: 1,
    damageReduction: 1,
    bonusHp: 1,
    staminaPool: 1,
    critChancePct: 1,
    dropBonusPct: 1,
  });
  const CALIBRATION_METRICS = [
    { key: "dpsProjection", label: "DPS Index", inputId: "calObservedDps", required: true },
    {
      key: "damageReduction",
      label: "Damage Reduction",
      inputId: "calObservedDamageReduction",
      required: true,
    },
    { key: "staminaPool", label: "Stamina Pool", inputId: "calObservedStamina", required: false },
    { key: "critChancePct", label: "Crit Chance %", inputId: "calObservedCrit", required: false },
    { key: "dropBonusPct", label: "Drop Bonus %", inputId: "calObservedDrop", required: false },
  ];
  const DATA_FORMULA_KEYS = [
    "strDamagePerPointPct",
    "defMultiplierPerPoint",
    "vitDexterityMultiplierPerPoint",
    "agiRunSpeedPerPoint",
    "agiWalkSpeedPerPoint",
    "lukCritChancePerPointPct",
    "lukDropChancePerPointPct",
    "baseCritChancePct",
  ];
  const PLAYSTYLE_WEIGHT_KEYS = ["damage", "survival", "mobility", "farming"];
  const VALID_ITEM_SLOTS = ["weapon", "armor", "upper", "lower", "shield"];
  const VALID_SCALING_TYPES = ["fixed", "level_1", "level_5", "skill_1", "skill_5"];
  const VALID_DATA_QUALITY_MODES = ["exact-only", "mixed"];
  const VALID_ALLOCATION_MODES = ["adaptive", "aggressive", "defensive", "tempo"];
  const QUICK_PRESETS = [
    {
      name: "2H Beginner",
      desc: "Lv1 · Floor 1 · Greatsword",
      snapshot: {
        currentLevel: 1, levelsToPlan: 20, maxFloorReached: 1,
        weaponClass: "two-handed", playstyle: "balanced", allocationMode: "adaptive",
        weaponSkill: 1, str: 0, def: 0, agi: 0, vit: 0, luk: 0,
        gearAttack: 3, gearDefense: 0.5, gearDexterity: 3,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "1H + Shield Mid",
      desc: "Lv50 · Floor 5 · Balanced",
      snapshot: {
        currentLevel: 50, levelsToPlan: 20, maxFloorReached: 5,
        weaponClass: "one-handed", playstyle: "balanced", allocationMode: "adaptive",
        weaponSkill: 55, str: 20, def: 10, agi: 10, vit: 15, luk: 0,
        gearAttack: 129, gearDefense: 61.5, gearDexterity: 347,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "Dual Wield DPS",
      desc: "Lv90 · Floor 9 · Damage",
      snapshot: {
        currentLevel: 90, levelsToPlan: 20, maxFloorReached: 9,
        weaponClass: "dual-wield", playstyle: "damage", allocationMode: "aggressive",
        weaponSkill: 90, str: 60, def: 5, agi: 30, vit: 20, luk: 5,
        gearAttack: 506, gearDefense: 152, gearDexterity: 1076,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "Rapier Speed",
      desc: "Lv70 · Floor 7 · Tempo",
      snapshot: {
        currentLevel: 70, levelsToPlan: 20, maxFloorReached: 7,
        weaponClass: "rapier", playstyle: "farming", allocationMode: "tempo",
        weaponSkill: 75, str: 25, def: 5, agi: 40, vit: 15, luk: 10,
        gearAttack: 220, gearDefense: 96, gearDexterity: 660,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "Tank Build",
      desc: "Lv100 · Floor 10 · Survivability",
      snapshot: {
        currentLevel: 100, levelsToPlan: 20, maxFloorReached: 10,
        weaponClass: "one-handed", playstyle: "survivability", allocationMode: "defensive",
        weaponSkill: 105, str: 10, def: 60, agi: 10, vit: 60, luk: 0,
        gearAttack: 316, gearDefense: 175, gearDexterity: 1189,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "Dagger Farmer",
      desc: "Lv120 · Floor 12 · Farming",
      snapshot: {
        currentLevel: 120, levelsToPlan: 20, maxFloorReached: 12,
        weaponClass: "dagger", playstyle: "farming", allocationMode: "tempo",
        weaponSkill: 135, str: 30, def: 10, agi: 60, vit: 20, luk: 30,
        gearAttack: 454, gearDefense: 281, gearDexterity: 2070,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
    {
      name: "End-Game 2H",
      desc: "Lv160 · Floor 16 · Damage",
      snapshot: {
        currentLevel: 160, levelsToPlan: 10, maxFloorReached: 16,
        weaponClass: "two-handed", playstyle: "damage", allocationMode: "aggressive",
        weaponSkill: 280, str: 100, def: 20, agi: 40, vit: 30, luk: 10,
        gearAttack: 1262, gearDefense: 422, gearDexterity: 2392,
        itemPoolMode: "standard", dataQualityMode: "exact-only",
      },
    },
  ];

  const CHANGELOG = [
    {
      version: "v0.9.0",
      notes: [
        "Ask about your build: AI chat panel trained on SBO:R formulas, equipment, and boss readiness.",
        "Supabase Edge Function sbo-ai-advisor proxies to Hugging Face; uses your build and plan context.",
        "See AI_SETUP.md and config.example.js to enable.",
      ],
    },
    {
      version: "v0.8.0",
      notes: [
        "Auto-refresh: changing Owned Items or Weapon Skill now triggers plan recompute after 500ms.",
        "Stale-plan indicator: banner appears when you've edited the form since last Generate Plan.",
        "Sync to plan: Build Logic panel — pick a level, click Sync to fill Current Level and stats from the plan.",
        "Stats-match indicator: shows whether your entered stats match the plan at current level.",
        "Boss Planner: draft flushes when you click Boss Planner link; storage listener for cross-tab updates.",
        "Boss Planner: Last synced timestamp and stale-build banner when Build Planner changes in another tab.",
      ],
    },
    {
      version: "v0.7.6",
      notes: [
        "Manual dark/light toggle: ☀/🌙 button in the nav bar on both pages. Choice persists across sessions via localStorage.",
        "FOUC prevention: theme is applied before first paint so there is no flash of unstyled content on load.",
        "Build Planner dark mode: comprehensive dark overrides for all panels, cards, badges, pills, and tables.",
      ],
    },
    {
      version: "v0.7.4 – v0.7.5",
      notes: [
        "Mobile layout: sidebar collapses on ≤860px, boss list forced to single column on ≤540px, modal fills screen on mobile.",
        "Auto dark mode: system prefers-color-scheme detection with full dark token set.",
      ],
    },
    {
      version: "v0.7.0 – v0.7.3",
      notes: [
        "Boss Planner readiness engine: DPS, survivability, level, skill, and status resistance checks per boss.",
        "Build snapshot sidebar on Boss Planner: live stats, playstyle badge, build strength bar, and next-target recommendation.",
        "Modal polish: keyboard navigation (← →), Copy Info button, collapsible Phases / Resistances / Drops sections.",
        "Card readiness bar: 4 px coloured bar at top of each boss card showing readiness score.",
        "Stat allocation advice: tip box below Next Target suggesting which stat to raise based on failing checks.",
      ],
    },
    {
      version: "v0.6.8 – v0.6.9",
      notes: [
        "Boss Planner: full wiki data audit — 30+ bosses and mini bosses with confirmed HP, EXP, Col, respawn times, and locations.",
        "⚠ Estimated tags: bosses without confirmed wiki data show an amber tag on the card and a banner in the modal.",
        "Search, sort, and filter: filter by name, floor, readiness, mini boss toggle; sort by floor, HP, or readiness score.",
        "Readiness pill summary bar: coloured ✓ Ready / ~ Close / ✗ Not Ready / ? Unknown counts.",
        "Drop bonus display, wiki link, and prev/next navigation added to boss modal.",
      ],
    },
    {
      version: "v0.6.0",
      notes: [
        "Shareable build name: add a name to your build and it appears when others open your share link.",
        "Stat cap warnings: stat inputs turn amber near 490 pts and red at 500 (cap reached).",
        "Best bang for Col sort: new gear sort mode ranks items by stat gain per Col spent.",
        "Changelog panel: this panel — version notes at a glance.",
      ],
    },
    {
      version: "v0.5.1",
      notes: [
        "Print / Save PDF: clean print stylesheet hides the input panel and shows output-only in A4 layout.",
      ],
    },
    {
      version: "v0.5.0",
      notes: [
        "Floor Progress Tracker: click floors 1–18 to mark them cleared, persists across sessions.",
        "Quick Start Templates: 7 one-click build presets (2H Beginner → End-Game 2H).",
        "Tooltip system: hover tooltips on all stat and gear total labels.",
      ],
    },
    {
      version: "v0.4.1",
      notes: [
        "Armor/headwear/shield catalog expanded to 298 total items across all 18 floors.",
        "15 dual-wield off-hand weapon entries added (sk5–sk330).",
      ],
    },
    {
      version: "v0.4.0",
      notes: [
        "Skill Unlock Checklist, Level-Up Planner, and Party Role Advisor panels added.",
        "Open Graph / Twitter meta tags for link previews.",
      ],
    },
  ];

  const SHARE_FIELDS = [
    "buildName",
    "currentLevel", "levelsToPlan", "maxFloorReached",
    "weaponClass", "playstyle", "allocationMode", "weaponSkill",
    "itemPoolMode", "dataQualityMode",
    "str", "def", "agi", "vit", "luk",
    "gearAttack", "gearDefense", "gearDexterity",
    "budgetCap", "avoidItems", "ownedItems",
  ];
  const SHARE_BOOL_FIELDS = ["onlyOwned", "strictBudgetCap"];
  const LEVEL_SCALING_TYPES = ["level_1", "level_5"];
  const SKILL_SCALING_TYPES = ["skill_1", "skill_5"];
  const ALLOCATION_LOOKAHEAD_WEIGHT = 0.4;
  const ALLOCATION_SHARE_NUDGE_WEIGHT = 0.085;
  const ALLOCATION_SPREAD_PENALTY = 0.0015;
  const MIN_ALLOCATION_SHARE = 0.04;
  const MAX_CATALOG_FLOOR = data.itemCatalog.reduce((maxFloor, item) => {
    return Math.max(maxFloor, toInt(item.floorMin, 1));
  }, 1);

  const form = document.getElementById("plannerForm");
  const stalePlanBanner = document.getElementById("stalePlanBanner");
  const planTableBody = document.querySelector("#planTable tbody");
  const logicExplanation = document.getElementById("logicExplanation");
  const gearResults = document.getElementById("gearResults");
  const upgradeTimeline = document.getElementById("upgradeTimeline");
  const benchmarkPanel = document.getElementById("benchmarkPanel");
  const outputPanel = document.querySelector(".output-panel");
  const collapsePanelsBtn = document.getElementById("collapsePanelsBtn");
  const expandPanelsBtn = document.getElementById("expandPanelsBtn");
  const copyLoadoutBtn = document.getElementById("copyLoadoutBtn");
  const copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
  const outputActionMessage = document.getElementById("outputActionMessage");
  const weaponClassSelect = document.getElementById("weaponClassSelect");
  const playstyleSelect = document.getElementById("playstyleSelect");
  const equippedLoadout = document.getElementById("equippedLoadout");
  const equippedMessage = document.getElementById("equippedMessage");
  const applyEquippedStatsBtn = document.getElementById("applyEquippedStatsBtn");
  const equipTopRecommendationsBtn = document.getElementById("equipTopRecommendationsBtn");
  const clearEquippedBtn = document.getElementById("clearEquippedBtn");
  const autoSyncGearTotalsField = form ? form.querySelector('[name="autoSyncGearTotals"]') : null;
  const autoAddOwnedOnEquipField = form ? form.querySelector('[name="autoAddOwnedOnEquip"]') : null;
  const ownedItemsField = form ? form.querySelector('[name="ownedItems"]') : null;
  const inventoryParserInput = document.getElementById("inventoryParserInput");
  const parseInventoryBtn = document.getElementById("parseInventoryBtn");
  const clearInventoryParserBtn = document.getElementById("clearInventoryParserBtn");
  const inventoryParserResult = document.getElementById("inventoryParserResult");
  const gearAttackInput = form ? form.querySelector('[name="gearAttack"]') : null;
  const gearDefenseInput = form ? form.querySelector('[name="gearDefense"]') : null;
  const gearDexterityInput = form ? form.querySelector('[name="gearDexterity"]') : null;

  const floorTrackerEl = document.getElementById("floorTracker");
  const floorTrackerSummary = document.getElementById("floorTrackerSummary");
  const ftClearAllBtn = document.getElementById("ftClearAllBtn");
  const ftMarkToFloorBtn = document.getElementById("ftMarkToFloorBtn");
  const quickPresetGrid = document.getElementById("quickPresetGrid");
  const printBuildBtn = document.getElementById("printBuildBtn");
  const sharedBuildBanner = document.getElementById("sharedBuildBanner");
  const changelogPanelEl = document.getElementById("changelogPanel");
  const gearSortModeSelect = document.getElementById("gearSortMode");

  const presetNameInput = document.getElementById("presetName");
  const savedBuildSelect = document.getElementById("savedBuildSelect");
  const saveBuildBtn = document.getElementById("saveBuildBtn");
  const togglePresetPinBtn = document.getElementById("togglePresetPinBtn");
  const showPinnedOnlyField = document.getElementById("showPinnedOnly");
  const loadBuildBtn = document.getElementById("loadBuildBtn");
  const deleteBuildBtn = document.getElementById("deleteBuildBtn");
  const exportBuildBtn = document.getElementById("exportBuildBtn");
  const importBuildBtn = document.getElementById("importBuildBtn");
  const importBuildInput = document.getElementById("importBuildInput");
  const buildActionMessage = document.getElementById("buildActionMessage");
  const compareBuildASelect = document.getElementById("compareBuildA");
  const compareBuildBSelect = document.getElementById("compareBuildB");
  const compareBuildBtn = document.getElementById("compareBuildBtn");
  const compareMessage = document.getElementById("compareMessage");
  const comparisonResults = document.getElementById("comparisonResults");
  const dataValidationStatus = document.getElementById("dataValidationStatus");
  const calibrationReport = document.getElementById("calibrationReport");
  const calibrationMessage = document.getElementById("calibrationMessage");
  const applyCalibrationBtn = document.getElementById("applyCalibrationBtn");
  const resetCalibrationBtn = document.getElementById("resetCalibrationBtn");
  const exportCalibrationBtn = document.getElementById("exportCalibrationBtn");
  const importCalibrationBtn = document.getElementById("importCalibrationBtn");
  const importCalibrationInput = document.getElementById("importCalibrationInput");
  const calibrationInputs = Object.fromEntries(
    CALIBRATION_METRICS.map((metric) => [metric.key, document.getElementById(metric.inputId)]),
  );
  const aiChatMessages = document.getElementById("aiChatMessages");
  const aiChatInput = document.getElementById("aiChatInput");
  const aiChatSendBtn = document.getElementById("aiChatSendBtn");
  const aiChatStatus = document.getElementById("aiChatStatus");

  let calibrationState = readCalibrationStorage();
  let pinnedPresetNames = readPinnedPresetStorage();
  let equippedState = readEquippedStorage();
  let lastGearPlan = {};
  let lastPlanResult = null;
  let draftWriteTimer = null;
  let recalcDebounceTimer = null;
  let formDirtySinceLastSubmit = false;
  let outputPanelsCollapsed = false;
  const dataValidationReport = validateDataSchema(data);

  populateSelects();
  if (showPinnedOnlyField) {
    showPinnedOnlyField.checked = readPresetFilterPreference();
  }
  restoreDraftFormState();
  initializeBuildPresetControls();
  initializeCalibrationControls();
  initializeQuickEquipControls();
  initializeOutputPanelControls();
  initializeInventoryParser();
  initializeKeyboardShortcuts();
  initializeShareLink();
  initializeFloorTracker();
  initializeQuickPresets();
  initializeStatCapWarnings();
  renderChangelog();
  applyUrlShareParams();

  (function initThemeToggle() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const isDark = () =>
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const sync = () => {
      const dark = isDark();
      btn.textContent = dark ? "☀" : "🌙";
      btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    };
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("sbo-theme", next); } catch (e) {}
      sync();
    });
    sync();
  })();
  renderDataValidationStatus(dataValidationReport);
  renderEquippedLoadout(getFormInput());
  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", handleFormInputChanged);
  form.addEventListener("change", handleFormInputChanged);

  const bossPlannerLink = document.querySelector('a[href="./boss.html"]');
  if (bossPlannerLink) {
    bossPlannerLink.addEventListener("click", () => flushDraftNow());
  }

  window.addEventListener("beforeunload", () => flushDraftNow());
  window.addEventListener("pagehide", () => flushDraftNow());

  initializeAiChat();

  // Run once on load so users immediately see a sample output.
  onSubmit(new Event("submit"));

  function populateSelects() {
    Object.entries(data.weaponProfiles).forEach(([value, profile]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = profile.label;
      if (value === "two-handed") option.selected = true;
      weaponClassSelect.appendChild(option);
    });

    Object.entries(data.playstyles).forEach(([value, style]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = style.label;
      if (value === "balanced") option.selected = true;
      playstyleSelect.appendChild(option);
    });
  }

  function handleGearActionClick(event) {
    const button = event.target.closest("button[data-action][data-item-id]");
    if (!button || !gearResults || !gearResults.contains(button)) {
      return;
    }

    const action = `${button.dataset.action || ""}`;
    const itemId = `${button.dataset.itemId || ""}`;
    const slot = `${button.dataset.slot || ""}`;
    const item = getCatalogItemById(itemId);

    if (!item) {
      showEquippedMessage("Could not find that item in the catalog.", "error");
      return;
    }

    if (action === "equip-item") {
      equipItemInSlot(item, slot || item.slot, {
        syncTotals: isAutoSyncGearTotalsEnabled(),
        addOwned: isAutoAddOwnedOnEquipEnabled(),
      });
      return;
    }

    if (action === "add-owned-item") {
      const added = addItemToOwnedList(item);
      showEquippedMessage(
        added ? `${item.name} added to Owned items.` : `${item.name} is already listed in Owned items.`,
        added ? "success" : "info",
      );
      onSubmit(new Event("submit"));
    }
  }

  function handleEquippedLoadoutAction(event) {
    const button = event.target.closest("button[data-action][data-slot]");
    if (!button || !equippedLoadout || !equippedLoadout.contains(button)) {
      return;
    }

    const action = `${button.dataset.action || ""}`;
    const slot = `${button.dataset.slot || ""}`;

    if (action !== "clear-equipped-slot") {
      return;
    }

    if (!EQUIPPED_SLOTS.includes(slot)) {
      return;
    }

    if (!equippedState?.slots?.[slot]) {
      showEquippedMessage(`No equipped item to clear in ${getSlotLabel(slot)}.`, "info");
      return;
    }

    equippedState.slots[slot] = "";
    equippedState.updatedAt = new Date().toISOString();
    writeEquippedStorage(equippedState);
    showEquippedMessage(`Cleared equipped item from ${getSlotLabel(slot)}.`, "success");
    onSubmit(new Event("submit"));
  }

  function handleApplyEquippedStats() {
    const applied = applyEquippedStatsFromState({ showMessage: true });
    if (applied) {
      onSubmit(new Event("submit"));
    }
  }

  function handleEquipTopRecommendations() {
    const input = getFormInput();
    const planResult = buildLevelPlan(input);
    const gearPlan = recommendGear(input, planResult.finalStats);
    lastGearPlan = gearPlan;
    const slots = getRecommendedSlots(input.weaponClass);
    const equippedNames = [];
    let addedOwnedCount = 0;

    slots.forEach((slot) => {
      const top = gearPlan?.[slot]?.[0];
      if (!top?.item) return;

      equippedState.slots[slot] = top.item.id;
      equippedNames.push(top.item.name);

      if (isAutoAddOwnedOnEquipEnabled() && addItemToOwnedList(top.item)) {
        addedOwnedCount += 1;
      }
    });

    if (!equippedNames.length) {
      showEquippedMessage("No recommendation candidates available to equip.", "error");
      return;
    }

    equippedState.updatedAt = new Date().toISOString();
    writeEquippedStorage(equippedState);

    const syncedTotals = isAutoSyncGearTotalsEnabled() ? applyEquippedStatsFromState({ showMessage: false }) : false;
    const detailParts = [];
    if (syncedTotals) detailParts.push("gear totals synced");
    if (addedOwnedCount > 0) detailParts.push(`${addedOwnedCount} item${addedOwnedCount === 1 ? "" : "s"} added to owned`);

    const detailSuffix = detailParts.length ? ` (${detailParts.join(", ")})` : "";
    showEquippedMessage(`Equipped top recommendations for ${equippedNames.length} slot${equippedNames.length === 1 ? "" : "s"}${detailSuffix}.`, "success");
    onSubmit(new Event("submit"));
  }

  function handleClearEquipped() {
    equippedState = createDefaultEquippedState();
    writeEquippedStorage(equippedState);
    showEquippedMessage("Cleared equipped loadout.", "success");
    onSubmit(new Event("submit"));
  }

  function equipItemInSlot(item, slot, options = {}) {
    const targetSlot = slot || item.slot;
    if (!EQUIPPED_SLOTS.includes(targetSlot)) {
      showEquippedMessage("Unsupported equipment slot.", "error");
      return;
    }

    equippedState.slots[targetSlot] = item.id;
    equippedState.updatedAt = new Date().toISOString();
    writeEquippedStorage(equippedState);

    const addedToOwned = options.addOwned ? addItemToOwnedList(item) : false;
    const syncedTotals = options.syncTotals ? applyEquippedStatsFromState({ showMessage: false }) : false;

    const detailParts = [];
    if (syncedTotals) detailParts.push("gear totals synced");
    if (addedToOwned) detailParts.push("added to owned");
    const detailSuffix = detailParts.length ? ` (${detailParts.join(", ")})` : "";

    showEquippedMessage(`Equipped ${item.name} in ${getSlotLabel(targetSlot)}${detailSuffix}.`, "success");
    onSubmit(new Event("submit"));
  }

  function applyEquippedStatsFromState(options = {}) {
    const showMessage = options.showMessage !== false;
    const input = getFormInput();
    const loadout = computeEquippedLoadout(input);

    if (!loadout.equippedCount) {
      if (showMessage) {
        showEquippedMessage("No equipped items selected yet.", "error");
      }
      return false;
    }

    if (!gearAttackInput || !gearDefenseInput || !gearDexterityInput) {
      if (showMessage) {
        showEquippedMessage("Gear total fields are not available in the form.", "error");
      }
      return false;
    }

    gearAttackInput.value = `${Math.max(1, round(loadout.totals.attack, 2))}`;
    gearDefenseInput.value = `${Math.max(0, round(loadout.totals.defense, 2))}`;
    gearDexterityInput.value = `${Math.max(0, round(loadout.totals.dexterity, 2))}`;

    if (showMessage) {
      showEquippedMessage(
        `Applied equipped totals (ATK ${round(loadout.totals.attack, 2)} / DEF ${round(loadout.totals.defense, 2)} / DEX ${round(loadout.totals.dexterity, 2)}).`,
        "success",
      );
    }

    queueDraftWrite();
    return true;
  }

  function renderEquippedLoadout(input) {
    if (!equippedLoadout) return;

    const loadout = computeEquippedLoadout(input);

    if (!loadout.equippedCount) {
      equippedLoadout.hidden = true;
      equippedLoadout.innerHTML = "";
      return;
    }

    equippedLoadout.hidden = false;

    const cardsHtml = loadout.slotEntries
      .filter((entry) => entry.item)
      .map((entry) => {
        const warnClass = entry.isCompatible ? "" : " warn";
        const compatibilityNote = entry.isCompatible
          ? ""
          : `<p class="equipped-item-warning">Current class filter may not prioritize this item.</p>`;

        return `
          <article class="equipped-slot-card${warnClass}">
            <h4>${escapeHtml(getSlotLabel(entry.slot))}</h4>
            <p class="equipped-item-name">${escapeHtml(entry.item.name)}</p>
            <p class="equipped-item-meta">
              ATK ${round(entry.statBlock.attack || 0, 2)} · DEF ${round(entry.statBlock.defense || 0, 2)} · DEX ${round(
                entry.statBlock.dexterity || 0,
                2,
              )}
            </p>
            ${compatibilityNote}
            <button type="button" class="chip-btn" data-action="clear-equipped-slot" data-slot="${escapeHtml(entry.slot)}">Clear</button>
          </article>
        `;
      })
      .join("");

    equippedLoadout.innerHTML = `
      <div class="equipped-summary">
        <article>
          <span>Equipped</span>
          <strong>${loadout.equippedCount}</strong>
        </article>
        <article>
          <span>ATK</span>
          <strong>${round(loadout.totals.attack, 2)}</strong>
        </article>
        <article>
          <span>DEF</span>
          <strong>${round(loadout.totals.defense, 2)}</strong>
        </article>
        <article>
          <span>DEX</span>
          <strong>${round(loadout.totals.dexterity, 2)}</strong>
        </article>
      </div>
      <div class="equipped-slot-grid">
        ${cardsHtml}
      </div>
    `;
  }

  function computeEquippedLoadout(input) {
    const slots = getRecommendedSlots(input.weaponClass);
    const projectedLevel = input.currentLevel + input.levelsToPlan;

    const slotEntries = slots.map((slot) => {
      const itemId = `${equippedState?.slots?.[slot] || ""}`.trim();
      const item = itemId ? getCatalogItemById(itemId) : null;
      if (!item || item.slot !== slot) {
        return {
          slot,
          item: null,
          statBlock: { attack: 0, defense: 0, dexterity: 0 },
          isCompatible: true,
        };
      }

      const sourceQ = data.sourceQuality[item.sourceType] || 1;
      const statBlock = deriveItemStatBlock(item, sourceQ, projectedLevel, input.weaponSkill);
      const isCompatible = slot !== "weapon" || isWeaponClassCompatible(item.weaponClass, input.weaponClass);

      return {
        slot,
        item,
        statBlock,
        isCompatible,
      };
    });

    const totals = slotEntries.reduce(
      (acc, entry) => {
        if (!entry.item) return acc;
        acc.attack += entry.statBlock.attack || 0;
        acc.defense += entry.statBlock.defense || 0;
        acc.dexterity += entry.statBlock.dexterity || 0;
        return acc;
      },
      { attack: 0, defense: 0, dexterity: 0 },
    );

    return {
      slotEntries,
      totals,
      equippedCount: slotEntries.filter((entry) => Boolean(entry.item)).length,
    };
  }

  function isAutoSyncGearTotalsEnabled() {
    return autoSyncGearTotalsField ? autoSyncGearTotalsField.checked : true;
  }

  function isAutoAddOwnedOnEquipEnabled() {
    return autoAddOwnedOnEquipField ? autoAddOwnedOnEquipField.checked : true;
  }

  function addItemToOwnedList(item) {
    if (!ownedItemsField) return false;

    const currentRaw = `${ownedItemsField.value || ""}`;
    const tokens = parseOwnedTokens(currentRaw);
    const idToken = normalizeOwnedToken(item.id);
    const nameToken = normalizeOwnedToken(item.name);

    if (tokens.has(idToken) || tokens.has(nameToken)) {
      return false;
    }

    const pieces = currentRaw
      .split(",")
      .map((piece) => piece.trim())
      .filter(Boolean);
    pieces.push(item.name);
    ownedItemsField.value = pieces.join(", ");
    queueDraftWrite();
    return true;
  }

  function getCatalogItemById(itemId) {
    return data.itemCatalog.find((item) => item.id === itemId) || null;
  }

  function restoreDraftFormState() {
    const draft = readFormDraft();
    if (!draft || typeof draft !== "object") {
      return;
    }

    applyFormSnapshot(draft);
  }

  function onSubmit(event) {
    event.preventDefault();

    const input = getFormInput();
    const planResult = buildLevelPlan(input);
    lastPlanResult = planResult;
    const gearPlan = recommendGear(input, planResult.finalStats);
    lastGearPlan = gearPlan;

    renderLogic(input, planResult);
    renderPlanRows(planResult.rows);
    renderGearRecommendations(gearPlan, input);
    renderBenchmarkPanel(input, planResult);
    renderUpgradeTimeline(input);
    renderSkillChecklist(input);
    renderPartyRoleAdvisor(input, planResult);
    renderEquippedLoadout(input);
    renderCalibrationReport(calibrationState, planResult.finalEval);
    queueDraftWrite();
    formDirtySinceLastSubmit = false;
    renderStalePlanBanner();
  }

  function renderStalePlanBanner() {
    if (!stalePlanBanner) return;
    stalePlanBanner.hidden = !formDirtySinceLastSubmit;
  }

  function handleFormInputChanged(event) {
    renderEquippedLoadout(getFormInput());
    queueDraftWrite();
    formDirtySinceLastSubmit = true;
    renderStalePlanBanner();

    if (event && event.target && RECOMMENDATION_AFFECTING_FIELDS.includes(event.target.getAttribute?.("name") || "")) {
      if (recalcDebounceTimer) clearTimeout(recalcDebounceTimer);
      recalcDebounceTimer = setTimeout(() => {
        recalcDebounceTimer = null;
        onSubmit(new Event("submit"));
      }, RECALC_ON_RECOMMENDATION_FIELD_CHANGE_MS);
    }
  }

  function queueDraftWrite() {
    if (draftWriteTimer) {
      clearTimeout(draftWriteTimer);
    }

    draftWriteTimer = setTimeout(() => {
      draftWriteTimer = null;
      writeFormDraft(collectFormSnapshot());
    }, FORM_DRAFT_WRITE_DELAY_MS);
  }

  function flushDraftNow() {
    if (draftWriteTimer) {
      clearTimeout(draftWriteTimer);
      draftWriteTimer = null;
    }
    writeFormDraft(collectFormSnapshot());
  }

  function initializeBuildPresetControls() {
    refreshSavedBuildOptions();

    if (saveBuildBtn) saveBuildBtn.addEventListener("click", handleSaveBuild);
    if (togglePresetPinBtn) togglePresetPinBtn.addEventListener("click", handleTogglePresetPin);
    if (showPinnedOnlyField) showPinnedOnlyField.addEventListener("change", handleShowPinnedOnlyChange);
    if (loadBuildBtn) loadBuildBtn.addEventListener("click", handleLoadBuild);
    if (deleteBuildBtn) deleteBuildBtn.addEventListener("click", handleDeleteBuild);
    if (exportBuildBtn) exportBuildBtn.addEventListener("click", handleExportBuild);
    if (importBuildBtn) {
      importBuildBtn.addEventListener("click", () => {
        if (importBuildInput) {
          importBuildInput.click();
        }
      });
    }

    if (importBuildInput) {
      importBuildInput.addEventListener("change", handleImportBuild);
    }

    if (compareBuildBtn) {
      compareBuildBtn.addEventListener("click", handleCompareBuilds);
    }

    if (savedBuildSelect) {
      savedBuildSelect.addEventListener("change", () => {
        refreshPresetPinButtonState();
      });
    }

    if (presetNameInput) {
      presetNameInput.addEventListener("input", () => {
        refreshPresetPinButtonState();
      });
    }

    refreshPresetPinButtonState();
  }

  function initializeInventoryParser() {
    if (parseInventoryBtn) {
      parseInventoryBtn.addEventListener("click", handleParseInventory);
    }

    if (clearInventoryParserBtn) {
      clearInventoryParserBtn.addEventListener("click", () => {
        if (inventoryParserInput) inventoryParserInput.value = "";
        if (inventoryParserResult) {
          inventoryParserResult.hidden = true;
          inventoryParserResult.innerHTML = "";
        }
      });
    }
  }

  function initializeAiChat() {
    const cfg = window.SBO_AI_CONFIG || {};
    const supabaseUrl = cfg.supabaseUrl || "https://ejotaqqcqcoljzbbyesd.supabase.co";
    const anonKey = cfg.anonKey || "";
    const endpoint = `${supabaseUrl}/functions/v1/sbo-ai-advisor`;

    if (!aiChatMessages || !aiChatInput || !aiChatSendBtn || !aiChatStatus) return;

    function setStatus(text, type) {
      aiChatStatus.textContent = text || "";
      aiChatStatus.className = "ai-chat-status" + (type ? ` ${type}` : "");
    }

    function appendMessage(role, content) {
      const div = document.createElement("div");
      div.className = `ai-chat-message ${role}`;
      div.innerHTML = `<span class="msg-role">${role === "user" ? "You" : "AI"}</span><div>${escapeHtml(content)}</div>`;
      aiChatMessages.appendChild(div);
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    }

    function buildContext() {
      const input = getFormInput();
      const projectedLevel = input.currentLevel + input.levelsToPlan;
      const ctx = {
        level: input.currentLevel,
        projectedLevel,
        weaponClass: input.weaponClass,
        playstyle: input.playstyle,
        allocationMode: input.allocationMode,
        weaponSkill: input.weaponSkill,
        maxFloor: input.maxFloorReached,
        stats: input.stats,
        gear: input.gear,
      };

      const planStale = !lastPlanResult || formDirtySinceLastSubmit;
      if (planStale) {
        const evalResult = evaluateBuild(input.stats, input, projectedLevel);
        const m = evalResult.metrics;
        ctx.metrics = {
          dpsProjection: m.dpsProjection,
          damageReduction: m.damageReduction,
          bonusHp: m.bonusHp,
          critChancePct: m.critChancePct,
          multiHitPct: m.multiHitPct,
          debuffResPct: m.debuffResPct,
        };
      } else if (lastPlanResult?.finalEval?.metrics) {
        const m = lastPlanResult.finalEval.metrics;
        ctx.metrics = {
          dpsProjection: m.dpsProjection,
          damageReduction: m.damageReduction,
          bonusHp: m.bonusHp,
          critChancePct: m.critChancePct,
          multiHitPct: m.multiHitPct,
          debuffResPct: m.debuffResPct,
        };
      }

      if (!planStale && lastPlanResult?.rows?.length) {
        const first = lastPlanResult.rows[0];
        const last = lastPlanResult.rows[lastPlanResult.rows.length - 1];
        const alloc = last?.totals
          ? `Lv${first?.level || input.currentLevel}→Lv${last.level}: STR ${last.totals.str} DEF ${last.totals.def} AGI ${last.totals.agi} VIT ${last.totals.vit} LUK ${last.totals.luk}`
          : "";
        ctx.planSummary = alloc;
      }

      if (!planStale && lastGearPlan && typeof lastGearPlan === "object") {
        const top = {};
        for (const [slot, items] of Object.entries(lastGearPlan)) {
          if (Array.isArray(items) && items.length) {
            top[slot] = items.slice(0, 2).map(({ item }) => ({ name: item?.name || "?", score: undefined }));
          }
        }
        ctx.topRecommendations = top;
      }

      if (window.SBO_BOSS_READINESS && ctx.metrics) {
        const build = {
          stats: input.stats,
          metrics: ctx.metrics,
          projectedLevel,
          weaponSkill: input.weaponSkill,
        };
        const nextBoss = window.SBO_BOSS_READINESS.getNextBoss(build);
        ctx.nextBoss = nextBoss ? `${nextBoss.name} (Floor ${nextBoss.floor})` : null;
        ctx.readinessAdvice = window.SBO_BOSS_READINESS.getStatAdvice(build, nextBoss);
      }

      return ctx;
    }

    if (!anonKey) {
      aiChatMessages.innerHTML = `
        <div class="ai-chat-setup-msg">
          <strong>AI Advisor setup</strong><br>
          To enable the AI chat, set <code>window.SBO_AI_CONFIG = { supabaseUrl, anonKey }</code> before loading the planner,
          or add a script that defines it. Then deploy the <code>sbo-ai-advisor</code> Edge Function to Supabase
          with <code>HUGGINGFACE_TOKEN</code> in secrets. See <code>supabase/functions/sbo-ai-advisor/</code> and AI_SETUP.md.
        </div>`;
      aiChatSendBtn.disabled = true;
      return;
    }

    aiChatSendBtn.addEventListener("click", async () => {
      const msg = aiChatInput.value.trim();
      if (!msg) return;

      aiChatInput.value = "";
      appendMessage("user", msg);
      aiChatSendBtn.disabled = true;
      setStatus("Thinking…", "loading");

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            message: msg,
            buildContext: buildContext(),
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        appendMessage("assistant", json.reply || "No response.");
        setStatus("");
      } catch (err) {
        appendMessage("assistant", `Error: ${err.message}`);
        setStatus(err.message, "error");
      } finally {
        aiChatSendBtn.disabled = false;
      }
    });

    aiChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        aiChatSendBtn.click();
      }
    });
  }

  function handleParseInventory() {
    if (!inventoryParserInput || !ownedItemsField) return;

    const raw = inventoryParserInput.value;
    const parsed = parseInventoryList(raw);

    if (!parsed.length) {
      if (inventoryParserResult) {
        inventoryParserResult.hidden = false;
        inventoryParserResult.innerHTML = `<span class="parser-warn">No items found. Paste one item per line or comma-separated.</span>`;
      }
      return;
    }

    const existingRaw = ownedItemsField.value.trim();
    const existingTokens = existingRaw
      ? existingRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const existingNorm = new Set(existingTokens.map((t) => normalizeOwnedToken(t)));
    const newItems = parsed.filter((item) => !existingNorm.has(normalizeOwnedToken(item)));
    const merged = [...existingTokens, ...newItems];

    ownedItemsField.value = merged.join(", ");
    ownedItemsField.dispatchEvent(new Event("input", { bubbles: true }));

    if (inventoryParserResult) {
      inventoryParserResult.hidden = false;
      if (newItems.length === 0) {
        inventoryParserResult.innerHTML = `<span class="parser-ok">All ${parsed.length} parsed item${parsed.length === 1 ? "" : "s"} already in owned list.</span>`;
      } else {
        inventoryParserResult.innerHTML =
          `<span class="parser-ok">Merged ${newItems.length} new item${newItems.length === 1 ? "" : "s"} (${parsed.length} parsed, ${parsed.length - newItems.length} already present):</span>` +
          `<ul class="parser-list">${newItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
    }
  }

  function parseInventoryList(raw) {
    if (!raw || !raw.trim()) return [];

    const lines = raw
      .split(/[\n\r]+/)
      .flatMap((line) => line.split(","))
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const seen = new Set();
    const deduped = [];

    lines.forEach((line) => {
      const norm = normalizeOwnedToken(line);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        deduped.push(line);
      }
    });

    return deduped;
  }

  function initializeCalibrationControls() {
    if (applyCalibrationBtn) {
      applyCalibrationBtn.addEventListener("click", handleApplyCalibrationSample);
    }
    if (resetCalibrationBtn) {
      resetCalibrationBtn.addEventListener("click", handleResetCalibration);
    }
    if (exportCalibrationBtn) {
      exportCalibrationBtn.addEventListener("click", handleExportCalibration);
    }
    if (importCalibrationBtn) {
      importCalibrationBtn.addEventListener("click", () => {
        if (importCalibrationInput) {
          importCalibrationInput.click();
        }
      });
    }
    if (importCalibrationInput) {
      importCalibrationInput.addEventListener("change", handleImportCalibration);
    }

    renderCalibrationReport(calibrationState);
  }

  function initializeQuickEquipControls() {
    if (gearResults) {
      gearResults.addEventListener("click", handleGearActionClick);
    }

    if (equippedLoadout) {
      equippedLoadout.addEventListener("click", handleEquippedLoadoutAction);
    }

    if (applyEquippedStatsBtn) {
      applyEquippedStatsBtn.addEventListener("click", handleApplyEquippedStats);
    }

    if (equipTopRecommendationsBtn) {
      equipTopRecommendationsBtn.addEventListener("click", handleEquipTopRecommendations);
    }

    if (clearEquippedBtn) {
      clearEquippedBtn.addEventListener("click", handleClearEquipped);
    }
  }

  function initializeOutputPanelControls() {
    if (!outputPanel) return;

    enhanceSubpanelToggles();
    outputPanel.addEventListener("click", handleOutputPanelAction);

    if (collapsePanelsBtn) {
      collapsePanelsBtn.addEventListener("click", () => {
        setAllSubpanelsCollapsed(true);
      });
    }

    if (expandPanelsBtn) {
      expandPanelsBtn.addEventListener("click", () => {
        setAllSubpanelsCollapsed(false);
      });
    }

    if (copyLoadoutBtn) {
      copyLoadoutBtn.addEventListener("click", handleCopyLoadout);
    }

    if (printBuildBtn) {
      printBuildBtn.addEventListener("click", () => window.print());
    }
  }

  function initializeKeyboardShortcuts() {
    document.addEventListener("keydown", handleKeyboardShortcut);
  }

  function buildShareUrl() {
    const snapshot = collectFormSnapshot();
    const params = new URLSearchParams();
    SHARE_FIELDS.forEach((key) => {
      const val = `${snapshot[key] || ""}`.trim();
      if (val) params.set(key, val);
    });
    SHARE_BOOL_FIELDS.forEach((key) => {
      if (snapshot[key]) params.set(key, "1");
    });
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?${params.toString()}`;
  }

  function applyUrlShareParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("currentLevel") && !params.has("weaponClass")) return;

    const snapshot = {};
    SHARE_FIELDS.forEach((key) => {
      if (params.has(key)) snapshot[key] = params.get(key);
    });
    SHARE_BOOL_FIELDS.forEach((key) => {
      snapshot[key] = params.has(key) && params.get(key) !== "0";
    });

    if (Object.keys(snapshot).length) {
      applyFormSnapshot(snapshot);
      const name = `${snapshot.buildName || ""}`.trim();
      if (sharedBuildBanner) {
        sharedBuildBanner.hidden = false;
        sharedBuildBanner.innerHTML = name
          ? `<span class="sbb-name">⚔ ${escapeHtml(name)}</span><span class="sbb-hint">Loaded from shared link — edit freely, your changes stay local.</span>`
          : `<span class="sbb-name">⚔ Shared Build</span><span class="sbb-hint">Loaded from shared link — edit freely, your changes stay local.</span>`;
      }
      showOutputActionMessage(name ? `Build "${name}" loaded from shared link.` : "Build loaded from shared link.", "success");
    }
  }

  function initializeShareLink() {
    if (!copyShareLinkBtn) return;
    copyShareLinkBtn.addEventListener("click", async () => {
      const url = buildShareUrl();
      const copied = await copyTextToClipboard(url);
      showOutputActionMessage(
        copied ? "Share link copied to clipboard!" : `Share link: ${url}`,
        copied ? "success" : "info",
      );
    });
  }


  function handleKeyboardShortcut(event) {
    if (event.defaultPrevented) return;

    const accelPressed = event.ctrlKey || event.metaKey;
    if (!accelPressed) return;

    const key = `${event.key || ""}`.toLowerCase();

    if (key === "enter") {
      event.preventDefault();
      onSubmit(new Event("submit"));
      return;
    }

    if (key === "s") {
      event.preventDefault();
      handleSaveBuild();
      return;
    }

    if (key === "l") {
      event.preventDefault();
      handleLoadBuild();
      return;
    }

    if (key === "e") {
      event.preventDefault();
      handleEquipTopRecommendations();
      return;
    }

    if (key === "p" && event.shiftKey) {
      event.preventDefault();
      handleTogglePresetPin();
      return;
    }

    if (key === "/" || key === "?") {
      event.preventDefault();
      setAllSubpanelsCollapsed(!outputPanelsCollapsed);
    }
  }

  function handleOutputPanelAction(event) {
    const syncBtn = event.target.closest("#syncToPlanBtn");
    if (syncBtn && outputPanel?.contains(syncBtn)) {
      handleSyncToPlanClick();
      return;
    }

    const button = event.target.closest("button.panel-toggle");
    if (!button || !outputPanel || !outputPanel.contains(button)) {
      return;
    }

    const panel = button.closest(".subpanel");
    if (!panel) return;

    setSubpanelCollapsed(panel, !panel.classList.contains("collapsed"));
    syncOutputPanelsCollapsedState();
  }

  function enhanceSubpanelToggles() {
    if (!outputPanel) return;

    const panels = outputPanel.querySelectorAll(".subpanel");
    panels.forEach((panel) => {
      const heading = panel.querySelector("h3");
      if (!heading) return;

      heading.classList.add("subpanel-heading");

      let toggle = heading.querySelector(".panel-toggle");
      if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "panel-toggle";
        heading.appendChild(toggle);
      }

      setSubpanelCollapsed(panel, panel.classList.contains("collapsed"));
    });

    syncOutputPanelsCollapsedState();
  }

  function setSubpanelCollapsed(panel, collapsed) {
    panel.classList.toggle("collapsed", collapsed);
    const toggle = panel.querySelector(".panel-toggle");
    if (!toggle) return;

    getSubpanelBodyNodes(panel).forEach((node) => {
      node.hidden = collapsed;
    });

    toggle.textContent = collapsed ? "Expand" : "Collapse";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function getSubpanelBodyNodes(panel) {
    return Array.from(panel.children).filter((node) => !node.classList.contains("subpanel-heading"));
  }

  function setAllSubpanelsCollapsed(collapsed) {
    if (!outputPanel) return;

    const panels = outputPanel.querySelectorAll(".subpanel");
    if (!panels.length) return;

    panels.forEach((panel) => {
      setSubpanelCollapsed(panel, collapsed);
    });

    outputPanelsCollapsed = collapsed;
    showOutputActionMessage(collapsed ? "Collapsed all output panels." : "Expanded all output panels.", "success");
  }

  function syncOutputPanelsCollapsedState() {
    if (!outputPanel) {
      outputPanelsCollapsed = false;
      return;
    }

    const panels = Array.from(outputPanel.querySelectorAll(".subpanel"));
    outputPanelsCollapsed = panels.length > 0 && panels.every((panel) => panel.classList.contains("collapsed"));
  }

  async function handleCopyLoadout() {
    const input = getFormInput();
    const loadoutText = buildEquippedLoadoutCopyText(input);

    if (!loadoutText) {
      showOutputActionMessage("No equipped loadout to copy yet.", "error");
      return;
    }

    const copied = await copyTextToClipboard(loadoutText);
    showOutputActionMessage(
      copied ? "Copied equipped loadout to clipboard." : "Could not copy loadout in this browser.",
      copied ? "success" : "error",
    );
  }

  function buildEquippedLoadoutCopyText(input) {
    const loadout = computeEquippedLoadout(input);
    if (!loadout.equippedCount) {
      return "";
    }

    const lines = ["SBO:Rebirth Equipped Loadout"];

    loadout.slotEntries.forEach((entry) => {
      if (!entry.item) return;

      lines.push(
        `${getSlotLabel(entry.slot)}: ${entry.item.name} (ATK ${round(entry.statBlock.attack || 0, 2)} / DEF ${round(entry.statBlock.defense || 0, 2)} / DEX ${round(entry.statBlock.dexterity || 0, 2)})`,
      );
    });

    lines.push(
      `Totals: ATK ${round(loadout.totals.attack, 2)} / DEF ${round(loadout.totals.defense, 2)} / DEX ${round(loadout.totals.dexterity, 2)}`,
    );

    return lines.join("\n");
  }

  function renderDataValidationStatus(report) {
    if (!dataValidationStatus || !report) return;

    const summaryText = `${report.summary.itemCount} items checked (${report.summary.exactCount} exact / ${report.summary.nonExactCount} non-exact).`;

    if (!report.errors.length && !report.warnings.length) {
      dataValidationStatus.className = "data-validation-status ok";
      dataValidationStatus.innerHTML = `
        <strong>Catalog schema check:</strong>
        <span>pass - ${escapeHtml(summaryText)}</span>
      `;
      return;
    }

    const messageClass = report.errors.length ? "error" : "warn";
    const lead = report.errors.length
      ? `${report.errors.length} error${report.errors.length === 1 ? "" : "s"}`
      : `${report.warnings.length} warning${report.warnings.length === 1 ? "" : "s"}`;
    const issueLines = [
      ...report.errors.map((text) => `Error: ${text}`),
      ...report.warnings.map((text) => `Warning: ${text}`),
    ].slice(0, 6);

    dataValidationStatus.className = `data-validation-status ${messageClass}`;
    dataValidationStatus.innerHTML = `
      <strong>Catalog schema check:</strong>
      <span>${escapeHtml(lead)} - ${escapeHtml(summaryText)}</span>
      <ul>
        ${issueLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    `;
  }

  function validateDataSchema(dataset) {
    const errors = [];
    const warnings = [];

    const addError = (message) => errors.push(message);
    const addWarning = (message) => warnings.push(message);

    if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
      return {
        errors: ["Top-level data object is missing or invalid."],
        warnings,
        summary: {
          itemCount: 0,
          exactCount: 0,
          nonExactCount: 0,
        },
      };
    }

    if (!Number.isFinite(dataset.pointsPerLevel) || dataset.pointsPerLevel < 1) {
      addError("pointsPerLevel must be a positive number.");
    }
    if (!Number.isFinite(dataset.statCap) || dataset.statCap < 1) {
      addError("statCap must be a positive number.");
    }

    DATA_FORMULA_KEYS.forEach((key) => {
      if (!Number.isFinite(dataset?.formulas?.[key])) {
        addError(`formulas.${key} must be numeric.`);
      }
    });

    const weaponProfiles = dataset.weaponProfiles;
    if (!weaponProfiles || typeof weaponProfiles !== "object" || Array.isArray(weaponProfiles)) {
      addError("weaponProfiles must be an object.");
    } else {
      Object.entries(weaponProfiles).forEach(([profileKey, profile]) => {
        if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
          addError(`weaponProfiles.${profileKey} must be an object.`);
          return;
        }

        if (!profile.label) {
          addError(`weaponProfiles.${profileKey}.label is required.`);
        }

        STAT_KEYS.forEach((statKey) => {
          if (!Number.isFinite(profile?.statBias?.[statKey])) {
            addError(`weaponProfiles.${profileKey}.statBias.${statKey} must be numeric.`);
          }
        });
      });
    }

    const playstyles = dataset.playstyles;
    if (!playstyles || typeof playstyles !== "object" || Array.isArray(playstyles)) {
      addError("playstyles must be an object.");
    } else {
      Object.entries(playstyles).forEach(([styleKey, style]) => {
        if (!style || typeof style !== "object" || Array.isArray(style)) {
          addError(`playstyles.${styleKey} must be an object.`);
          return;
        }

        if (!style.label) {
          addError(`playstyles.${styleKey}.label is required.`);
        }

        PLAYSTYLE_WEIGHT_KEYS.forEach((weightKey) => {
          if (!Number.isFinite(style?.weights?.[weightKey])) {
            addError(`playstyles.${styleKey}.weights.${weightKey} must be numeric.`);
          }
        });
      });
    }

    const safeWeaponProfiles =
      weaponProfiles && typeof weaponProfiles === "object" && !Array.isArray(weaponProfiles) ? weaponProfiles : {};
    const safeSourceQuality =
      dataset.sourceQuality && typeof dataset.sourceQuality === "object" && !Array.isArray(dataset.sourceQuality)
        ? dataset.sourceQuality
        : {};
    const safeScalingQuality =
      dataset.scalingQuality && typeof dataset.scalingQuality === "object" && !Array.isArray(dataset.scalingQuality)
        ? dataset.scalingQuality
        : {};

    if (!dataset.sourceQuality || typeof dataset.sourceQuality !== "object" || Array.isArray(dataset.sourceQuality)) {
      addError("sourceQuality must be an object.");
    }

    if (!dataset.scalingQuality || typeof dataset.scalingQuality !== "object" || Array.isArray(dataset.scalingQuality)) {
      addError("scalingQuality must be an object.");
    }

    if (!Array.isArray(dataset.itemCatalog)) {
      addError("itemCatalog must be an array.");
      return {
        errors,
        warnings,
        summary: {
          itemCount: 0,
          exactCount: 0,
          nonExactCount: 0,
        },
      };
    }

    const seenIds = new Set();

    dataset.itemCatalog.forEach((item, index) => {
      const itemTag = `itemCatalog[${index}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        addError(`${itemTag} must be an object.`);
        return;
      }

      const itemId = `${item.id || ""}`.trim();
      if (!itemId) {
        addError(`${itemTag}.id is required.`);
      } else if (seenIds.has(itemId)) {
        addError(`${itemTag}.id duplicates another item id (${itemId}).`);
      } else {
        seenIds.add(itemId);
      }

      if (!item.name) {
        addError(`${itemTag}.name is required.`);
      }

      if (!VALID_ITEM_SLOTS.includes(item.slot)) {
        addError(`${itemTag}.slot must be one of: ${VALID_ITEM_SLOTS.join(", ")}.`);
      }

      if (!Object.prototype.hasOwnProperty.call(safeSourceQuality, item.sourceType)) {
        addError(`${itemTag}.sourceType must match a sourceQuality key.`);
      }

      if (!VALID_SCALING_TYPES.includes(item.scalingType)) {
        addError(`${itemTag}.scalingType must be one of: ${VALID_SCALING_TYPES.join(", ")}.`);
      } else if (!Object.prototype.hasOwnProperty.call(safeScalingQuality, item.scalingType)) {
        addError(`${itemTag}.scalingType is missing from scalingQuality.`);
      }

      if (!Number.isFinite(item.floorMin) || item.floorMin < 1) {
        addError(`${itemTag}.floorMin must be >= 1.`);
      }

      if (item.slot === "weapon") {
        if (!item.weaponClass) {
          addError(`${itemTag}.weaponClass is required for weapon slot.`);
        } else if (!Object.prototype.hasOwnProperty.call(safeWeaponProfiles, item.weaponClass)) {
          addError(`${itemTag}.weaponClass is not in weaponProfiles.`);
        }

        if (!Number.isFinite(item.skillReq) || item.skillReq < 1) {
          addError(`${itemTag}.skillReq must be >= 1 for weapon slot.`);
        }
      } else if (!Number.isFinite(item.levelReq) || item.levelReq < 1) {
        addError(`${itemTag}.levelReq must be >= 1 for non-weapon slot.`);
      }

      if (LEVEL_SCALING_TYPES.includes(item.scalingType)) {
        if (!Number.isFinite(item.levelReq) || item.levelReq < 1) {
          addError(`${itemTag}.levelReq must be >= 1 for level scaling items.`);
        }
        if (Number.isFinite(item.levelReqMax) && Number.isFinite(item.levelReq) && item.levelReqMax < item.levelReq) {
          addError(`${itemTag}.levelReqMax cannot be lower than levelReq.`);
        }
      }

      if (SKILL_SCALING_TYPES.includes(item.scalingType)) {
        if (!Number.isFinite(item.skillReq) || item.skillReq < 1) {
          addError(`${itemTag}.skillReq must be >= 1 for skill scaling items.`);
        }
        if (Number.isFinite(item.skillReqMax) && Number.isFinite(item.skillReq) && item.skillReqMax < item.skillReq) {
          addError(`${itemTag}.skillReqMax cannot be lower than skillReq.`);
        }
      }

      [
        ["attackMin", "attackMax"],
        ["defenseMin", "defenseMax"],
        ["dexterityMin", "dexterityMax"],
      ].forEach(([minKey, maxKey]) => {
        const minValue = item[minKey];
        const maxValue = item[maxKey];
        const hasMin = Number.isFinite(minValue);
        const hasMax = Number.isFinite(maxValue);

        if (hasMin !== hasMax) {
          addWarning(`${itemTag} should define both ${minKey} and ${maxKey} together.`);
          return;
        }

        if (hasMin && hasMax && maxValue < minValue) {
          addError(`${itemTag}.${maxKey} cannot be lower than ${minKey}.`);
        }
      });

      const hasDirectStat = ["attack", "defense", "dexterity"].some((key) => Number.isFinite(item[key]));
      const hasRangeStat = [
        ["attackMin", "attackMax"],
        ["defenseMin", "defenseMax"],
        ["dexterityMin", "dexterityMax"],
      ].some(([minKey, maxKey]) => Number.isFinite(item[minKey]) && Number.isFinite(item[maxKey]));

      if (item.exactStats === true && !hasDirectStat && !hasRangeStat) {
        addError(`${itemTag} is exactStats=true but has no stat values.`);
      }

      if (typeof item.exactStats !== "undefined" && typeof item.exactStats !== "boolean") {
        addError(`${itemTag}.exactStats must be boolean when present.`);
      }
    });

    const exactCount = dataset.itemCatalog.filter((item) => item?.exactStats === true).length;
    const nonExactCount = dataset.itemCatalog.length - exactCount;

    if (nonExactCount > 0) {
      addWarning(`${nonExactCount} catalog entr${nonExactCount === 1 ? "y is" : "ies are"} still estimated.`);
    }

    return {
      errors,
      warnings,
      summary: {
        itemCount: dataset.itemCatalog.length,
        exactCount,
        nonExactCount,
      },
    };
  }

  function computeRequirementFit(item, projectedLevel, weaponSkill) {
    if (item.slot === "weapon") {
      const availableSkill = Math.max(1, Number(weaponSkill) || 1);
      const minReq = Math.max(1, Number(item.skillReq) || 1);
      const maxReq = Number.isFinite(item.skillReqMax) ? Math.max(minReq, Number(item.skillReqMax)) : minReq;
      const minGapRatio = clamp((availableSkill - minReq) / Math.max(18, availableSkill * 0.55), 0, 1);
      const maxOvershootRatio = clamp((availableSkill - maxReq) / Math.max(28, availableSkill * 0.65), 0, 1);
      const fit = 1.12 - minGapRatio * 0.2 - maxOvershootRatio * 0.06;
      return clamp(fit, 0.84, 1.13);
    }

    const availableLevel = Math.max(1, Number(projectedLevel) || 1);
    const minReq = Math.max(1, Number(item.levelReq) || 1);
    const maxReq = Number.isFinite(item.levelReqMax) ? Math.max(minReq, Number(item.levelReqMax)) : minReq;
    const minGapRatio = clamp((availableLevel - minReq) / Math.max(8, availableLevel * 0.42), 0, 1);
    const maxOvershootRatio = clamp((availableLevel - maxReq) / Math.max(14, availableLevel * 0.52), 0, 1);
    const fit = 1.11 - minGapRatio * 0.22 - maxOvershootRatio * 0.07;
    return clamp(fit, 0.82, 1.12);
  }

  function computeValueEfficiency(item, projectedLevel, sourceQ, style) {
    const floor = Math.max(1, Number(item.floorMin) || 1);
    const value = Math.max(1, Number(item.colValue) || 1);
    const expectedValue = Math.max(200, (floor * floor * 420 + projectedLevel * 24) * Math.max(0.9, sourceQ));
    const ratio = clamp(expectedValue / value, 0.45, 2.4);
    const baseEfficiency = clamp(Math.pow(ratio, 0.19), 0.88, 1.16);
    const costSensitivity = clamp(0.58 + style.weights.farming * 0.26 + style.weights.survival * 0.12 - style.weights.damage * 0.16, 0.45, 0.95);

    return 1 + (baseEfficiency - 1) * costSensitivity;
  }

  function computeBudgetFit(item, budgetCap, strictBudgetCap, style) {
    if (!Number.isFinite(budgetCap) || budgetCap <= 0) {
      return { budgetFit: 1, overBudget: false };
    }

    const value = Math.max(0, Number(item.colValue) || 0);
    if (value <= 0) {
      return { budgetFit: 1, overBudget: false };
    }

    const budgetSensitivity = clamp(
      0.5 + style.weights.farming * 0.3 + style.weights.survival * 0.12 - style.weights.damage * 0.14,
      0.35,
      0.95,
    );
    const overBudget = value > budgetCap;

    if (overBudget) {
      const overRatio = clamp((value - budgetCap) / Math.max(1, budgetCap), 0, 2.2);
      const hardPenalty = strictBudgetCap ? 0.22 : 0;
      const budgetFit = clamp(1 - overRatio * (0.26 + budgetSensitivity * 0.28) - hardPenalty, 0.45, 1);
      return { budgetFit, overBudget: true };
    }

    const underRatio = clamp((budgetCap - value) / Math.max(1, budgetCap), 0, 1);
    const budgetFit = clamp(1 + underRatio * (0.04 + budgetSensitivity * 0.08), 1, 1.14);
    return { budgetFit, overBudget: false };
  }

  function handleApplyCalibrationSample() {
    const observed = collectObservedCalibrationValues();
    const missingRequired = CALIBRATION_METRICS.filter((metric) => {
      return metric.required && !Number.isFinite(observed[metric.key]);
    });

    if (missingRequired.length > 0) {
      showCalibrationMessage(
        `Missing required observed values: ${missingRequired.map((metric) => metric.label).join(", ")}.`,
        "error",
      );
      return;
    }

    const input = getFormInput();
    const planResult = buildLevelPlan(input);
    const predictedRaw = planResult.finalEval.rawMetrics || planResult.finalEval.metrics;

    const nextFactors = { ...calibrationState.factors };
    const sampleMetrics = [];

    CALIBRATION_METRICS.forEach((metric) => {
      const observedValue = observed[metric.key];
      if (!Number.isFinite(observedValue) || observedValue < 0) {
        return;
      }

      const predictedValue = Number(predictedRaw[metric.key]);
      if (!Number.isFinite(predictedValue) || predictedValue <= 0) {
        return;
      }

      const ratio = clamp(observedValue / predictedValue, CALIBRATION_RATIO_MIN, CALIBRATION_RATIO_MAX);
      const currentFactor = Number(nextFactors[metric.key]) || 1;
      const blendedFactor =
        (currentFactor * calibrationState.sampleCount + ratio) / (calibrationState.sampleCount + 1);
      nextFactors[metric.key] = clamp(blendedFactor, CALIBRATION_FACTOR_MIN, CALIBRATION_FACTOR_MAX);

      sampleMetrics.push({
        key: metric.key,
        label: metric.label,
        observed: observedValue,
        predictedRaw: predictedValue,
        ratio,
        errorPct: ((observedValue - predictedValue) / predictedValue) * 100,
      });
    });

    if (!sampleMetrics.length) {
      showCalibrationMessage("No valid calibration metrics were detected in your sample.", "error");
      return;
    }

    const sampleCount = calibrationState.sampleCount + 1;
    const capturedAt = new Date().toISOString();
    calibrationState = {
      sampleCount,
      factors: nextFactors,
      updatedAt: capturedAt,
      lastSample: {
        capturedAt,
        projectedLevel: input.currentLevel + input.levelsToPlan,
        metrics: sampleMetrics,
      },
    };

    writeCalibrationStorage(calibrationState);
    showCalibrationMessage(`Applied calibration sample #${sampleCount}.`, "success");
    onSubmit(new Event("submit"));
  }

  function handleResetCalibration() {
    calibrationState = createDefaultCalibrationState();
    writeCalibrationStorage(calibrationState);

    CALIBRATION_METRICS.forEach((metric) => {
      const input = calibrationInputs[metric.key];
      if (input) {
        input.value = "";
      }
    });

    showCalibrationMessage("Calibration reset to neutral multipliers (x1.0).", "success");
    onSubmit(new Event("submit"));
  }

  function handleExportCalibration() {
    const payload = {
      schemaVersion: CALIBRATION_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      calibration: calibrationState,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "sbo-rebirth-calibration.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    showCalibrationMessage("Exported calibration JSON.", "success");
  }

  async function handleImportCalibration(event) {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const candidate = parsed?.calibration && typeof parsed.calibration === "object" ? parsed.calibration : parsed;
      const normalized = normalizeCalibrationState(candidate);

      if (!normalized) {
        throw new Error("Invalid calibration payload.");
      }

      calibrationState = normalized;
      writeCalibrationStorage(calibrationState);
      showCalibrationMessage(`Imported calibration from \"${file.name}\".`, "success");
      onSubmit(new Event("submit"));
    } catch (error) {
      showCalibrationMessage(`Calibration import failed: ${error.message || "invalid file"}`, "error");
    } finally {
      if (importCalibrationInput) {
        importCalibrationInput.value = "";
      }
    }
  }

  function collectObservedCalibrationValues() {
    const values = {};

    CALIBRATION_METRICS.forEach((metric) => {
      const input = calibrationInputs[metric.key];
      values[metric.key] = parseOptionalNumber(input ? input.value : "");
    });

    return values;
  }

  function renderCalibrationReport(state, finalEval = null) {
    if (!calibrationReport) return;

    const sampleCount = state?.sampleCount || 0;
    const factors = state?.factors || DEFAULT_CALIBRATION_FACTORS;

    const factorRows = CALIBRATION_METRICS.map((metric) => {
      const factor = Number(factors[metric.key]) || 1;
      return `
        <li>
          <span>${escapeHtml(metric.label)}</span>
          <strong>x${round(factor, 3)}</strong>
        </li>
      `;
    }).join("");

    const sampleRows =
      state?.lastSample?.metrics && state.lastSample.metrics.length
        ? state.lastSample.metrics
            .map((entry) => {
              return `
                <li>
                  <strong>${escapeHtml(entry.label)}</strong>
                  observed ${round(entry.observed, 2)} vs raw ${round(entry.predictedRaw, 2)}
                  (${numericDelta(0, entry.errorPct, 2)}%)
                </li>
              `;
            })
            .join("")
        : `<li>No samples captured yet.</li>`;

    const currentPreviewRows =
      finalEval?.rawMetrics && finalEval?.metrics
        ? CALIBRATION_METRICS.map((metric) => {
            const rawValue = Number(finalEval.rawMetrics[metric.key]) || 0;
            const calibratedValue = Number(finalEval.metrics[metric.key]) || 0;
            const deltaPct = rawValue > 0 ? ((calibratedValue - rawValue) / rawValue) * 100 : 0;
            return `
              <li>
                <strong>${escapeHtml(metric.label)}</strong>
                raw ${round(rawValue, 2)} -> calibrated ${round(calibratedValue, 2)}
                (${numericDelta(0, deltaPct, 2)}%)
              </li>
            `;
          }).join("")
        : "";

    calibrationReport.innerHTML = `
      <div class="calibration-summary">
        <p>
          <strong>Calibration samples:</strong>
          ${sampleCount}
        </p>
        <p>
          <strong>Status:</strong>
          ${escapeHtml(describeCalibrationState(calibrationState))}
        </p>
      </div>

      <div class="calibration-report-grid">
        <article>
          <h4>Current Multipliers</h4>
          <ul class="calibration-report-list">
            ${factorRows}
          </ul>
        </article>

        <article>
          <h4>Last Sample</h4>
          <ul class="calibration-report-list">
            ${sampleRows}
          </ul>
        </article>

        ${
          currentPreviewRows
            ? `<article>
                <h4>Current Build Preview</h4>
                <ul class="calibration-report-list">
                  ${currentPreviewRows}
                </ul>
              </article>`
            : ""
        }
      </div>
    `;
  }

  function handleCompareBuilds() {
    const nameA = compareBuildASelect ? String(compareBuildASelect.value || "") : "";
    const nameB = compareBuildBSelect ? String(compareBuildBSelect.value || "") : "";

    if (!nameA || !nameB) {
      showCompareMessage("Select both Build A and Build B before comparing.", "error");
      return;
    }

    if (nameA === nameB) {
      showCompareMessage("Pick two different builds for comparison.", "error");
      return;
    }

    const storage = readBuildStorage();
    const recordA = storage[nameA];
    const recordB = storage[nameB];

    if (!recordA?.form || !recordB?.form) {
      showCompareMessage("One of the selected builds could not be loaded.", "error");
      return;
    }

    const summaryA = evaluateSavedBuild(recordA.form);
    const summaryB = evaluateSavedBuild(recordB.form);

    renderBuildComparison(nameA, summaryA, nameB, summaryB);
    showCompareMessage(`Compared \"${nameA}\" vs \"${nameB}\".`, "success");
  }

  function handleSaveBuild() {
    const storage = readBuildStorage();
    const name = getSelectedOrTypedPresetName();

    if (!name) {
      showBuildActionMessage("Enter a preset name before saving.", "error");
      return;
    }

    storage[name] = {
      name,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      form: collectFormSnapshot(),
    };

    writeBuildStorage(storage);
    refreshSavedBuildOptions(name);
    showBuildActionMessage(`Saved preset \"${name}\".`, "success");
  }

  function handleLoadBuild() {
    const selectedName = savedBuildSelect ? String(savedBuildSelect.value || "") : "";
    if (!selectedName) {
      showBuildActionMessage("Select a saved preset to load.", "error");
      return;
    }

    const storage = readBuildStorage();
    const record = storage[selectedName];
    if (!record || !record.form) {
      showBuildActionMessage("Could not find preset data.", "error");
      return;
    }

    applyFormSnapshot(record.form);
    if (presetNameInput) presetNameInput.value = selectedName;

    showBuildActionMessage(`Loaded preset \"${selectedName}\".`, "success");
    onSubmit(new Event("submit"));
  }

  function handleDeleteBuild() {
    const selectedName = savedBuildSelect ? String(savedBuildSelect.value || "") : "";
    if (!selectedName) {
      showBuildActionMessage("Select a saved preset to delete.", "error");
      return;
    }

    const storage = readBuildStorage();
    if (!storage[selectedName]) {
      showBuildActionMessage("Preset no longer exists.", "error");
      refreshSavedBuildOptions();
      return;
    }

    delete storage[selectedName];
    if (pinnedPresetNames.has(selectedName)) {
      pinnedPresetNames.delete(selectedName);
      writePinnedPresetStorage(pinnedPresetNames);
    }
    writeBuildStorage(storage);
    refreshSavedBuildOptions();
    showBuildActionMessage(`Deleted preset "${selectedName}".`, "success");
  }

  function handleExportBuild() {
    const payload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      presetName: getSelectedOrTypedPresetName(),
      form: collectFormSnapshot(),
    };

    const suggestedName = slugify(payload.presetName || "sbo-rebirth-build");
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${suggestedName}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    showBuildActionMessage("Exported build JSON.", "success");
  }

  async function handleImportBuild(event) {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const snapshot = parsed?.form;

      if (!snapshot || typeof snapshot !== "object") {
        throw new Error("Missing form payload in imported file.");
      }

      applyFormSnapshot(snapshot);
      if (presetNameInput && parsed?.presetName) {
        presetNameInput.value = `${parsed.presetName}`;
      }

      showBuildActionMessage(`Imported build from \"${file.name}\".`, "success");
      onSubmit(new Event("submit"));
    } catch (error) {
      showBuildActionMessage(`Import failed: ${error.message || "invalid file"}`, "error");
    } finally {
      if (importBuildInput) {
        importBuildInput.value = "";
      }
    }
  }

  function getFormInput() {
    const formData = new FormData(form);
    const ownedItemsRaw = String(formData.get("ownedItems") || "");
    const ownedItemTokens = parseOwnedTokens(ownedItemsRaw);
    const onlyOwnedRequested = formData.has("onlyOwned");
    const budgetCapRaw = parseOptionalNumber(formData.get("budgetCap"));
    const budgetCap = Number.isFinite(budgetCapRaw) && budgetCapRaw >= 0 ? budgetCapRaw : null;
    const strictBudgetCap = formData.has("strictBudgetCap");
    const avoidItemsRaw = String(formData.get("avoidItems") || "");
    const avoidItemTokens = parseOwnedTokens(avoidItemsRaw);
    const minDpsFloorRaw = parseOptionalNumber(formData.get("minDpsFloor"));
    const minDamageReductionFloorRaw = parseOptionalNumber(formData.get("minDamageReductionFloor"));
    const minBonusHpFloorRaw = parseOptionalNumber(formData.get("minBonusHpFloor"));
    const minDpsFloor = Number.isFinite(minDpsFloorRaw) && minDpsFloorRaw >= 0 ? minDpsFloorRaw : null;
    const minDamageReductionFloor =
      Number.isFinite(minDamageReductionFloorRaw) && minDamageReductionFloorRaw >= 0 ? minDamageReductionFloorRaw : null;
    const minBonusHpFloor = Number.isFinite(minBonusHpFloorRaw) && minBonusHpFloorRaw >= 0 ? minBonusHpFloorRaw : null;

    const input = {
      currentLevel: toInt(formData.get("currentLevel"), 8),
      levelsToPlan: toInt(formData.get("levelsToPlan"), 40),
      maxFloorReached: toInt(formData.get("maxFloorReached"), 2),
      weaponClass: String(formData.get("weaponClass") || "two-handed"),
      playstyle: String(formData.get("playstyle") || "balanced"),
      allocationMode: normalizeAllocationMode(formData.get("allocationMode"), "adaptive"),
      weaponSkill: toInt(formData.get("weaponSkill"), 25),
      itemPoolMode: String(formData.get("itemPoolMode") || "standard"),
      dataQualityMode: normalizeDataQualityMode(formData.get("dataQualityMode"), "exact-only"),
      ownership: {
        rawInput: ownedItemsRaw,
        tokens: ownedItemTokens,
        onlyOwnedRequested,
        onlyOwned: onlyOwnedRequested && ownedItemTokens.size > 0,
      },
      optimization: {
        budgetCap,
        strictBudgetCap,
        avoidItemsRaw,
        avoidTokens: avoidItemTokens,
        minDpsFloor,
        minDamageReductionFloor,
        minBonusHpFloor,
      },
      stats: {
        str: toInt(formData.get("str"), 14),
        def: toInt(formData.get("def"), 0),
        agi: toInt(formData.get("agi"), 3),
        vit: toInt(formData.get("vit"), 7),
        luk: toInt(formData.get("luk"), 0),
      },
      gear: {
        attack: Math.max(1, toNumber(formData.get("gearAttack"), 30)),
        defense: Math.max(0, toNumber(formData.get("gearDefense"), 35)),
        dexterity: Math.max(0, toNumber(formData.get("gearDexterity"), 140)),
      },
    };

    // Guardrails
    input.currentLevel = clamp(input.currentLevel, 1, 1000);
    input.levelsToPlan = clamp(input.levelsToPlan, 1, 200);
    input.maxFloorReached = clamp(input.maxFloorReached, 1, MAX_CATALOG_FLOOR);
    input.weaponSkill = clamp(input.weaponSkill, 1, 10000);
    input.allocationMode = normalizeAllocationMode(input.allocationMode, "adaptive");
    input.dataQualityMode = normalizeDataQualityMode(input.dataQualityMode, "exact-only");
    STAT_KEYS.forEach((stat) => {
      input.stats[stat] = clamp(input.stats[stat], 0, data.statCap);
    });

    return input;
  }

  function buildLevelPlan(input) {
    const rows = [];
    const currentStats = { ...input.stats };
    const totalPointsBudget = input.levelsToPlan * data.pointsPerLevel;
    const allocationContext = createAllocationContext(input);
    const evaluationCache = new Map();

    const initialEval = evaluateBuildCached(currentStats, input, input.currentLevel, evaluationCache);

    for (let step = 1; step <= input.levelsToPlan; step += 1) {
      const level = input.currentLevel + step;
      const added = emptyStatBlock();
      const decisionLog = [];

      for (let p = 0; p < data.pointsPerLevel; p += 1) {
        const pointsSpent = (step - 1) * data.pointsPerLevel + p;
        const choice = chooseBestStat(
          currentStats,
          added,
          input,
          level,
          pointsSpent,
          totalPointsBudget,
          allocationContext,
          evaluationCache,
        );
        currentStats[choice.stat] += 1;
        added[choice.stat] += 1;
        decisionLog.push(choice.reason);
      }

      const prevStats = step === 1 ? input.stats : rows[rows.length - 1].totals;
      const prevLevel = level - 1;
      const breakpoints = detectBreakpoints(prevStats, currentStats, level, input);
      const itemUnlocks = detectItemUnlocks(prevLevel, level, input);

      rows.push({
        level,
        added,
        totals: { ...currentStats },
        reason: compactReasons(decisionLog, added),
        breakpoints: [...breakpoints, ...itemUnlocks],
      });
    }

    const finalEval = evaluateBuildCached(currentStats, input, input.currentLevel + input.levelsToPlan, evaluationCache);

    return {
      rows,
      initialStats: { ...input.stats },
      finalStats: { ...currentStats },
      initialEval,
      finalEval,
    };
  }

  function detectItemUnlocks(prevLevel, level, input) {
    const slots = getRecommendedSlots(input.weaponClass);
    const annotations = [];

    data.itemCatalog.forEach((item) => {
      if (!slots.includes(item.slot)) return;
      if ((item.floorMin || 1) > input.maxFloorReached) return;
      if (input.itemPoolMode === "standard" && ["badge", "gamepass", "event"].includes(item.sourceType)) return;
      if (input.dataQualityMode === "exact-only" && item.exactStats !== true) return;
      if (item.slot === "weapon" && !isWeaponClassCompatible(item.weaponClass, input.weaponClass)) return;

      const slotLabel = getSlotLabel(item.slot);

      if (item.slot === "weapon") {
        // Weapons gate on skillReq (static user input), not levelReq.
        // Annotate on the first level of the plan if the item is within skill range.
        const skillReq = item.skillReq || 1;
        const skillReqMax = item.skillReqMax || Infinity;
        const userSkill = input.weaponSkill || 1;
        if (prevLevel === input.currentLevel && userSkill >= skillReq && userSkill <= skillReqMax) {
          annotations.push(`Available weapon: ${item.name} (skill ${skillReq}${skillReqMax < Infinity ? `–${skillReqMax}` : "+"})`);
        }
      } else {
        // Armor/headwear/shield gate on levelReq.
        const req = item.levelReq || 1;
        if (req > prevLevel && req <= level) {
          annotations.push(`Unlocks: ${item.name} (${slotLabel})`);
        }
      }
    });

    return annotations;
  }

  function detectBreakpoints(prevStats, nextStats, level, input) {
    const formulas = data.formulas;
    const profile = data.weaponProfiles[input.weaponClass] || data.weaponProfiles["two-handed"];
    const annotations = [];

    // Sword skill unlocks: on the first plan row, list all skills the user already has unlocked
    const skillUnlocks = (data.swordSkillUnlocks || {})[input.weaponClass] || [];
    const ws = input.weaponSkill || 1;
    if (level === input.currentLevel + 1) {
      skillUnlocks.forEach(({ skill, name }) => {
        if (ws >= skill) {
          annotations.push(`Skill ${skill}: ${name} unlocked`);
        }
      });
    }

    // Crit cap: LUK crit bonus caps at 5% (500 LUK * 0.01% = 5%)
    const critCapLuk = Math.ceil(5 / formulas.lukCritChancePerPointPct);
    if (prevStats.luk < critCapLuk && nextStats.luk >= critCapLuk) {
      annotations.push("LUK crit cap reached (max +5% crit)");
    }

    // Drop bonus cap: LUK drop caps at 5%
    const dropCapLuk = Math.ceil(5 / formulas.lukDropChancePerPointPct);
    if (prevStats.luk < dropCapLuk && nextStats.luk >= dropCapLuk) {
      annotations.push("LUK drop bonus cap reached (max +5%)");
    }

    // AGI speed tiers: 25%, 50%, 75% of max gain
    const agiTiers = [0.25, 0.5, 0.75];
    agiTiers.forEach((frac) => {
      const threshold = Math.floor(data.statCap * frac);
      const gainAtThreshold = Math.round(profile.maxAgiSpeedGain * frac * 100);
      if (prevStats.agi < threshold && nextStats.agi >= threshold) {
        annotations.push(`AGI ${Math.round(frac * 100)}% speed milestone (+${gainAtThreshold}% atk speed)`);
      }
    });

    // DEF multiplier milestones: every 100 DEF adds +1.0 to the multiplier (×6 → ×7 → ×8 → ×9 → ×10)
    const defMultBase = formulas.defMultiplierBase || 5;
    const defMultPerPt = formulas.defMultiplierPerPoint || 0.01;
    [100, 200, 300, 400, 500].forEach((band) => {
      if (prevStats.def < band && nextStats.def >= band) {
        const mult = round(defMultBase + band * defMultPerPt, 1);
        annotations.push(`DEF ${band}: DR multiplier now ×${mult} (double at 500)`);
      }
    });

    // Stamina bands: staminaPool = 100 + level*5 + 0.1*(str+agi+vit)
    const staminaBands = [300, 400, 500, 600];
    const prevStamina = 100 + level * 5 + 0.1 * (prevStats.str + prevStats.agi + prevStats.vit);
    const nextStamina = 100 + level * 5 + 0.1 * (nextStats.str + nextStats.agi + nextStats.vit);
    staminaBands.forEach((band) => {
      if (prevStamina < band && nextStamina >= band) {
        annotations.push(`Stamina ${band} threshold crossed`);
      }
    });

    // Multi-hit: base 50%, STR adds up to +10%, LUK adds up to +10%, combined bonus capped at +15% → total 65%
    const calcMultiHitBonus = (s) => Math.min(15, Math.min(10, s.str * 0.02) + Math.min(10, s.luk * 0.02));
    const prevMultiHitBonus = calcMultiHitBonus(prevStats);
    const nextMultiHitBonus = calcMultiHitBonus(nextStats);
    if (prevMultiHitBonus < 15 && nextMultiHitBonus >= 15) {
      annotations.push("Multi-hit bonus cap reached (65% total)");
    }
    // Intermediate milestone: +10% bonus (60% total)
    if (prevMultiHitBonus < 10 && nextMultiHitBonus >= 10) {
      annotations.push("Multi-hit +10% bonus milestone (60% total)");
    }

    // Debuff resistance cap: 0.01*vit caps at 5%
    const debuffCapVit = Math.ceil(5 / 0.01);
    if (prevStats.vit < debuffCapVit && nextStats.vit >= debuffCapVit) {
      annotations.push("VIT debuff resistance cap reached (+5%)");
    }

    // STR damage bonus milestones: +0.4%/pt, notable at +50%, +100%, +150%, +200%
    const strDmgMilestones = [50, 100, 150, 200];
    strDmgMilestones.forEach((bonusPct) => {
      const threshold = Math.round(bonusPct / formulas.strDamagePerPointPct);
      if (prevStats.str < threshold && nextStats.str >= threshold) {
        annotations.push(`STR +${bonusPct}% damage bonus (${threshold} pts)`);
      }
    });

    // VIT dex multiplier milestone: halfway to max (VIT 250 = multiplier 12.5x vs base 10x)
    const vitHalfCap = Math.floor(data.statCap / 2);
    if (prevStats.vit < vitHalfCap && nextStats.vit >= vitHalfCap) {
      const halfMult = (formulas.vitDexterityMultiplierBase || 10) + vitHalfCap * formulas.vitDexterityMultiplierPerPoint;
      annotations.push(`VIT 50% milestone (DEX multiplier ${round(halfMult, 2)}x)`);
    }

    return annotations;
  }

  function chooseBestStat(currentStats, addedThisLevel, input, level, pointsSpent, totalPointsBudget, allocationContext, evaluationCache) {
    let best = { stat: "str", gain: Number.NEGATIVE_INFINITY, reason: "Score-optimized split." };

    const baselineEval = evaluateBuildCached(currentStats, input, level, evaluationCache);

    STAT_KEYS.forEach((stat) => {
      if (currentStats[stat] >= data.statCap) {
        return;
      }

      const nextStats = { ...currentStats, [stat]: currentStats[stat] + 1 };
      const candidateEval = evaluateBuildCached(nextStats, input, level, evaluationCache);
      const immediateGain = candidateEval.score - baselineEval.score;
      const allocationSignal = getAllocationSignal(stat, nextStats, level, input, allocationContext);
      const followUpGain = estimateFollowUpGain(
        nextStats,
        candidateEval.score,
        input,
        level,
        pointsSpent,
        totalPointsBudget,
        allocationContext,
        evaluationCache,
      );

      const tuning = allocationContext.tuning;

      let gain = immediateGain + allocationSignal.nudge + followUpGain * tuning.lookaheadWeight;

      if (addedThisLevel[stat] >= 2) {
        gain -= tuning.spreadPenalty;
      }

      if (gain > best.gain) {
        best = {
          stat,
          gain,
          reason: describeAllocationReason(stat, input, allocationSignal, followUpGain),
        };
      }
    });

    return best;
  }

  function estimateFollowUpGain(
    nextStats,
    baselineScore,
    input,
    level,
    pointsSpent,
    totalPointsBudget,
    allocationContext,
    evaluationCache,
  ) {
    let bestGain = 0;

    STAT_KEYS.forEach((nextStat) => {
      if (nextStats[nextStat] >= data.statCap) {
        return;
      }

      const followUpStats = { ...nextStats, [nextStat]: nextStats[nextStat] + 1 };
      const followUpEval = evaluateBuildCached(followUpStats, input, level, evaluationCache);
      const immediateGain = followUpEval.score - baselineScore;
      const allocationSignal = getAllocationSignal(
        nextStat,
        followUpStats,
        level,
        input,
        allocationContext,
      );

      const totalGain = immediateGain + allocationSignal.nudge;
      if (totalGain > bestGain) {
        bestGain = totalGain;
      }
    });

    return Math.max(0, bestGain);
  }

  function getAllocationSignal(stat, statsAfterPoint, level, input, allocationContext) {
    const targetShare = allocationContext.targetShares[stat] || 0;
    const totalStats = Math.max(1, sumStats(statsAfterPoint));
    const actualShare = statsAfterPoint[stat] / totalStats;
    const shareDelta = targetShare - actualShare;
    const targetLevel = input.currentLevel + input.levelsToPlan;
    const progress = targetLevel > 0 ? clamp(level / targetLevel, 0, 1) : 0;
    const tuning = allocationContext.tuning;

    let nudge = shareDelta * tuning.shareNudgeWeight * (0.75 + progress * 0.7);
    if (shareDelta < 0) {
      nudge *= 0.82;
    }

    return {
      nudge,
      shareDelta,
      targetShare,
      actualShare,
    };
  }

  function createAllocationContext(input) {
    const profile = data.weaponProfiles[input.weaponClass] || data.weaponProfiles["two-handed"];
    const style = data.playstyles[input.playstyle] || data.playstyles.balanced;
    const allocationMode = normalizeAllocationMode(input.allocationMode, "adaptive");

    const rawWeights = {
      str: (profile.statBias.str || 0.2) * (0.92 + style.weights.damage * 1.15),
      def: (profile.statBias.def || 0.2) * (0.72 + style.weights.survival * 1.08),
      agi: (profile.statBias.agi || 0.2) * (0.74 + style.weights.mobility * 1.02 + style.weights.damage * 0.2),
      vit: (profile.statBias.vit || 0.2) * (0.8 + style.weights.survival * 1.02),
      luk: (profile.statBias.luk || 0.2) * (0.55 + style.weights.farming * 1.18 + style.weights.damage * 0.08),
    };

    if (input.weaponClass === "two-handed") {
      rawWeights.str += 0.35;
    }

    if (["dual-wield", "rapier", "dagger"].includes(input.weaponClass)) {
      rawWeights.agi += 0.16;
    }

    if (input.playstyle === "damage") {
      rawWeights.str += 0.22;
      rawWeights.agi += 0.08;
    }

    if (input.playstyle === "survivability") {
      rawWeights.def += 0.18;
      rawWeights.vit += 0.22;
    }

    if (input.playstyle === "farming") {
      rawWeights.agi += 0.14;
      rawWeights.luk += 0.25;
    }

    if (allocationMode === "aggressive") {
      rawWeights.str += 0.28;
      rawWeights.agi += 0.1;
      rawWeights.def *= 0.88;
      rawWeights.vit *= 0.9;
    }

    if (allocationMode === "defensive") {
      rawWeights.def += 0.24;
      rawWeights.vit += 0.26;
      rawWeights.agi += 0.05;
      rawWeights.str *= 0.92;
    }

    if (allocationMode === "tempo") {
      rawWeights.agi += 0.3;
      rawWeights.luk += 0.2;
      rawWeights.str *= 0.9;
    }

    return {
      mode: allocationMode,
      tuning: getAllocationTuning(allocationMode),
      targetShares: normalizeStatWeightMap(rawWeights, MIN_ALLOCATION_SHARE),
    };
  }

  function getAllocationTuning(mode) {
    const presets = {
      adaptive: {
        lookaheadWeight: ALLOCATION_LOOKAHEAD_WEIGHT,
        shareNudgeWeight: ALLOCATION_SHARE_NUDGE_WEIGHT,
        spreadPenalty: ALLOCATION_SPREAD_PENALTY,
      },
      aggressive: {
        lookaheadWeight: 0.46,
        shareNudgeWeight: 0.062,
        spreadPenalty: 0.001,
      },
      defensive: {
        lookaheadWeight: 0.34,
        shareNudgeWeight: 0.108,
        spreadPenalty: 0.0024,
      },
      tempo: {
        lookaheadWeight: 0.42,
        shareNudgeWeight: 0.092,
        spreadPenalty: 0.0013,
      },
    };

    return presets[mode] || presets.adaptive;
  }

  function normalizeStatWeightMap(weightMap, minShare = 0) {
    const normalized = {};
    let total = 0;

    STAT_KEYS.forEach((stat) => {
      const value = Math.max(0, Number(weightMap?.[stat]) || 0);
      normalized[stat] = value;
      total += value;
    });

    if (total <= 0) {
      const equalShare = 1 / STAT_KEYS.length;
      STAT_KEYS.forEach((stat) => {
        normalized[stat] = equalShare;
      });
      return normalized;
    }

    STAT_KEYS.forEach((stat) => {
      normalized[stat] /= total;
    });

    const floorShare = clamp(minShare, 0, 1 / STAT_KEYS.length);
    if (floorShare <= 0) {
      return normalized;
    }

    let floorDeficit = 0;

    STAT_KEYS.forEach((stat) => {
      if (normalized[stat] >= floorShare) return;
      floorDeficit += floorShare - normalized[stat];
      normalized[stat] = floorShare;
    });

    if (floorDeficit > 0) {
      const donors = STAT_KEYS.filter((stat) => normalized[stat] > floorShare);
      const donorCapacity = donors.reduce((sum, stat) => sum + (normalized[stat] - floorShare), 0);

      if (donorCapacity > 0) {
        donors.forEach((stat) => {
          const capacity = normalized[stat] - floorShare;
          const taken = (capacity / donorCapacity) * floorDeficit;
          normalized[stat] = Math.max(floorShare, normalized[stat] - taken);
        });
      }
    }

    const finalTotal = STAT_KEYS.reduce((sum, stat) => sum + normalized[stat], 0);
    if (finalTotal > 0) {
      STAT_KEYS.forEach((stat) => {
        normalized[stat] /= finalTotal;
      });
    }

    return normalized;
  }

  function describeAllocationReason(stat, input, allocationSignal, followUpGain) {
    const base = explainStatChoice(stat, input.weaponClass, input.playstyle);

    if (allocationSignal.shareDelta > 0.035) {
      return `${base} Pulling this stat closer to the target profile mix.`;
    }

    if (followUpGain > 0.0025) {
      return `${base} Creates a stronger next-point follow-up.`;
    }

    return base;
  }

  function sumStats(statBlock) {
    return STAT_KEYS.reduce((sum, stat) => sum + (Number(statBlock?.[stat]) || 0), 0);
  }

  function evaluateBuildCached(stats, input, projectedLevel, cache) {
    if (!(cache instanceof Map)) {
      return evaluateBuild(stats, input, projectedLevel);
    }

    const cacheKey = `${projectedLevel}|${stats.str},${stats.def},${stats.agi},${stats.vit},${stats.luk}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const result = evaluateBuild(stats, input, projectedLevel);
    cache.set(cacheKey, result);
    return result;
  }

  function evaluateBuild(stats, input, projectedLevel) {
    const formulas = data.formulas;
    const profile = data.weaponProfiles[input.weaponClass];
    const style = data.playstyles[input.playstyle];

    const strDamageMult = 1 + stats.str * (formulas.strDamagePerPointPct / 100);
    const agiSpeedMult = 1 + profile.maxAgiSpeedGain * (stats.agi / data.statCap);

    const baseCrit = formulas.baseCritChancePct / 100;
    const lukCritBonus = Math.min(0.05, stats.luk * (formulas.lukCritChancePerPointPct / 100));
    const critChance = baseCrit + lukCritBonus;

    // Wiki formula: critDmg = (base * critMulti) + (base * STRmulti), STRmulti = 0-2 based on STR
    const strCritMulti = (stats.str / data.statCap) * (formulas.strCritMultiMax || 2);
    const critExpectedMult = 1 + critChance * (profile.critMultiplier - 1) + critChance * strCritMulti;

    const dpsProjection = input.gear.attack * strDamageMult * agiSpeedMult * critExpectedMult;

    const defenseMultiplier = (formulas.defMultiplierBase || 5) + stats.def * formulas.defMultiplierPerPoint;
    const damageReduction = input.gear.defense * defenseMultiplier;

    const dexterityMultiplier = (formulas.vitDexterityMultiplierBase || 10) + stats.vit * formulas.vitDexterityMultiplierPerPoint;
    const bonusHp = input.gear.dexterity * dexterityMultiplier;

    const staminaPool = 100 + projectedLevel * 5 + 0.1 * (stats.str + stats.agi + stats.vit);

    const runSpeedDelta = stats.agi * formulas.agiRunSpeedPerPoint;
    const walkSpeedDelta = stats.agi * formulas.agiWalkSpeedPerPoint;

    const dropBonusPct = Math.min(5, stats.luk * formulas.lukDropChancePerPointPct);
    // Wiki: base 50% multi-hit, STR adds up to +10%, LUK adds up to +10%, combined cap +15% → total 65%
    const strMultiHit = Math.min(formulas.multiHitStatCapPct || 10, stats.str * (formulas.strMultiHitPerPointPct || 0.02));
    const lukMultiHit = Math.min(formulas.multiHitStatCapPct || 10, stats.luk * (formulas.lukMultiHitPerPointPct || 0.02));
    const combinedMultiHitBonus = Math.min(15, strMultiHit + lukMultiHit);
    const multiHitPct = (formulas.baseMultiHitPct || 50) + combinedMultiHitBonus;
    const debuffResPct = Math.min(5, 0.01 * stats.vit);

    const attackSpeedPct = agiSpeedMult * 100;

    const rawMetrics = {
      dpsProjection,
      damageReduction,
      bonusHp,
      staminaPool,
      critChancePct: critChance * 100,
      dropBonusPct,
      multiHitPct,
      debuffResPct,
      attackSpeedPct,
    };

    const metrics = applyCalibrationFactors(rawMetrics);

    // Normalize into planner-scale values.
    const normDamage = metrics.dpsProjection / 120;
    const normSurvival = metrics.damageReduction / 1500 + metrics.bonusHp / 12000 + metrics.debuffResPct / 5;
    const normMobility = runSpeedDelta / 10 + walkSpeedDelta / 2 + metrics.staminaPool / 500;
    const normFarming = metrics.dropBonusPct / 5 + (metrics.multiHitPct - 50) / 15;

    const weightedScore =
      style.weights.damage * normDamage +
      style.weights.survival * normSurvival +
      style.weights.mobility * normMobility +
      style.weights.farming * normFarming;

    const guardrail = computeGuardrailPenalty(metrics, input.optimization);

    return {
      score: weightedScore - guardrail.penalty,
      metrics,
      rawMetrics,
      guardrailPenalty: guardrail.penalty,
      guardrailViolations: guardrail.violations,
    };
  }

  function computeGuardrailPenalty(metrics, optimization) {
    const minimums = {
      dpsProjection: Number(optimization?.minDpsFloor),
      damageReduction: Number(optimization?.minDamageReductionFloor),
      bonusHp: Number(optimization?.minBonusHpFloor),
    };

    const weights = {
      dpsProjection: 0.42,
      damageReduction: 0.32,
      bonusHp: 0.26,
    };

    let penalty = 0;
    const violations = [];

    Object.entries(minimums).forEach(([metricKey, minimum]) => {
      if (!Number.isFinite(minimum) || minimum <= 0) {
        return;
      }

      const value = Number(metrics?.[metricKey]);
      if (!Number.isFinite(value) || value >= minimum) {
        return;
      }

      const shortfallRatio = clamp((minimum - value) / Math.max(1, minimum), 0, 2.5);
      penalty += shortfallRatio * (weights[metricKey] || 0.2);
      violations.push(metricKey);
    });

    return {
      penalty,
      violations,
    };
  }

  function applyCalibrationFactors(rawMetrics) {
    const factors = calibrationState?.factors || DEFAULT_CALIBRATION_FACTORS;

    return {
      ...rawMetrics,
      dpsProjection: rawMetrics.dpsProjection * getCalibrationFactor(factors.dpsProjection),
      damageReduction: rawMetrics.damageReduction * getCalibrationFactor(factors.damageReduction),
      bonusHp: rawMetrics.bonusHp * getCalibrationFactor(factors.bonusHp),
      staminaPool: rawMetrics.staminaPool * getCalibrationFactor(factors.staminaPool),
      critChancePct: rawMetrics.critChancePct * getCalibrationFactor(factors.critChancePct),
      dropBonusPct: rawMetrics.dropBonusPct * getCalibrationFactor(factors.dropBonusPct),
    };
  }

  function getCalibrationFactor(value) {
    if (!Number.isFinite(value)) return 1;
    return clamp(value, CALIBRATION_FACTOR_MIN, CALIBRATION_FACTOR_MAX);
  }

  function recommendGear(input, finalStats) {
    const projectedLevel = input.currentLevel + input.levelsToPlan;

    const eligible = data.itemCatalog.filter((item) => {
      if ((item.floorMin || 1) > input.maxFloorReached) {
        return false;
      }

      if (input.itemPoolMode === "standard" && ["badge", "gamepass", "event"].includes(item.sourceType)) {
        return false;
      }

      if (input.dataQualityMode === "exact-only" && item.exactStats !== true) {
        return false;
      }

      if (item.slot === "weapon") {
        if ((item.skillReq || 1) > input.weaponSkill) return false;
      } else if ((item.levelReq || 1) > projectedLevel) {
        return false;
      }

      if (input.ownership.onlyOwned && !isOwnedItem(item, input.ownership.tokens)) {
        return false;
      }

      if (input.optimization?.avoidTokens?.size && isAvoidedItem(item, input.optimization.avoidTokens)) {
        return false;
      }

      if (
        input.optimization?.strictBudgetCap &&
        Number.isFinite(input.optimization.budgetCap) &&
        Number(item.colValue) > input.optimization.budgetCap
      ) {
        return false;
      }

      if (item.slot === "weapon" && !isWeaponClassCompatible(item.weaponClass, input.weaponClass)) {
        return false;
      }

      return true;
    });

    const slots = getRecommendedSlots(input.weaponClass);

    const bySlot = {};

    slots.forEach((slot) => {
      const scored = eligible
        .filter((item) => item.slot === slot)
        .map((item) => ({
          item,
          score: scoreItem(item, input, finalStats),
        }))
        .sort((a, b) => {
          const sortMode = `${input.gearSortMode || "score"}`;
          const aVal = sortMode === "value" && (a.item.colValue || 0) > 0
            ? a.score.total / (a.item.colValue / 1000)
            : a.score.total;
          const bVal = sortMode === "value" && (b.item.colValue || 0) > 0
            ? b.score.total / (b.item.colValue / 1000)
            : b.score.total;
          const scoreDiff = bVal - aVal;
          if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
          const valDiff = (a.item.colValue || 0) - (b.item.colValue || 0);
          if (valDiff !== 0) return valDiff;
          return (a.item.id || "").localeCompare(b.item.id || "");
        })
        .slice(0, 5);

      bySlot[slot] = scored;
    });

    return bySlot;
  }

  function scoreItem(item, input, finalStats) {
    const sourceQ = data.sourceQuality[item.sourceType] || 1;
    const scalingQ = data.scalingQuality[item.scalingType || "fixed"] || 1;
    const style = data.playstyles[input.playstyle];

    const projectedLevel = input.currentLevel + input.levelsToPlan;
    const floorFit = 1 + clamp((projectedLevel - (item.floorMin || 1)) / 30, -0.4, 0.7);

    let scalingProgress = 1;

    if (item.scalingType === "level_1") {
      scalingProgress += projectedLevel * 0.003;
    } else if (item.scalingType === "level_5") {
      scalingProgress += Math.floor(projectedLevel / 5) * 0.007;
    } else if (item.scalingType === "skill_1") {
      scalingProgress += input.weaponSkill * 0.002;
    } else if (item.scalingType === "skill_5") {
      scalingProgress += Math.floor(input.weaponSkill / 5) * 0.005;
    }

    let styleFit = 1;

    if (item.slot === "weapon") styleFit += style.weights.damage * 0.25;
    if (["armor", "upper", "lower", "shield"].includes(item.slot)) {
      styleFit += style.weights.survival * 0.2;
    }

    if (input.weaponClass === "dual-wield" && item.slot === "weapon") {
      const skillTarget = Math.max(1, input.weaponSkill || 1);
      const itemSkillReq = Math.max(1, item.skillReq || 1);
      const skillCloseness = 1 - clamp(Math.abs(skillTarget - itemSkillReq) / 220, 0, 1);

      if (item.weaponClass === "dual-wield") {
        styleFit += 0.18 + skillCloseness * 0.14;
      } else if (item.weaponClass === "one-handed") {
        styleFit -= 0.04;
      }
    }

    // Greatsword-specific push to stronger quality weapon sources.
    if (input.weaponClass === "two-handed" && item.slot === "weapon" && ["crafted", "boss"].includes(item.sourceType)) {
      styleFit += 0.12;
    }

    // Slight boost for LUK-oriented profiles to badge/event paths where relevant.
    if (input.playstyle === "farming" && ["badge", "event"].includes(item.sourceType)) {
      styleFit += 0.08;
    }

    const statBlock = deriveItemStatBlock(item, sourceQ, projectedLevel, input.weaponSkill);
    const statPower = computeItemStatPower(item, statBlock, style, finalStats, input.weaponClass);
    const requirementFit = computeRequirementFit(item, projectedLevel, input.weaponSkill);
    const valueEfficiency = computeValueEfficiency(item, projectedLevel, sourceQ, style);
    const { budgetFit, overBudget } = computeBudgetFit(
      item,
      input.optimization?.budgetCap,
      input.optimization?.strictBudgetCap,
      style,
    );

    const isOwned = isOwnedItem(item, input.ownership.tokens);
    const ownedBoost = isOwned ? 1.08 : 1;
    const confidence = item.exactStats ? "exact" : "estimated";

    const total =
      sourceQ * scalingQ * floorFit * scalingProgress * styleFit * statPower * requirementFit * valueEfficiency * budgetFit * ownedBoost;

    return {
      total,
      breakdown: {
        sourceQ,
        scalingQ,
        floorFit,
        scalingProgress,
        styleFit,
        statPower,
        requirementFit,
        valueEfficiency,
        budgetFit,
        attack: statBlock.attack,
        defense: statBlock.defense,
        dexterity: statBlock.dexterity,
        ownedBoost,
        isOwned,
        overBudget,
        confidence,
      },
    };
  }

  function deriveItemStatBlock(item, sourceQ, projectedLevel, weaponSkill) {
    const floor = Math.max(1, item.floorMin || 1);
    const levelReq = Math.max(1, item.levelReq || 1);
    const skillReq = Math.max(1, item.skillReq || 1);
    const exactStats = Boolean(item.exactStats);
    const scaleRatio = getItemScaleRatio(item, projectedLevel, weaponSkill);

    const estimatedAttack = floor * 3.1 + skillReq * 0.08 + sourceQ * 1.5;
    const estimatedDefense = floor * 0.45 + levelReq * 0.03 + sourceQ * 0.4;
    const estimatedDexterity = floor * 2.4 + levelReq * 0.28 + sourceQ * 1.2;

    const attackFallback = !exactStats && item.slot === "weapon" ? estimatedAttack : 0;
    const defenseFallback = !exactStats && ["armor", "upper", "lower", "shield"].includes(item.slot) ? estimatedDefense : 0;
    const dexterityFallback = !exactStats && ["armor", "upper", "lower"].includes(item.slot) ? estimatedDexterity : 0;

    const attack = resolveScaledStatValue(item.attack, item.attackMin, item.attackMax, scaleRatio, attackFallback);
    const defense = resolveScaledStatValue(item.defense, item.defenseMin, item.defenseMax, scaleRatio, defenseFallback);
    const dexterity = resolveScaledStatValue(
      item.dexterity,
      item.dexterityMin,
      item.dexterityMax,
      scaleRatio,
      dexterityFallback,
    );

    return {
      attack,
      defense,
      dexterity,
      projectedLevel,
      weaponSkill,
    };
  }

  function getItemScaleRatio(item, projectedLevel, weaponSkill) {
    if (item.scalingType === "level_1" || item.scalingType === "level_5") {
      const minLevel = Math.max(1, item.levelReq || 1);
      const maxLevel = Math.max(minLevel, item.levelReqMax || minLevel);
      const step = item.scalingType === "level_5" ? 5 : 1;
      return scaleRatioFromRange(projectedLevel, minLevel, maxLevel, step);
    }

    if (item.scalingType === "skill_1" || item.scalingType === "skill_5") {
      const minSkill = Math.max(1, item.skillReq || 1);
      const maxSkill = Math.max(minSkill, item.skillReqMax || minSkill);
      const step = item.scalingType === "skill_5" ? 5 : 1;
      return scaleRatioFromRange(weaponSkill, minSkill, maxSkill, step);
    }

    return 1;
  }

  function scaleRatioFromRange(currentValue, minValue, maxValue, step) {
    if (!Number.isFinite(currentValue)) return 0;
    if (!Number.isFinite(minValue)) minValue = 1;
    if (!Number.isFinite(maxValue) || maxValue <= minValue) return 1;

    const normalizedStep = Math.max(1, step || 1);
    const clampedValue = clamp(currentValue, minValue, maxValue);
    const steppedValue = minValue + Math.floor((clampedValue - minValue) / normalizedStep) * normalizedStep;
    return clamp((steppedValue - minValue) / (maxValue - minValue), 0, 1);
  }

  function resolveScaledStatValue(baseValue, minValue, maxValue, scaleRatio, fallbackValue) {
    if (Number.isFinite(minValue) && Number.isFinite(maxValue)) {
      return minValue + (maxValue - minValue) * scaleRatio;
    }

    if (Number.isFinite(baseValue)) {
      return baseValue;
    }

    return fallbackValue;
  }

  function computeItemStatPower(item, statBlock, style, finalStats, weaponClass) {
    const attackPower = Math.log10(1 + statBlock.attack * 10);
    const defensePower = Math.log10(1 + statBlock.defense * 50);
    const dexterityPower = Math.log10(1 + statBlock.dexterity * 3);

    let statPower = 1;

    if (item.slot === "weapon") {
      statPower += attackPower * (0.2 + style.weights.damage * 0.16);
      if (weaponClass === "two-handed") {
        statPower += attackPower * 0.05;
      }
    }

    if (["armor", "upper", "lower", "shield"].includes(item.slot)) {
      const defenseNeed = clamp((35 - finalStats.def) / 35, 0, 1);
      const vitalityNeed = clamp((35 - finalStats.vit) / 35, 0, 1);

      statPower += defensePower * (0.1 + style.weights.survival * 0.18 + defenseNeed * 0.08);
      statPower += dexterityPower * (0.08 + style.weights.survival * 0.12 + vitalityNeed * 0.06);
    }

    return Math.max(1, statPower);
  }

  function buildSummaryCardsHtml(input, planResult) {
    const start = planResult.initialEval.metrics;
    const end = planResult.finalEval.metrics;
    const cards = [
      { title: "Level Window", value: `${input.currentLevel + 1} -> ${input.currentLevel + input.levelsToPlan}`, note: `${input.levelsToPlan} levels planned (${input.levelsToPlan * data.pointsPerLevel} points)` },
      { title: "Access Scope", value: `Floor 1 -> ${input.maxFloorReached}`, note: "Gear recommendations are limited to unlocked floors." },
      { title: "Final Stats", value: `STR ${planResult.finalStats.str} / DEF ${planResult.finalStats.def} / AGI ${planResult.finalStats.agi}`, note: `VIT ${planResult.finalStats.vit} / LUK ${planResult.finalStats.luk}` },
      { title: "Projected DPS Index", value: `${round(end.dpsProjection, 1)}`, note: `${deltaLabel(end.dpsProjection - start.dpsProjection)} vs current` },
      { title: "Projected Survivability", value: `DR ${round(end.damageReduction, 1)} | HP+ ${round(end.bonusHp, 1)}`, note: `Debuff Res +${round(end.debuffResPct, 2)}%` },
      { title: "Tempo + Utility", value: `Stamina ${round(end.staminaPool, 1)} | Crit ${round(end.critChancePct, 2)}%`, note: `Drop +${round(end.dropBonusPct, 2)}% | Multi-hit ${round(end.multiHitPct, 1)}%` },
    ];
    return cards.map((card) => `<article class="summary-card"><h4>${escapeHtml(card.title)}</h4><p class="card-value">${escapeHtml(card.value)}</p><p class="card-note">${escapeHtml(card.note)}</p></article>`).join("");
  }

  function renderLogic(input, planResult) {
    const profile = data.weaponProfiles[input.weaponClass];
    const style = data.playstyles[input.playstyle];
    const allocationContext = createAllocationContext(input);
    const allocationSplitText = STAT_KEYS.map((stat) => `${stat.toUpperCase()} ${round((allocationContext.targetShares[stat] || 0) * 100, 1)}%`).join(
      " / ",
    );

    const totalsAdded = diffStats(planResult.initialStats, planResult.finalStats);

    logicExplanation.innerHTML = `
      <ul>
        <li><strong>Weapon profile:</strong> ${escapeHtml(profile.label)}.</li>
        <li><strong>Weapon data scope:</strong> ${escapeHtml(describeWeaponClassScope(input.weaponClass))}</li>
        <li><strong>Playstyle:</strong> ${escapeHtml(style.label)} - ${escapeHtml(style.description)}</li>
        <li><strong>Allocation profile:</strong> ${escapeHtml(describeAllocationMode(input.allocationMode))}</li>
        <li><strong>Target split:</strong> ${escapeHtml(allocationSplitText)}</li>
        <li><strong>Allocation engine:</strong> hybrid marginal-gain optimization with profile/playstyle target-share correction, per-level spread control, and one-step lookahead.</li>
        <li><strong>Floor access rule:</strong> recommendations are capped at Floor ${input.maxFloorReached} based on progression unlock.</li>
        <li><strong>Data quality filter:</strong> ${escapeHtml(describeDataQualityMode(input))}</li>
        <li><strong>Ownership rules:</strong> ${escapeHtml(describeOwnershipMode(input))}</li>
        <li><strong>Optimization filters:</strong> ${escapeHtml(describeOptimizationRules(input))}</li>
        <li><strong>Formula baseline:</strong> STR damage scaling, DEF defense multiplier scaling, AGI speed/tempo scaling, VIT HP/resistance scaling, LUK crit/drop scaling.</li>
        <li><strong>Calibration:</strong> ${escapeHtml(describeCalibrationState(calibrationState))}</li>
        <li><strong>Resulted additions:</strong> +STR ${totalsAdded.str}, +DEF ${totalsAdded.def}, +AGI ${totalsAdded.agi}, +VIT ${totalsAdded.vit}, +LUK ${totalsAdded.luk}.</li>
        <li><strong>Points remaining to cap:</strong> ${escapeHtml(describePointsRemaining(planResult.finalStats))}</li>
        <li><strong>Sword skill progression:</strong> ${escapeHtml(describeSwordSkillProgress(input))}</li>
        <li><strong>Allocation consistency:</strong> When you update your level and stats to match your progress, the remaining allocation will stay consistent if your stats match the plan. Small differences may cause the path to adjust.</li>
      </ul>
      <div class="allocation-helpers">
        <div class="sync-to-plan-row">
          <label for="syncToPlanLevelSelect">I&rsquo;m now level</label>
          <select id="syncToPlanLevelSelect">${(planResult.rows || [])
            .map((r) => `<option value="${r.level}"${r.level === input.currentLevel ? " selected" : ""}>${r.level}</option>`)
            .join("")}</select>
          <button type="button" class="secondary" id="syncToPlanBtn" data-testid="sync-to-plan-btn">Sync to plan</button>
        </div>
        <div id="statsMatchIndicator" class="stats-match-indicator">${buildStatsMatchIndicatorHtml(input, planResult)}</div>
      </div>
    `;
  }

  function buildStatsMatchIndicatorHtml(input, planResult) {
    const row = (planResult?.rows || []).find((r) => r.level === input.currentLevel);
    if (!row) return "";
    const entered = input.stats;
    const planned = row.totals || {};
    const tolerance = 1;
    const matches =
      Math.abs((entered.str || 0) - (planned.str || 0)) <= tolerance &&
      Math.abs((entered.def || 0) - (planned.def || 0)) <= tolerance &&
      Math.abs((entered.agi || 0) - (planned.agi || 0)) <= tolerance &&
      Math.abs((entered.vit || 0) - (planned.vit || 0)) <= tolerance &&
      Math.abs((entered.luk || 0) - (planned.luk || 0)) <= tolerance;
    if (matches) {
      return '<span class="stats-match-ok">✓ Stats match plan — remaining allocation is consistent.</span>';
    }
    return '<span class="stats-match-differ">Stats differ from plan — allocation will optimize from current state.</span>';
  }

  function handleSyncToPlanClick() {
    const sel = document.getElementById("syncToPlanLevelSelect");
    const level = sel ? toInt(sel.value, 1) : 0;
    if (!level || !lastPlanResult?.rows) return;
    const row = lastPlanResult.rows.find((r) => r.level === level);
    if (!row || !row.totals) return;
    const setField = (name, value) => {
      const field = form?.querySelector(`[name="${name}"]`);
      if (field) field.value = `${value ?? ""}`;
    };
    setField("currentLevel", level);
    STAT_KEYS.forEach((s) => setField(s, row.totals[s]));
    formDirtySinceLastSubmit = false;
    renderStalePlanBanner();
    renderEquippedLoadout(getFormInput());
    queueDraftWrite();
  }

  function renderPlanRows(rows) {
    planTableBody.innerHTML = rows
      .map((row) => {
        const hasBreakpoints = row.breakpoints && row.breakpoints.length > 0;
        const bpHtml = hasBreakpoints
          ? `<div class="breakpoint-annotations">${row.breakpoints.map((bp) => {
              const isUnlock = bp.startsWith("Unlocks:") || bp.startsWith("Available weapon:");
              const isSkill = bp.startsWith("Skill ");
              return `<span class="breakpoint-pill${isUnlock ? " unlock-pill" : ""}${isSkill ? " skill-pill" : ""}">${escapeHtml(bp)}</span>`;
            }).join("")}</div>`
          : "";
        return `
          <tr${hasBreakpoints ? ' class="has-breakpoint"' : ""}>
            <td>${row.level}</td>
            <td>${row.added.str}</td>
            <td>${row.added.def}</td>
            <td>${row.added.agi}</td>
            <td>${row.added.vit}</td>
            <td>${row.added.luk}</td>
            <td>${row.totals.str}</td>
            <td>${row.totals.def}</td>
            <td>${row.totals.agi}</td>
            <td>${row.totals.vit}</td>
            <td>${row.totals.luk}</td>
            <td>${escapeHtml(row.reason)}${bpHtml}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderGearRecommendations(gearPlan, input) {
    const projectedLevel = input.currentLevel + input.levelsToPlan;
    const sourceQForEquipped = (item) => data.sourceQuality[item?.sourceType] || 1;

    const metaHtml = buildRecommendationMetaHtml(gearPlan, input);
    const costHtml = buildCostSummaryHtml(gearPlan, input);
    const weaponPathHtml = buildWeaponSkillPathHtml(input);

    const gearCardsHtml = Object.entries(gearPlan)
      .map(([slot, candidates]) => {
        const equippedItemId = equippedState?.slots?.[slot];
        const equippedItem = equippedItemId ? data.itemCatalog.find((i) => i.id === equippedItemId) : null;
        const equippedStats = equippedItem
          ? deriveItemStatBlock(equippedItem, sourceQForEquipped(equippedItem), projectedLevel, input.weaponSkill)
          : null;

        const itemsHtml = candidates.length
          ? candidates
              .map(({ item, score }) => {
                const detail = score.breakdown;
                const isEquipped = equippedState?.slots?.[slot] === item.id;
                const locationText = describeItemLocation(item);
                const valueText = formatItemValue(item.colValue);
                const requirementText = describeItemRequirement(item);
                const budgetText = describeBudgetItemStatus(item, input.optimization?.budgetCap);
                const diffHtml = buildStatDiffHtml(detail, equippedStats, isEquipped);
                return `
                  <li class="gear-item${isEquipped ? " equipped" : ""}">
                    <strong>${escapeHtml(item.name)}</strong>
                    <div class="gear-meta">
                      Floor ${item.floorMin || "?"} • ${escapeHtml(item.sourceType)} • scaling: ${escapeHtml(item.scalingType || "fixed")}
                    </div>
                    <div class="gear-meta">
                      <strong>Location:</strong> ${escapeHtml(locationText)}
                    </div>
                    <div class="gear-meta">
                      <strong>Value:</strong> ${escapeHtml(valueText)} • <strong>Req:</strong> ${escapeHtml(requirementText)}
                    </div>
                    <div class="gear-meta">
                      <strong>Budget:</strong> ${escapeHtml(budgetText)}
                    </div>
                    <div class="gear-score">
                      score ${round(score.total, 3)}
                      <span>(source ${round(detail.sourceQ, 2)} | scaling ${round(detail.scalingQ, 2)} | floor ${round(detail.floorFit, 2)} | req ${round(detail.requirementFit, 2)} | value ${round(detail.valueEfficiency, 2)} | budget ${round(detail.budgetFit, 2)} | stat ${round(detail.statPower, 2)} | owned ${round(detail.ownedBoost, 2)})</span>
                    </div>
                    <div class="gear-statline">
                      ATK ${round(detail.attack || 0, 2)} • DEF ${round(detail.defense || 0, 2)} • DEX ${round(detail.dexterity || 0, 2)}
                    </div>
                    ${diffHtml}
                    <div class="gear-actions">
                      <button
                        type="button"
                        class="chip-btn${isEquipped ? " active" : ""}"
                        data-action="equip-item"
                        data-item-id="${escapeHtml(item.id)}"
                        data-slot="${escapeHtml(slot)}"
                      >
                        ${isEquipped ? "Equipped" : "Equip"}
                      </button>
                      <button
                        type="button"
                        class="chip-btn ghost"
                        data-action="add-owned-item"
                        data-item-id="${escapeHtml(item.id)}"
                        data-slot="${escapeHtml(slot)}"
                      >
                        Add to Owned
                      </button>
                    </div>
                    <div class="gear-flags">
                      ${isEquipped ? '<span class="pill equipped">Equipped</span>' : ""}
                      <span class="pill ${detail.isOwned ? "owned" : "not-owned"}">${detail.isOwned ? "Owned" : "Unowned"}</span>
                      ${detail.overBudget && Number.isFinite(input.optimization?.budgetCap) ? '<span class="pill estimated">Over budget</span>' : ""}
                      <span class="pill ${detail.confidence === "exact" ? "exact" : "estimated"}">${detail.confidence === "exact" ? "Exact data" : "Estimated data"}</span>
                    </div>
                    ${item.notes ? `<div class="gear-note">${escapeHtml(item.notes)}</div>` : ""}
                  </li>
                `;
              })
              .join("")
          : `<li>No eligible ${escapeHtml(getSlotLabel(slot))} found with current filters/requirements.</li>`;

        return `
          <article class="gear-slot-card">
            <h4>${escapeHtml(getSlotLabel(slot))}</h4>
            <ol>${itemsHtml}</ol>
          </article>
        `;
      })
      .join("");

    const twoHandedNote = input.weaponClass === "two-handed"
      ? `<p class="gear-footnote">Shield slot is hidden for Two-Handed recommendations because greatsword paths typically do not run shields.</p>`
      : "";
    gearResults.innerHTML = metaHtml + costHtml + gearCardsHtml + twoHandedNote + weaponPathHtml;
  }

  function renderBenchmarkPanel(input, planResult) {
    if (!benchmarkPanel) return;

    const rows = planResult.rows;
    const totalLevels = input.levelsToPlan;

    const milestoneSteps = [0];
    if (totalLevels >= 10) milestoneSteps.push(Math.round(totalLevels * 0.25));
    if (totalLevels >= 20) milestoneSteps.push(Math.round(totalLevels * 0.5));
    if (totalLevels >= 10) milestoneSteps.push(Math.round(totalLevels * 0.75));
    milestoneSteps.push(totalLevels);

    const uniqueSteps = [...new Set(milestoneSteps)].sort((a, b) => a - b);

    const milestones = uniqueSteps.map((step) => {
      const stats = step === 0 ? input.stats : rows[Math.min(step, rows.length) - 1].totals;
      const level = input.currentLevel + step;
      const eval_ = evaluateBuild(stats, input, level);
      const metrics = applyCalibrationFactors(eval_.rawMetrics);
      return { step, level, stats, metrics };
    });

    const metricDefs = [
      { key: "dpsProjection", label: "DPS", fmt: (v) => round(v, 1) },
      { key: "damageReduction", label: "DR (flat)", fmt: (v) => Math.round(v).toLocaleString(), fmtDelta: (v) => Math.round(v), minDelta: 1 },
      { key: "bonusHp", label: "Bonus HP", fmt: (v) => round(v, 1) },
      { key: "staminaPool", label: "Stamina", fmt: (v) => round(v, 0) },
      { key: "critChancePct", label: "Crit %", fmt: (v) => `${round(v, 2)}%`, fmtDelta: (v) => `${round(v, 2)}%` },
      { key: "multiHitPct", label: "Multi-hit", fmt: (v) => `${round(v, 1)}%`, fmtDelta: (v) => `${round(v, 1)}%` },
      { key: "attackSpeedPct", label: "Atk Speed", fmt: (v) => `${round(v, 1)}%`, fmtDelta: (v) => `${round(v, 1)}%` },
    ];

    const statCapRow = (() => {
      const cells = milestones
        .map((m) => {
          const s = m.stats;
          const cap = data.statCap;
          const total = s.str + s.def + s.agi + s.vit + s.luk;
          const pct = Math.min(100, round((total / (cap * 5)) * 100, 1));
          const parts = ["str", "def", "agi", "vit", "luk"]
            .filter((k) => s[k] >= cap)
            .map((k) => k.toUpperCase());
          const capNote = parts.length ? ` <span class="bench-tag end">${parts.join("+")} capped</span>` : "";
          return `<td class="bench-stats">${total} pts (${pct}% of max)${capNote}</td>`;
        })
        .join("");
      return `<tr><td class="bench-metric-label">Pts Used</td>${cells}</tr>`;
    })();

    const headerCells = milestones
      .map((m) => `<th>Lv ${m.level}${m.step === 0 ? " <span class=\"bench-tag\">now</span>" : m.step === totalLevels ? " <span class=\"bench-tag end\">end</span>" : ""}</th>`)
      .join("");

    const bodyRows = metricDefs
      .map(({ key, label, fmt, fmtDelta, minDelta }) => {
        const df = fmtDelta || fmt;
        const threshold = minDelta != null ? minDelta : 0.01;
        const cells = milestones
          .map((m, i) => {
            const val = m.metrics[key];
            const prev = i > 0 ? milestones[i - 1].metrics[key] : null;
            const delta = prev !== null ? val - prev : null;
            const deltaHtml =
              delta !== null && Math.abs(delta) >= threshold
                ? `<span class="bench-delta ${delta >= 0 ? "pos" : "neg"}">${delta >= 0 ? "+" : ""}${df(delta)}</span>`
                : "";
            return `<td>${fmt(val)}${deltaHtml}</td>`;
          })
          .join("");
        return `<tr><td class="bench-metric-label">${escapeHtml(label)}</td>${cells}</tr>`;
      })
      .join("");

    const statRow = (() => {
      const cap = data.statCap;
      const statKeys = ["str", "def", "agi", "vit", "luk"];
      const statColors = { str: "#e07b54", def: "#5b8dd9", agi: "#5bbf7a", vit: "#c97dd4", luk: "#d4b84a" };
      const cells = milestones
        .map((m) => {
          const s = m.stats;
          const bars = statKeys.map((k) => {
            const val = s[k] || 0;
            const pct = Math.min(100, (val / cap) * 100);
            const capped = val >= cap ? ' stat-bar-capped' : '';
            return `
              <div class="stat-bar-row">
                <span class="stat-bar-label">${k.toUpperCase()}</span>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill${capped}" style="width:${pct.toFixed(1)}%;background:${statColors[k]}"></div>
                </div>
                <span class="stat-bar-value">${val}</span>
              </div>`;
          }).join("");
          return `<td class="bench-stats bench-stat-bars">${bars}</td>`;
        })
        .join("");
      return `<tr><td class="bench-metric-label">Stats</td>${cells}</tr>`;
    })();

    const gearRow = (() => {
      const timeline = buildUpgradeTimeline(input);
      const slots = getRecommendedSlots(input.weaponClass);
      const cells = milestones.map((m) => {
        const lines = slots.map((slot) => {
          const phases = timeline[slot] || [];
          const active = phases
            .filter(({ unlockLevel }) => unlockLevel <= m.level)
            .slice(-1)[0];
          if (!active) return `<div class="bench-gear-line bench-gear-none">${escapeHtml(getSlotLabel(slot))}: —</div>`;
          const owned = isOwnedItem(active.item, input.ownership.tokens);
          const equipped = equippedState?.slots?.[slot] === active.item.id;
          const badge = equipped
            ? `<span class="bench-gear-badge equipped">E</span>`
            : owned
              ? `<span class="bench-gear-badge owned">O</span>`
              : "";
          return `<div class="bench-gear-line"><span class="bench-gear-slot">${escapeHtml(getSlotLabel(slot))}</span>${badge} ${escapeHtml(active.item.name)}</div>`;
        });
        return `<td class="bench-gear-cell">${lines.join("")}</td>`;
      }).join("");
      return `<tr><td class="bench-metric-label">Gear</td>${cells}</tr>`;
    })();

    const summaryHtml = `<div class="summary-cards">${buildSummaryCardsHtml(input, planResult)}</div>`;
    benchmarkPanel.innerHTML = summaryHtml + `
      <div class="table-wrap">
        <table class="benchmark-table">
          <thead><tr><th>Metric</th>${headerCells}</tr></thead>
          <tbody>${gearRow}${statRow}${bodyRows}${statCapRow}</tbody>
        </table>
      </div>
    `;
  }

  function buildUpgradeTimeline(input) {
    const startLevel = input.currentLevel;
    const endLevel = input.currentLevel + input.levelsToPlan;
    const slots = getRecommendedSlots(input.weaponClass);

    const eligible = data.itemCatalog.filter((item) => {
      if ((item.floorMin || 1) > input.maxFloorReached) return false;
      if (input.itemPoolMode === "standard" && ["badge", "gamepass", "event"].includes(item.sourceType)) return false;
      if (input.dataQualityMode === "exact-only" && item.exactStats !== true) return false;
      if (item.slot === "weapon" && !isWeaponClassCompatible(item.weaponClass, input.weaponClass)) return false;
      if (input.optimization?.avoidTokens?.size && isAvoidedItem(item, input.optimization.avoidTokens)) return false;
      return true;
    });

    const timeline = {};

    slots.forEach((slot) => {
      const slotItems = eligible
        .filter((item) => item.slot === slot)
        .map((item) => ({
          item,
          unlockLevel: slot === "weapon" ? 1 : Math.max(1, item.levelReq || 1),
        }))
        .filter(({ unlockLevel }) => unlockLevel <= endLevel)
        .sort((a, b) => a.unlockLevel - b.unlockLevel || (a.item.colValue || 0) - (b.item.colValue || 0));

      const phases = [];
      let lastUnlock = 0;

      slotItems.forEach(({ item, unlockLevel }) => {
        const isNew = unlockLevel > startLevel;
        const isAlreadyUnlocked = unlockLevel <= startLevel;
        phases.push({ item, unlockLevel, isNew, isAlreadyUnlocked });
        lastUnlock = unlockLevel;
      });

      timeline[slot] = phases;
    });

    return timeline;
  }

  function buildWeaponSkillPathHtml(input) {
    const weapons = data.itemCatalog.filter((item) => {
      if (item.slot !== "weapon") return false;
      if (!isWeaponClassCompatible(item.weaponClass, input.weaponClass)) return false;
      if (input.dataQualityMode === "exact-only" && item.exactStats !== true) return false;
      return true;
    });

    if (!weapons.length) return `<p class="muted-text">No weapon data for this class.</p>`;

    const TIER_SIZE = 25;
    const tierMap = {};
    weapons.forEach((item) => {
      const tier = Math.floor((item.skillReq || 1) / TIER_SIZE) * TIER_SIZE;
      if (!tierMap[tier]) tierMap[tier] = [];
      tierMap[tier].push(item);
    });

    const sourceQ = data.sourceQuality || {};
    const tiers = Object.keys(tierMap).map(Number).sort((a, b) => a - b);

    const currentSkill = input.weaponSkill || 1;
    const maxFloor = input.maxFloorReached || 1;

    const cards = tiers.map((tier) => {
      const candidates = tierMap[tier].filter((item) => (item.floorMin || 1) <= maxFloor);
      if (!candidates.length) return null;

      const best = candidates.reduce((top, item) => {
        const sq = sourceQ[item.sourceType] || 1;
        const atk = item.attack || item.attackMin || 0;
        const topSq = sourceQ[top.sourceType] || 1;
        const topAtk = top.attack || top.attackMin || 0;
        return (sq * atk > topSq * topAtk) ? item : top;
      });

      const atk = best.attack || best.attackMin || 0;
      const tierEnd = tier + TIER_SIZE - 1;
      const isPast = currentSkill > tierEnd;
      const isCurrent = currentSkill >= tier && currentSkill <= tierEnd;
      const isLocked = (best.floorMin || 1) > maxFloor;
      const displayTier = Math.max(1, tier);

      const stateClass = isPast ? "wsp-past" : isCurrent ? "wsp-current" : "wsp-future";
      const lockedBadge = isLocked ? `<span class="wsp-badge wsp-locked">Floor ${best.floorMin}+</span>` : "";
      const srcBadge = `<span class="wsp-badge wsp-src-${escapeHtml(best.sourceType)}">${escapeHtml(best.sourceType)}</span>`;
      const ownedBadge = isOwnedItem(best, input.ownership.tokens) ? `<span class="wsp-badge wsp-owned">Owned</span>` : "";
      const colText = best.colValue ? formatItemValue(best.colValue) : "N/A";

      return `<div class="wsp-card ${stateClass}">
        <div class="wsp-skill-req">Skill ${displayTier}+</div>
        <div class="wsp-name">${escapeHtml(best.name)}</div>
        <div class="wsp-atk">ATK ${round(atk, 0)}</div>
        <div class="wsp-badges">${srcBadge}${ownedBadge}${lockedBadge}</div>
        <div class="wsp-col">${escapeHtml(colText)}</div>
      </div>`;
    }).filter(Boolean);

    if (!cards.length) return `<p class="muted-text">No weapons available at your current floor access.</p>`;
    return `<div class="gear-weapon-path"><h4 class="weapon-path-heading">Weapon path by skill tier</h4><div class="wsp-track">${cards.join('<div class="wsp-arrow">›</div>')}</div></div>`;
  }

  function renderUpgradeTimeline(input) {
    if (!upgradeTimeline) return;

    const timeline = buildUpgradeTimeline(input);
    const slots = getRecommendedSlots(input.weaponClass);

    const grandTotal = slots.reduce((sum, slot) => {
      return sum + (timeline[slot] || [])
        .filter(({ isNew }) => isNew)
        .reduce((s, { item }) => s + (item.colValue || 0), 0);
    }, 0);

    const grandTotalBanner = grandTotal > 0
      ? `<div class="timeline-grand-total">Total upcoming gear cost: <strong>${formatItemValue(grandTotal)}</strong></div>`
      : "";

    upgradeTimeline.innerHTML = grandTotalBanner + slots
      .map((slot) => {
        const phases = timeline[slot] || [];
        if (!phases.length) {
          return `<div class="timeline-slot"><strong>${escapeHtml(getSlotLabel(slot))}</strong><p class="muted-text">No eligible items found.</p></div>`;
        }

        const itemsHtml = phases
          .map(({ item, unlockLevel, isNew, isAlreadyUnlocked }) => {
            const tag = isAlreadyUnlocked
              ? `<span class="timeline-tag available">Available</span>`
              : `<span class="timeline-tag unlocks">Lv ${unlockLevel}</span>`;
            const owned = isOwnedItem(item, input.ownership.tokens)
              ? `<span class="timeline-tag owned-tag">Owned</span>`
              : "";
            const equipped = equippedState?.slots?.[slot] === item.id
              ? `<span class="timeline-tag equipped-tag">Equipped</span>`
              : "";
            const statLine = (() => {
              const atk = item.attack || item.attackMin || 0;
              const def = item.defense || item.defenseMin || 0;
              const dex = item.dexterity || item.dexterityMin || 0;
              const parts = [];
              if (atk) parts.push(`ATK ${atk}`);
              if (def) parts.push(`DEF ${def}`);
              if (dex) parts.push(`DEX ${dex}`);
              return parts.join(" • ") || "";
            })();
            return `
              <div class="timeline-item${isAlreadyUnlocked ? " available" : " upcoming"}">
                <div class="timeline-item-header">
                  ${tag}${owned}${equipped}
                  <span class="timeline-item-name">${escapeHtml(item.name)}</span>
                </div>
                ${statLine ? `<div class="timeline-item-stats">${escapeHtml(statLine)}</div>` : ""}
                <div class="timeline-item-meta">${escapeHtml(item.sourceType)} • ${formatItemValue(item.colValue)}</div>
              </div>
            `;
          })
          .join("");

        const upcomingCost = phases
          .filter(({ isNew }) => isNew)
          .reduce((sum, { item }) => sum + (item.colValue || 0), 0);
        const costBadge = upcomingCost > 0
          ? `<span class="timeline-cost-badge">${formatItemValue(upcomingCost)} upcoming</span>`
          : "";

        return `
          <div class="timeline-slot">
            <div class="timeline-slot-label">${escapeHtml(getSlotLabel(slot))}${costBadge}</div>
            <div class="timeline-items">${itemsHtml}</div>
          </div>
        `;
      })
      .join("");
  }

  function buildStatDiffHtml(detail, equippedStats, isEquipped) {
    if (isEquipped || !equippedStats) return "";

    const atkDelta = round((detail.attack || 0) - (equippedStats.attack || 0), 2);
    const defDelta = round((detail.defense || 0) - (equippedStats.defense || 0), 2);
    const dexDelta = round((detail.dexterity || 0) - (equippedStats.dexterity || 0), 2);

    const fmt = (val) => {
      if (val === 0) return `<span class="diff-neutral">±0</span>`;
      return val > 0
        ? `<span class="diff-pos">+${val}</span>`
        : `<span class="diff-neg">${val}</span>`;
    };

    return `<div class="gear-diff">vs equipped: ATK ${fmt(atkDelta)} • DEF ${fmt(defDelta)} • DEX ${fmt(dexDelta)}</div>`;
  }

  function buildRecommendationMetaHtml(gearPlan, input) {
    const candidates = Object.values(gearPlan).flat();
    const total = candidates.length;
    const exactCount = candidates.filter((entry) => entry.score.breakdown.confidence === "exact").length;
    const estimatedCount = total - exactCount;
    const ownedCount = candidates.filter((entry) => entry.score.breakdown.isOwned).length;
    const averageValue = total
      ? candidates.reduce((sum, entry) => sum + (Number(entry.item?.colValue) || 0), 0) / total
      : 0;
    const averageValueFit = total
      ? candidates.reduce((sum, entry) => sum + (Number(entry.score?.breakdown?.valueEfficiency) || 1), 0) / total
      : 1;
    const budgetCap = input.optimization?.budgetCap;
    const hasBudgetCap = Number.isFinite(budgetCap) && budgetCap > 0;
    const overBudgetCount = hasBudgetCap
      ? candidates.filter((entry) => Boolean(entry.score?.breakdown?.overBudget)).length
      : 0;
    const avoidCount = input.optimization?.avoidTokens?.size || 0;

    const ownershipText = input.ownership.onlyOwned
      ? "Owned-only mode active"
      : input.ownership.tokens.size > 0
        ? "Owned boost mode active"
        : "Ownership weighting off";

    const flags = [];
    if (estimatedCount > 0) flags.push(`${estimatedCount} estimated`);
    if (input.ownership.onlyOwned) flags.push("owned-only");
    else if (input.ownership.tokens.size > 0) flags.push(`${ownedCount} owned`);
    if (hasBudgetCap) flags.push(`budget ${escapeHtml(formatItemValue(budgetCap))}${input.optimization.strictBudgetCap ? " strict" : ""}`);
    if (avoidCount) flags.push(`${avoidCount} avoided`);
    if (calibrationState.sampleCount > 0) flags.push(`${calibrationState.sampleCount} cal sample${calibrationState.sampleCount === 1 ? "" : "s"}`);

    const flagsHtml = flags.length
      ? flags.map((f) => `<span class="meta-flag">${f}</span>`).join("")
      : "";
    return `<div class="meta-status-bar recommendation-meta">
      <span class="meta-confidence">${exactCount} exact · floor ≤${input.maxFloorReached} · avg ${escapeHtml(formatItemValue(averageValue))}</span>
      ${flagsHtml}
    </div>`;
  }

  function describePointsRemaining(finalStats) {
    const cap = data.statCap;
    const headroom = STAT_KEYS.map((k) => {
      const rem = cap - (finalStats[k] || 0);
      return rem > 0 ? `${k.toUpperCase()} ${rem}` : null;
    }).filter(Boolean);
    const totalUsed = STAT_KEYS.reduce((s, k) => s + (finalStats[k] || 0), 0);
    const totalCap = cap * STAT_KEYS.length;
    const totalRem = totalCap - totalUsed;
    if (!headroom.length) return "All stats at cap (2,500 pts used).";
    return `${totalRem} pts free — headroom: ${headroom.join(", ")}`;
  }

  function describeSwordSkillProgress(input) {
    const ws = input.weaponSkill || 1;
    const unlocks = (data.swordSkillUnlocks || {})[input.weaponClass] || [];
    if (!unlocks.length) return `Skill ${ws} (no skill data for this class).`;

    const unlocked = unlocks.filter((u) => ws >= u.skill);
    const next = unlocks.find((u) => ws < u.skill);

    const unlockedText = unlocked.length
      ? unlocked.map((u) => u.name).join(", ")
      : "none yet";

    const nextText = next
      ? ` — next: ${next.name} at skill ${next.skill} (need +${next.skill - ws} more)`
      : " — all skills unlocked!";

    return `Skill ${ws}: ${unlockedText}${nextText}`;
  }

  function buildCostSummaryHtml(gearPlan, input) {
    const slots = getRecommendedSlots(input.weaponClass);
    const rows = [];
    let grandTotal = 0;
    let grandOwned = 0;
    let grandToBuy = 0;

    slots.forEach((slot) => {
      const candidates = gearPlan[slot] || [];
      const top = candidates[0];
      if (!top) return;

      const item = top.item;
      const cost = item.colValue || 0;
      const owned = isOwnedItem(item, input.ownership.tokens);
      const equipped = equippedState?.slots?.[slot] === item.id;
      const costToBuy = owned || equipped ? 0 : cost;

      grandTotal += cost;
      if (owned || equipped) grandOwned += cost;
      grandToBuy += costToBuy;

      const statusTag = equipped
        ? `<span class="cost-tag equipped-tag">Equipped</span>`
        : owned
          ? `<span class="cost-tag owned-tag">Owned</span>`
          : `<span class="cost-tag buy-tag">Buy</span>`;

      rows.push(`
        <tr>
          <td>${escapeHtml(getSlotLabel(slot))}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${statusTag}</td>
          <td class="cost-cell">${cost > 0 ? formatItemValue(cost) : "—"}</td>
          <td class="cost-cell${costToBuy > 0 ? " cost-needed" : " cost-free"}">${costToBuy > 0 ? formatItemValue(costToBuy) : "✓ free"}</td>
        </tr>
      `);
    });

    const savingsNote = grandOwned > 0
      ? `<span class="cost-savings">You already own ${formatItemValue(grandOwned)} worth — saving that Col.</span>`
      : "";
    return `<div class="gear-cost-summary"><h4 class="cost-summary-heading">Cost Summary</h4>
      <table class="cost-table">
        <thead><tr><th>Slot</th><th>Top Pick</th><th>Status</th><th>List Price</th><th>To Buy</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
        <tfoot><tr class="cost-total-row"><td colspan="3"><strong>Total</strong></td><td class="cost-cell"><strong>${formatItemValue(grandTotal)}</strong></td><td class="cost-cell cost-needed"><strong>${grandToBuy > 0 ? formatItemValue(grandToBuy) : "✓ all owned"}</strong></td></tr></tfoot>
      </table>
      ${savingsNote}</div>`;
  }

  function evaluateSavedBuild(snapshot) {
    const input = snapshotToPlannerInput(snapshot);
    const result = buildLevelPlan(input);

    return {
      input,
      result,
      added: diffStats(result.initialStats, result.finalStats),
    };
  }

  function renderBuildComparison(nameA, summaryA, nameB, summaryB) {
    if (!comparisonResults) return;

    const metricRows = [
      {
        label: "Level Range",
        a: `${summaryA.input.currentLevel + 1} -> ${summaryA.input.currentLevel + summaryA.input.levelsToPlan}`,
        b: `${summaryB.input.currentLevel + 1} -> ${summaryB.input.currentLevel + summaryB.input.levelsToPlan}`,
        delta: "-",
      },
      {
        label: "Final STR",
        a: summaryA.result.finalStats.str,
        b: summaryB.result.finalStats.str,
        delta: numericDelta(summaryA.result.finalStats.str, summaryB.result.finalStats.str),
      },
      {
        label: "Final DEF",
        a: summaryA.result.finalStats.def,
        b: summaryB.result.finalStats.def,
        delta: numericDelta(summaryA.result.finalStats.def, summaryB.result.finalStats.def),
      },
      {
        label: "Final AGI",
        a: summaryA.result.finalStats.agi,
        b: summaryB.result.finalStats.agi,
        delta: numericDelta(summaryA.result.finalStats.agi, summaryB.result.finalStats.agi),
      },
      {
        label: "Final VIT",
        a: summaryA.result.finalStats.vit,
        b: summaryB.result.finalStats.vit,
        delta: numericDelta(summaryA.result.finalStats.vit, summaryB.result.finalStats.vit),
      },
      {
        label: "Final LUK",
        a: summaryA.result.finalStats.luk,
        b: summaryB.result.finalStats.luk,
        delta: numericDelta(summaryA.result.finalStats.luk, summaryB.result.finalStats.luk),
      },
      {
        label: "Projected DPS Index",
        a: round(summaryA.result.finalEval.metrics.dpsProjection, 1),
        b: round(summaryB.result.finalEval.metrics.dpsProjection, 1),
        delta: numericDelta(summaryA.result.finalEval.metrics.dpsProjection, summaryB.result.finalEval.metrics.dpsProjection, 1),
      },
      {
        label: "Damage Reduction",
        a: round(summaryA.result.finalEval.metrics.damageReduction, 1),
        b: round(summaryB.result.finalEval.metrics.damageReduction, 1),
        delta: numericDelta(summaryA.result.finalEval.metrics.damageReduction, summaryB.result.finalEval.metrics.damageReduction, 1),
      },
      {
        label: "Bonus HP",
        a: round(summaryA.result.finalEval.metrics.bonusHp, 1),
        b: round(summaryB.result.finalEval.metrics.bonusHp, 1),
        delta: numericDelta(summaryA.result.finalEval.metrics.bonusHp, summaryB.result.finalEval.metrics.bonusHp, 1),
      },
      {
        label: "Crit Chance %",
        a: round(summaryA.result.finalEval.metrics.critChancePct, 2),
        b: round(summaryB.result.finalEval.metrics.critChancePct, 2),
        delta: numericDelta(summaryA.result.finalEval.metrics.critChancePct, summaryB.result.finalEval.metrics.critChancePct, 2),
      },
      {
        label: "Drop Bonus %",
        a: round(summaryA.result.finalEval.metrics.dropBonusPct, 2),
        b: round(summaryB.result.finalEval.metrics.dropBonusPct, 2),
        delta: numericDelta(summaryA.result.finalEval.metrics.dropBonusPct, summaryB.result.finalEval.metrics.dropBonusPct, 2),
      },
    ];

    const rowsHtml = metricRows
      .map((row) => {
        return `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(`${row.a}`)}</td>
            <td>${escapeHtml(`${row.b}`)}</td>
            <td>${escapeHtml(`${row.delta}`)}</td>
          </tr>
        `;
      })
      .join("");

    comparisonResults.innerHTML = `
      <div class="comparison-header">
        <strong>${escapeHtml(nameA)}</strong>
        <span>vs</span>
        <strong>${escapeHtml(nameB)}</strong>
      </div>
      <div class="table-wrap comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>${escapeHtml(nameA)}</th>
              <th>${escapeHtml(nameB)}</th>
              <th>Delta (B - A)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function explainStatChoice(stat, weaponClass, playstyle) {
    const label = stat.toUpperCase();

    if (weaponClass === "two-handed" && stat === "str") {
      return "Greatsword damage scaling priority.";
    }
    if (stat === "agi") {
      return "Tempo/mobility gain and smoother skill cadence.";
    }
    if (stat === "vit") {
      return "Higher effective HP scaling and resistance support.";
    }
    if (stat === "def") {
      return "Better defense multiplier on gear defense.";
    }
    if (stat === "luk") {
      return "Drop/crit utility boost for farming-oriented paths.";
    }

    return `${label} selected by weighted score gain.`;
  }

  function compactReasons(reasonLog, added) {
    const statOrder = ["str", "def", "agi", "vit", "luk"];
    const addedPart = statOrder
      .filter((stat) => added[stat] > 0)
      .map((stat) => `${stat.toUpperCase()}+${added[stat]}`)
      .join(", ");

    const reason = reasonLog[reasonLog.length - 1] || "Score-optimized split.";
    return `${addedPart}. ${reason}`;
  }

  function emptyStatBlock() {
    return { str: 0, def: 0, agi: 0, vit: 0, luk: 0 };
  }

  function diffStats(start, end) {
    return {
      str: end.str - start.str,
      def: end.def - start.def,
      agi: end.agi - start.agi,
      vit: end.vit - start.vit,
      luk: end.luk - start.luk,
    };
  }

  function deltaLabel(delta) {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${round(delta, 1)}`;
  }

  function parseOwnedTokens(raw) {
    return new Set(
      `${raw || ""}`
        .split(",")
        .map((token) => normalizeOwnedToken(token))
        .filter(Boolean),
    );
  }

  function normalizeOwnedToken(value) {
    return `${value || ""}`
      .trim()
      .toLowerCase()
      .replace(/[\-_]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function isOwnedItem(item, tokenSet) {
    if (!tokenSet || tokenSet.size === 0) return false;

    const byId = normalizeOwnedToken(item.id);
    const byName = normalizeOwnedToken(item.name);
    return tokenSet.has(byId) || tokenSet.has(byName);
  }

  function isAvoidedItem(item, tokenSet) {
    if (!tokenSet || tokenSet.size === 0) return false;

    const byId = normalizeOwnedToken(item.id);
    const byName = normalizeOwnedToken(item.name);
    return tokenSet.has(byId) || tokenSet.has(byName);
  }

  function isWeaponClassCompatible(itemWeaponClass, requestedWeaponClass) {
    const itemClass = `${itemWeaponClass || ""}`.trim().toLowerCase();
    const requestedClass = `${requestedWeaponClass || ""}`.trim().toLowerCase();

    if (!itemClass || !requestedClass) return false;

    if (requestedClass === "dual-wield") {
      return itemClass === "dual-wield" || itemClass === "one-handed";
    }

    return itemClass === requestedClass;
  }

  function getRecommendedSlots(weaponClass) {
    const slots = ["weapon", "armor", "upper", "lower"];

    if (["one-handed", "rapier", "dagger"].includes(weaponClass)) {
      slots.push("shield");
    }

    return slots;
  }

  function getSlotLabel(slot) {
    const slotLabels = {
      weapon: "Weapon",
      armor: "Armor",
      upper: "Upper Headwear",
      lower: "Lower Headwear",
      shield: "Shield",
    };

    return slotLabels[slot] || slot;
  }

  function formatItemValue(colValue) {
    if (!Number.isFinite(colValue) || colValue <= 0) {
      return "N/A";
    }

    return `${Math.round(colValue).toLocaleString()} Col`;
  }

  function describeItemRequirement(item) {
    if (item.slot === "weapon") {
      const minSkill = Math.max(1, Number(item.skillReq) || 1);
      const maxSkill = Number.isFinite(item.skillReqMax) && item.skillReqMax > minSkill ? `-${Math.round(item.skillReqMax)}` : "";
      return `Skill ${Math.round(minSkill)}${maxSkill}`;
    }

    const minLevel = Math.max(1, Number(item.levelReq) || 1);
    const maxLevel = Number.isFinite(item.levelReqMax) && item.levelReqMax > minLevel ? `-${Math.round(item.levelReqMax)}` : "";
    return `Level ${Math.round(minLevel)}${maxLevel}`;
  }

  function describeItemLocation(item) {
    const floorText = Number.isFinite(item.floorMin) ? `Floor ${Math.round(item.floorMin)}` : "Unknown floor";

    switch (`${item.sourceType || ""}`.toLowerCase()) {
      case "shop":
        return `${floorText} Shop`;
      case "mob":
        return `${floorText} mob drops`;
      case "boss":
        return `${floorText} boss drops`;
      case "crafted":
        return `Blacksmithing / crafted route (${floorText})`;
      case "event":
        return "Event route";
      case "badge":
        return "Badge merchant route";
      case "gamepass":
        return "Gamepass merchant route";
      case "dungeon":
        return `${floorText} dungeon shop`;
      case "quest":
        return `${floorText} quest rewards`;
      default:
        return `${floorText} ${item.sourceType || "source"}`;
    }
  }

  function describeBudgetItemStatus(item, budgetCap) {
    if (!Number.isFinite(budgetCap) || budgetCap <= 0) {
      return "No cap set";
    }

    const value = Math.max(0, Number(item.colValue) || 0);
    if (!value) {
      return `Cap ${formatItemValue(budgetCap)} (item value N/A)`;
    }

    if (value <= budgetCap) {
      return `Within ${formatItemValue(budgetCap)} cap`;
    }

    return `Over cap by ${formatItemValue(value - budgetCap)}`;
  }

  function describeWeaponClassScope(weaponClass) {
    if (`${weaponClass || ""}`.trim().toLowerCase() === "dual-wield") {
      return "Dual-Wield uses dedicated dual-wield entries when available and falls back to one-handed entries for broader progression coverage; scoring favors dual-wield entries that are closer to your current weapon skill.";
    }

    return "Recommendations use class-matched weapon entries from the catalog.";
  }

  function describeOwnershipMode(input) {
    const totalOwnedTokens = input.ownership.tokens.size;

    if (input.ownership.onlyOwned) {
      return `Only-owned mode enabled (${totalOwnedTokens} item token${totalOwnedTokens === 1 ? "" : "s"}).`;
    }

    if (input.ownership.onlyOwnedRequested && totalOwnedTokens === 0) {
      return "Only-owned mode was requested but no items were listed, so filtering was skipped.";
    }

    if (totalOwnedTokens > 0) {
      return `Owned items recognized (${totalOwnedTokens} token${totalOwnedTokens === 1 ? "" : "s"}); owned candidates receive a score boost.`;
    }

    return "No owned-item list provided; all eligible items are considered.";
  }

  function describeDataQualityMode(input) {
    if (input.dataQualityMode === "exact-only") {
      return "Exact-only mode enabled; estimated catalog entries are excluded.";
    }

    return "Mixed mode enabled; both exact and estimated entries are eligible.";
  }

  function describeOptimizationRules(input) {
    const budgetCap = input?.optimization?.budgetCap;
    const strictBudgetCap = Boolean(input?.optimization?.strictBudgetCap);
    const avoidCount = input?.optimization?.avoidTokens?.size || 0;
    const minDpsFloor = Number(input?.optimization?.minDpsFloor);
    const minDamageReductionFloor = Number(input?.optimization?.minDamageReductionFloor);
    const minBonusHpFloor = Number(input?.optimization?.minBonusHpFloor);
    const segments = [];

    if (Number.isFinite(budgetCap) && budgetCap > 0) {
      segments.push(`${strictBudgetCap ? "strict" : "soft"} budget cap ${formatItemValue(budgetCap)}`);
    }

    if (avoidCount > 0) {
      segments.push(`${avoidCount} avoided item token${avoidCount === 1 ? "" : "s"}`);
    }

    if (Number.isFinite(minDpsFloor) && minDpsFloor > 0) {
      segments.push(`min DPS ${round(minDpsFloor, 1)}`);
    }

    if (Number.isFinite(minDamageReductionFloor) && minDamageReductionFloor > 0) {
      segments.push(`min DR ${round(minDamageReductionFloor, 1)}`);
    }

    if (Number.isFinite(minBonusHpFloor) && minBonusHpFloor > 0) {
      segments.push(`min HP+ ${round(minBonusHpFloor, 1)}`);
    }

    if (!segments.length) {
      return "No budget cap or avoid-list filters active.";
    }

    return `${segments.join("; ")}.`;
  }

  function describeAllocationMode(allocationMode) {
    const mode = normalizeAllocationMode(allocationMode, "adaptive");

    if (mode === "aggressive") {
      return "Aggressive damage profile (leans STR/AGI, lower spread penalty).";
    }

    if (mode === "defensive") {
      return "Defensive core profile (leans DEF/VIT, stronger share correction).";
    }

    if (mode === "tempo") {
      return "Tempo + utility profile (leans AGI/LUK for cadence and farming flow).";
    }

    return "Adaptive profile (balanced hybrid based on weapon class + playstyle).";
  }

  function describeCalibrationState(state) {
    const sampleCount = state?.sampleCount || 0;
    if (!sampleCount) {
      return "No samples yet; baseline multipliers (x1.0) are active.";
    }

    const factors = state?.factors || DEFAULT_CALIBRATION_FACTORS;
    const strongest = CALIBRATION_METRICS.map((metric) => ({
      label: metric.label,
      factor: Number(factors[metric.key]) || 1,
    })).sort((a, b) => Math.abs(b.factor - 1) - Math.abs(a.factor - 1))[0];

    return `${sampleCount} sample${sampleCount === 1 ? "" : "s"} applied; strongest adjustment: ${strongest.label} x${round(
      strongest.factor,
      3,
    )}.`;
  }

  function collectFormSnapshot() {
    const formData = new FormData(form);

    return {
      currentLevel: String(formData.get("currentLevel") || ""),
      levelsToPlan: String(formData.get("levelsToPlan") || ""),
      maxFloorReached: String(formData.get("maxFloorReached") || ""),
      weaponClass: String(formData.get("weaponClass") || "two-handed"),
      playstyle: String(formData.get("playstyle") || "balanced"),
      allocationMode: String(formData.get("allocationMode") || "adaptive"),
      budgetCap: String(formData.get("budgetCap") || ""),
      strictBudgetCap: formData.has("strictBudgetCap"),
      avoidItems: String(formData.get("avoidItems") || ""),
      minDpsFloor: String(formData.get("minDpsFloor") || ""),
      minDamageReductionFloor: String(formData.get("minDamageReductionFloor") || ""),
      minBonusHpFloor: String(formData.get("minBonusHpFloor") || ""),
      str: String(formData.get("str") || "0"),
      def: String(formData.get("def") || "0"),
      agi: String(formData.get("agi") || "0"),
      vit: String(formData.get("vit") || "0"),
      luk: String(formData.get("luk") || "0"),
      gearAttack: String(formData.get("gearAttack") || "1"),
      gearDefense: String(formData.get("gearDefense") || "0"),
      gearDexterity: String(formData.get("gearDexterity") || "0"),
      weaponSkill: String(formData.get("weaponSkill") || "1"),
      itemPoolMode: String(formData.get("itemPoolMode") || "standard"),
      dataQualityMode: String(formData.get("dataQualityMode") || "exact-only"),
      gearSortMode: String(formData.get("gearSortMode") || "score"),
      buildName: String(formData.get("buildName") || ""),
      ownedItems: String(formData.get("ownedItems") || ""),
      onlyOwned: formData.has("onlyOwned"),
      autoSyncGearTotals: formData.has("autoSyncGearTotals"),
      autoAddOwnedOnEquip: formData.has("autoAddOwnedOnEquip"),
    };
  }

  function snapshotToPlannerInput(snapshot) {
    const ownedItemsRaw = `${snapshot?.ownedItems || ""}`;
    const ownedItemTokens = parseOwnedTokens(ownedItemsRaw);
    const onlyOwnedRequested = parseBoolean(snapshot?.onlyOwned);
    const avoidItemsRaw = `${snapshot?.avoidItems || ""}`;
    const avoidTokens = parseOwnedTokens(avoidItemsRaw);
    const budgetCapRaw = parseOptionalNumber(snapshot?.budgetCap);
    const budgetCap = Number.isFinite(budgetCapRaw) && budgetCapRaw >= 0 ? budgetCapRaw : null;
    const strictBudgetCap = parseBoolean(snapshot?.strictBudgetCap);
    const minDpsFloorRaw = parseOptionalNumber(snapshot?.minDpsFloor);
    const minDamageReductionFloorRaw = parseOptionalNumber(snapshot?.minDamageReductionFloor);
    const minBonusHpFloorRaw = parseOptionalNumber(snapshot?.minBonusHpFloor);
    const minDpsFloor = Number.isFinite(minDpsFloorRaw) && minDpsFloorRaw >= 0 ? minDpsFloorRaw : null;
    const minDamageReductionFloor =
      Number.isFinite(minDamageReductionFloorRaw) && minDamageReductionFloorRaw >= 0 ? minDamageReductionFloorRaw : null;
    const minBonusHpFloor = Number.isFinite(minBonusHpFloorRaw) && minBonusHpFloorRaw >= 0 ? minBonusHpFloorRaw : null;
    const hasSavedFloor = typeof snapshot?.maxFloorReached !== "undefined" && `${snapshot.maxFloorReached}`.trim() !== "";
    const maxFloorFallback = hasSavedFloor ? 2 : MAX_CATALOG_FLOOR;

    const input = {
      currentLevel: clamp(toInt(snapshot?.currentLevel, 8), 1, 1000),
      levelsToPlan: clamp(toInt(snapshot?.levelsToPlan, 40), 1, 200),
      maxFloorReached: clamp(toInt(snapshot?.maxFloorReached, maxFloorFallback), 1, MAX_CATALOG_FLOOR),
      weaponClass: String(snapshot?.weaponClass || "two-handed"),
      playstyle: String(snapshot?.playstyle || "balanced"),
      allocationMode: normalizeAllocationMode(snapshot?.allocationMode, "adaptive"),
      weaponSkill: clamp(toInt(snapshot?.weaponSkill, 25), 1, 10000),
      itemPoolMode: String(snapshot?.itemPoolMode || "standard"),
      dataQualityMode: normalizeDataQualityMode(snapshot?.dataQualityMode, "exact-only"),
      gearSortMode: String(snapshot?.gearSortMode || "score"),
      ownership: {
        rawInput: ownedItemsRaw,
        tokens: ownedItemTokens,
        onlyOwnedRequested,
        onlyOwned: onlyOwnedRequested && ownedItemTokens.size > 0,
      },
      optimization: {
        budgetCap,
        strictBudgetCap,
        avoidItemsRaw,
        avoidTokens,
        minDpsFloor,
        minDamageReductionFloor,
        minBonusHpFloor,
      },
      qol: {
        autoSyncGearTotals: parseBoolean(snapshot?.autoSyncGearTotals ?? true),
        autoAddOwnedOnEquip: parseBoolean(snapshot?.autoAddOwnedOnEquip ?? true),
      },
      stats: {
        str: clamp(toInt(snapshot?.str, 14), 0, data.statCap),
        def: clamp(toInt(snapshot?.def, 0), 0, data.statCap),
        agi: clamp(toInt(snapshot?.agi, 3), 0, data.statCap),
        vit: clamp(toInt(snapshot?.vit, 7), 0, data.statCap),
        luk: clamp(toInt(snapshot?.luk, 0), 0, data.statCap),
      },
      gear: {
        attack: Math.max(1, toNumber(snapshot?.gearAttack, 30)),
        defense: Math.max(0, toNumber(snapshot?.gearDefense, 35)),
        dexterity: Math.max(0, toNumber(snapshot?.gearDexterity, 140)),
      },
    };

    return input;
  }

  function applyFormSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;

    const setField = (name, value) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return;

      if (field.type === "checkbox") {
        field.checked = parseBoolean(value);
      } else {
        field.value = `${value ?? ""}`;
      }
    };

    setField("currentLevel", snapshot.currentLevel);
    setField("levelsToPlan", snapshot.levelsToPlan);
    setField("maxFloorReached", snapshot.maxFloorReached);
    setField("weaponClass", snapshot.weaponClass);
    setField("playstyle", snapshot.playstyle);
    setField("allocationMode", snapshot.allocationMode);
    setField("budgetCap", snapshot.budgetCap);
    setField("strictBudgetCap", snapshot.strictBudgetCap);
    setField("avoidItems", snapshot.avoidItems);
    setField("minDpsFloor", snapshot.minDpsFloor);
    setField("minDamageReductionFloor", snapshot.minDamageReductionFloor);
    setField("minBonusHpFloor", snapshot.minBonusHpFloor);
    setField("str", snapshot.str);
    setField("def", snapshot.def);
    setField("agi", snapshot.agi);
    setField("vit", snapshot.vit);
    setField("luk", snapshot.luk);
    setField("gearAttack", snapshot.gearAttack);
    setField("gearDefense", snapshot.gearDefense);
    setField("gearDexterity", snapshot.gearDexterity);
    setField("weaponSkill", snapshot.weaponSkill);
    setField("itemPoolMode", snapshot.itemPoolMode);
    setField("dataQualityMode", snapshot.dataQualityMode);
    setField("ownedItems", snapshot.ownedItems);
    setField("onlyOwned", snapshot.onlyOwned);
    setField("autoSyncGearTotals", snapshot.autoSyncGearTotals);
    setField("autoAddOwnedOnEquip", snapshot.autoAddOwnedOnEquip);
  }

  function getSelectedOrTypedPresetName() {
    const typed = presetNameInput ? String(presetNameInput.value || "").trim() : "";
    const selected = savedBuildSelect ? String(savedBuildSelect.value || "").trim() : "";
    return typed || selected;
  }

  function handleTogglePresetPin() {
    const storage = readBuildStorage();
    const requestedName = getSelectedOrTypedPresetName();

    if (!requestedName) {
      showBuildActionMessage("Select or type a preset name to pin.", "error");
      return;
    }

    const resolvedName = resolvePresetName(storage, requestedName);
    if (!resolvedName) {
      showBuildActionMessage(`Preset "${requestedName}" does not exist yet. Save it first, then pin.`, "error");
      return;
    }

    if (pinnedPresetNames.has(resolvedName)) {
      pinnedPresetNames.delete(resolvedName);
      writePinnedPresetStorage(pinnedPresetNames);
      refreshSavedBuildOptions(resolvedName);
      showBuildActionMessage(`Unpinned preset "${resolvedName}".`, "success");
      return;
    }

    pinnedPresetNames.add(resolvedName);
    writePinnedPresetStorage(pinnedPresetNames);
    refreshSavedBuildOptions(resolvedName);
    showBuildActionMessage(`Pinned preset "${resolvedName}".`, "success");
  }

  function handleShowPinnedOnlyChange() {
    writePresetFilterPreference(Boolean(showPinnedOnlyField?.checked));
    refreshSavedBuildOptions();
  }

  function resolvePresetName(storage, requestedName) {
    const exact = `${requestedName || ""}`.trim();
    if (!exact) return "";
    if (storage[exact]) return exact;

    const target = exact.toLowerCase();
    return Object.keys(storage).find((name) => name.toLowerCase() === target) || "";
  }

  function refreshPresetPinButtonState(selectedName = "") {
    if (!togglePresetPinBtn) return;

    const storage = readBuildStorage();
    const requestedName =
      `${selectedName || ""}`.trim() ||
      (savedBuildSelect ? `${savedBuildSelect.value || ""}`.trim() : "") ||
      (presetNameInput ? `${presetNameInput.value || ""}`.trim() : "");

    const resolvedName = resolvePresetName(storage, requestedName);
    if (!resolvedName) {
      togglePresetPinBtn.disabled = true;
      togglePresetPinBtn.textContent = "Pin Selected";
      return;
    }

    togglePresetPinBtn.disabled = false;
    togglePresetPinBtn.textContent = pinnedPresetNames.has(resolvedName) ? "Unpin Selected" : "Pin Selected";
  }

  function prunePinnedPresetNames(storage) {
    let changed = false;
    const currentNames = new Set(Object.keys(storage));

    Array.from(pinnedPresetNames).forEach((name) => {
      if (currentNames.has(name)) return;
      pinnedPresetNames.delete(name);
      changed = true;
    });

    if (changed) {
      writePinnedPresetStorage(pinnedPresetNames);
    }
  }

  function getOrderedPresetNames(storage, pinnedOnly = false) {
    const names = Object.keys(storage);
    const filtered = pinnedOnly ? names.filter((name) => pinnedPresetNames.has(name)) : names;

    return filtered.sort((a, b) => {
      const aPinned = pinnedPresetNames.has(a) ? 0 : 1;
      const bPinned = pinnedPresetNames.has(b) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return a.localeCompare(b);
    });
  }

  function getPresetOptionLabel(name) {
    return pinnedPresetNames.has(name) ? `★ ${name}` : name;
  }

  function refreshSavedBuildOptions(selectedName = "") {
    if (!savedBuildSelect) return;

    const currentSelection = selectedName || String(savedBuildSelect.value || "");
    const compareSelectionA = compareBuildASelect ? String(compareBuildASelect.value || "") : "";
    const compareSelectionB = compareBuildBSelect ? String(compareBuildBSelect.value || "") : "";
    const storage = readBuildStorage();
    prunePinnedPresetNames(storage);
    const allNames = getOrderedPresetNames(storage, false);
    const names = getOrderedPresetNames(storage, Boolean(showPinnedOnlyField?.checked));

    savedBuildSelect.innerHTML = "";

    if (!names.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = allNames.length && showPinnedOnlyField?.checked ? "No pinned builds" : "No saved builds";
      savedBuildSelect.appendChild(option);
      refreshComparisonOptions(allNames, compareSelectionA, compareSelectionB);
      refreshPresetPinButtonState(currentSelection);
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select saved build";
    savedBuildSelect.appendChild(placeholder);

    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = getPresetOptionLabel(name);
      if (name === currentSelection) option.selected = true;
      savedBuildSelect.appendChild(option);
    });

    refreshComparisonOptions(allNames, compareSelectionA, compareSelectionB);
    refreshPresetPinButtonState(currentSelection);
  }

  function refreshComparisonOptions(names, selectedA = "", selectedB = "") {
    if (!compareBuildASelect || !compareBuildBSelect) return;

    const applyOptions = (targetSelect, selectedValue) => {
      targetSelect.innerHTML = "";

      if (!names.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No saved builds";
        targetSelect.appendChild(option);
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select build";
      targetSelect.appendChild(placeholder);

      names.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = getPresetOptionLabel(name);
        if (name === selectedValue) option.selected = true;
        targetSelect.appendChild(option);
      });
    };

    applyOptions(compareBuildASelect, selectedA);
    applyOptions(compareBuildBSelect, selectedB);
  }

  function readBuildStorage() {
    try {
      const raw = localStorage.getItem(BUILD_STORAGE_KEY);
      if (!raw) return {};

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return parsed;
    } catch (_error) {
      return {};
    }
  }

  function readPinnedPresetStorage() {
    try {
      const raw = localStorage.getItem(PINNED_PRESETS_STORAGE_KEY);
      if (!raw) return new Set();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();

      return new Set(
        parsed
          .map((name) => `${name || ""}`.trim())
          .filter(Boolean),
      );
    } catch (_error) {
      return new Set();
    }
  }

  function writePinnedPresetStorage(set) {
    try {
      localStorage.setItem(PINNED_PRESETS_STORAGE_KEY, JSON.stringify(Array.from(set).sort((a, b) => a.localeCompare(b))));
    } catch (_error) {
      showBuildActionMessage("Could not save pinned preset data (storage unavailable).", "error");
    }
  }

  function readPresetFilterPreference() {
    try {
      const raw = localStorage.getItem(PRESET_FILTER_STORAGE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      return parseBoolean(parsed?.showPinnedOnly);
    } catch (_error) {
      return false;
    }
  }

  function writePresetFilterPreference(showPinnedOnly) {
    try {
      localStorage.setItem(PRESET_FILTER_STORAGE_KEY, JSON.stringify({ showPinnedOnly: Boolean(showPinnedOnly) }));
    } catch (_error) {
      // Ignore filter preference persistence failures quietly.
    }
  }

  function readFormDraft() {
    try {
      const raw = localStorage.getItem(FORM_DRAFT_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function writeFormDraft(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;

    try {
      localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_error) {
      // Ignore draft persistence failures quietly.
    }
  }

  function createDefaultEquippedState() {
    return {
      slots: {
        weapon: "",
        armor: "",
        upper: "",
        lower: "",
        shield: "",
      },
      updatedAt: "",
    };
  }

  function normalizeEquippedState(rawState) {
    if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
      return null;
    }

    const fallback = createDefaultEquippedState();
    const normalizedSlots = { ...fallback.slots };

    Object.keys(normalizedSlots).forEach((slot) => {
      const value = `${rawState?.slots?.[slot] || ""}`.trim();
      normalizedSlots[slot] = value;
    });

    return {
      slots: normalizedSlots,
      updatedAt: `${rawState.updatedAt || ""}`,
    };
  }

  function readEquippedStorage() {
    const fallback = createDefaultEquippedState();

    try {
      const raw = localStorage.getItem(EQUIPPED_STORAGE_KEY);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);
      return normalizeEquippedState(parsed) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeEquippedStorage(state) {
    try {
      localStorage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      showEquippedMessage("Could not save equipped loadout (storage unavailable).", "error");
    }
  }

  function createDefaultCalibrationState() {
    return {
      sampleCount: 0,
      factors: { ...DEFAULT_CALIBRATION_FACTORS },
      updatedAt: "",
      lastSample: null,
    };
  }

  function normalizeCalibrationState(rawState) {
    if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
      return null;
    }

    const factors = { ...DEFAULT_CALIBRATION_FACTORS };
    Object.keys(factors).forEach((key) => {
      const value = Number(rawState?.factors?.[key]);
      if (Number.isFinite(value) && value > 0) {
        factors[key] = clamp(value, CALIBRATION_FACTOR_MIN, CALIBRATION_FACTOR_MAX);
      }
    });

    const sampleCount = Math.max(0, toInt(rawState.sampleCount, 0));
    const lastSampleMetrics = Array.isArray(rawState?.lastSample?.metrics)
      ? rawState.lastSample.metrics
          .map((entry) => ({
            key: String(entry?.key || ""),
            label: String(entry?.label || ""),
            observed: Number(entry?.observed),
            predictedRaw: Number(entry?.predictedRaw),
            ratio: Number(entry?.ratio),
            errorPct: Number(entry?.errorPct),
          }))
          .filter((entry) => {
            return (
              entry.key &&
              entry.label &&
              Number.isFinite(entry.observed) &&
              Number.isFinite(entry.predictedRaw) &&
              Number.isFinite(entry.ratio) &&
              Number.isFinite(entry.errorPct)
            );
          })
      : [];

    return {
      sampleCount,
      factors,
      updatedAt: String(rawState.updatedAt || ""),
      lastSample:
        rawState?.lastSample && lastSampleMetrics.length
          ? {
              capturedAt: String(rawState.lastSample.capturedAt || ""),
              projectedLevel: toInt(rawState.lastSample.projectedLevel, 0),
              metrics: lastSampleMetrics,
            }
          : null,
    };
  }

  function readCalibrationStorage() {
    const fallback = createDefaultCalibrationState();

    try {
      const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);
      return normalizeCalibrationState(parsed) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeCalibrationStorage(state) {
    try {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {
      showCalibrationMessage("Could not save calibration data (storage unavailable).", "error");
    }
  }

  function writeBuildStorage(storage) {
    try {
      localStorage.setItem(BUILD_STORAGE_KEY, JSON.stringify(storage));
    } catch (_error) {
      showBuildActionMessage("Could not save build presets (storage unavailable).", "error");
    }
  }

  function showBuildActionMessage(message, kind = "info") {
    if (!buildActionMessage) return;

    buildActionMessage.textContent = message;
    buildActionMessage.className = `build-action-message ${kind}`;
  }

  function showCompareMessage(message, kind = "info") {
    if (!compareMessage) return;

    compareMessage.textContent = message;
    compareMessage.className = `build-action-message ${kind}`;
  }

  function showCalibrationMessage(message, kind = "info") {
    if (!calibrationMessage) return;

    calibrationMessage.textContent = message;
    calibrationMessage.className = `build-action-message ${kind}`;
  }

  function showEquippedMessage(message, kind = "info") {
    if (!equippedMessage) return;

    equippedMessage.textContent = message;
    equippedMessage.className = `build-action-message ${kind}`;
  }

  function showOutputActionMessage(message, kind = "info") {
    if (!outputActionMessage) return;

    outputActionMessage.textContent = message;
    outputActionMessage.className = `build-action-message ${kind}`;
  }

  function slugify(value) {
    const base = `${value || "build"}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return base || "sbo-rebirth-build";
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_error) {
        // Fallback below.
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return Boolean(copied);
    } catch (_error) {
      return false;
    }
  }

  function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off", ""].includes(normalized)) return false;
    }
    return Boolean(value);
  }

  function normalizeDataQualityMode(value, fallback = "exact-only") {
    const normalized = `${value || ""}`.trim().toLowerCase();
    if (VALID_DATA_QUALITY_MODES.includes(normalized)) {
      return normalized;
    }

    return VALID_DATA_QUALITY_MODES.includes(fallback) ? fallback : "exact-only";
  }

  function normalizeAllocationMode(value, fallback = "adaptive") {
    const normalized = `${value || ""}`.trim().toLowerCase();
    if (VALID_ALLOCATION_MODES.includes(normalized)) {
      return normalized;
    }

    return VALID_ALLOCATION_MODES.includes(fallback) ? fallback : "adaptive";
  }

  function parseOptionalNumber(value) {
    const text = `${value ?? ""}`.trim();
    if (!text) return null;

    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function numericDelta(a, b, digits = 0) {
    const delta = b - a;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${round(delta, digits)}`;
  }

  // ── Skill Unlock Checklist ────────────────────────────────────────────────
  function renderSkillChecklist(input) {
    const container = document.getElementById("skillChecklist");
    if (!container) return;

    const unlocks = data.swordSkillUnlocks;
    if (!unlocks) {
      container.innerHTML = `<p class="muted-text">No skill data available.</p>`;
      return;
    }

    const classKey = input.weaponClass;
    const skills = unlocks[classKey];
    if (!skills || !skills.length) {
      container.innerHTML = `<p class="muted-text">No skill unlock data for this weapon class.</p>`;
      return;
    }

    const currentSkill = input.weaponSkill || 1;

    const rows = skills.map((entry, idx) => {
      const unlocked = currentSkill >= entry.skill;
      const nextLocked = !unlocked && (idx === 0 || currentSkill >= skills[idx - 1].skill);
      const stateClass = unlocked ? "sc-unlocked" : nextLocked ? "sc-next" : "sc-locked";
      const icon = unlocked ? "✓" : nextLocked ? "→" : "○";
      const needed = unlocked ? "" : `<span class="sc-needed">need ${entry.skill - currentSkill} more skill</span>`;
      return `<div class="sc-row ${stateClass}">
        <span class="sc-icon">${icon}</span>
        <span class="sc-req">Skill ${entry.skill}</span>
        <span class="sc-names">${escapeHtml(entry.name)}</span>
        ${needed}
      </div>`;
    });

    const unlockedCount = skills.filter(e => currentSkill >= e.skill).length;
    container.innerHTML = `
      <div class="sc-header">
        <span class="sc-progress-label">${unlockedCount} / ${skills.length} tiers unlocked</span>
        <div class="sc-progress-bar"><div class="sc-progress-fill" style="width:${Math.round(unlockedCount/skills.length*100)}%"></div></div>
      </div>
      <div class="sc-list">${rows.join("")}</div>`;
  }

  // ── Party Role Advisor ────────────────────────────────────────────────────
  function renderPartyRoleAdvisor(input, planResult) {
    const container = document.getElementById("partyRoleAdvisor");
    if (!container) return;

    const fsRaw = planResult.finalStats || {};
    const fs = { STR: fsRaw.str || 0, DEF: fsRaw.def || 0, AGI: fsRaw.agi || 0, VIT: fsRaw.vit || 0, LUK: fsRaw.luk || 0 };
    const weaponClass = input.weaponClass || "two-handed";
    const playstyle = input.playstyle || "balanced";

    const ROLES = [
      {
        id: "dps",
        label: "DPS",
        icon: "⚔",
        desc: "Maximise damage output. Your party relies on you to clear mobs and deal boss damage.",
        priorities: ["STR", "AGI", "LUK"],
        tips: [
          "Prioritise STR for raw damage scaling (+0.4% per point).",
          "AGI lowers sword skill cooldowns — key for burst windows.",
          "LUK adds crit chance and multi-hit probability.",
          "Keep DEF/VIT minimal — let your tank absorb hits.",
        ],
        gearFocus: "Highest ATK weapon available. Prioritise crafted/boss sources.",
        warningIf: (s) => s.DEF > s.STR * 0.6 ? "You have high DEF for a DPS role — consider rebalancing toward STR/AGI." : null,
      },
      {
        id: "tank",
        label: "Tank",
        icon: "🛡",
        desc: "Absorb damage and hold aggro. Your party needs you to survive burst hits.",
        priorities: ["DEF", "VIT", "STR"],
        tips: [
          "DEF multiplies your armor's flat damage reduction — stack it.",
          "VIT multiplies DEX from gear into bonus HP — essential for survivability.",
          "Keep enough STR to hold threat and deal meaningful damage.",
          "AGI/LUK are low priority — survivability first.",
        ],
        gearFocus: "Highest DEF armor + shield. Prioritise boss/crafted sources.",
        warningIf: (s) => s.DEF < 80 ? "DEF is low for a tank role — aim for at least 80–100 DEF by mid-game." : null,
      },
      {
        id: "support",
        label: "Support",
        icon: "✦",
        desc: "Buff allies, debuff enemies, and sustain the party. Flexibility over raw stats.",
        priorities: ["AGI", "VIT", "LUK"],
        tips: [
          "AGI improves your action speed and sword skill cadence.",
          "VIT gives you survivability to stay in fights longer.",
          "LUK increases drop rates — great for farming support.",
          "You don't need max STR — focus on staying alive and acting fast.",
        ],
        gearFocus: "Balanced gear across all slots. Prioritise DEX-heavy headwear for HP.",
        warningIf: (s) => s.AGI < 40 ? "AGI is low for a support role — faster actions help your team more." : null,
      },
      {
        id: "farmer",
        label: "Farmer",
        icon: "💰",
        desc: "Maximise drop rates and clear speed for efficient Col and item farming.",
        priorities: ["LUK", "AGI", "STR"],
        tips: [
          "LUK directly increases drop chance from enemies — stack it.",
          "AGI speeds up clears — more mobs per minute = more drops.",
          "STR ensures you one-shot or two-shot mobs efficiently.",
          "DEF/VIT only as needed to survive the floor you're farming.",
        ],
        gearFocus: "Weapon with highest ATK for your skill level. Mob-drop gear is fine.",
        warningIf: (s) => s.LUK < 30 ? "LUK is low for a farmer — aim for 50+ LUK to meaningfully boost drop rates." : null,
      },
    ];

    // Determine best-fit role based on current stat allocation
    const total = Object.values(fs).reduce((a, b) => a + b, 0) || 1;
    const strShare = (fs.STR || 0) / total;
    const defShare = (fs.DEF || 0) / total;
    const agiShare = (fs.AGI || 0) / total;
    const lukShare = (fs.LUK || 0) / total;

    let bestFitId = "dps";
    if (defShare > 0.28) bestFitId = "tank";
    else if (lukShare > 0.22) bestFitId = "farmer";
    else if (agiShare > 0.25 && strShare < 0.35) bestFitId = "support";
    else bestFitId = "dps";

    const cards = ROLES.map((role) => {
      const isBestFit = role.id === bestFitId;
      const warning = role.warningIf(fs);
      const priorityBadges = role.priorities.map(s => {
        const val = fs[s] || 0;
        const pct = Math.round(val / (total || 1) * 100);
        return `<span class="pra-stat-badge pra-stat-${s.toLowerCase()}">${s} ${val} <span class="pra-pct">${pct}%</span></span>`;
      }).join("");

      const tipItems = role.tips.map(t => `<li>${escapeHtml(t)}</li>`).join("");

      return `<div class="pra-card${isBestFit ? " pra-best-fit" : ""}">
        <div class="pra-card-header">
          <span class="pra-icon">${role.icon}</span>
          <span class="pra-label">${escapeHtml(role.label)}</span>
          ${isBestFit ? `<span class="pra-fit-badge">Best fit for your build</span>` : ""}
        </div>
        <p class="pra-desc">${escapeHtml(role.desc)}</p>
        <div class="pra-stats">${priorityBadges}</div>
        <ul class="pra-tips">${tipItems}</ul>
        <div class="pra-gear"><strong>Gear focus:</strong> ${escapeHtml(role.gearFocus)}</div>
        ${warning ? `<div class="pra-warning">${escapeHtml(warning)}</div>` : ""}
      </div>`;
    });

    container.innerHTML = `<div class="pra-grid">${cards.join("")}</div>`;
  }

  function initializeQuickPresets() {
    if (!quickPresetGrid) return;

    quickPresetGrid.innerHTML = QUICK_PRESETS.map((preset, idx) =>
      `<button type="button" class="quick-preset-btn" data-preset-idx="${idx}">
        <span class="qp-name">${escapeHtml(preset.name)}</span>
        <span class="qp-desc">${escapeHtml(preset.desc)}</span>
      </button>`,
    ).join("");

    quickPresetGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".quick-preset-btn");
      if (!btn) return;
      const idx = toInt(btn.dataset.presetIdx, -1);
      if (idx < 0 || idx >= QUICK_PRESETS.length) return;
      const preset = QUICK_PRESETS[idx];
      applyFormSnapshot(preset.snapshot);
      showBuildActionMessage(`Loaded template: ${preset.name}`, "success");
    });
  }

  function renderChangelog() {
    if (!changelogPanelEl) return;
    changelogPanelEl.innerHTML = CHANGELOG.map((entry) => `
      <div class="changelog-entry">
        <div class="changelog-version">${escapeHtml(entry.version)}</div>
        <ul class="changelog-items">
          ${entry.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
        </ul>
      </div>
    `).join("");
  }

  function initializeStatCapWarnings() {
    if (!form) return;
    const statInputs = STAT_KEYS.map((k) => form.querySelector(`[name="${k}"]`)).filter(Boolean);

    function updateWarnings() {
      statInputs.forEach((input) => {
        const val = toInt(input.value, 0);
        input.classList.toggle("stat-cap-maxed", val >= data.statCap);
        input.classList.toggle("stat-cap-warn", val >= data.statCap - 10 && val < data.statCap);
      });
    }

    updateWarnings();
    form.addEventListener("input", updateWarnings);
  }

  function readFloorTrackerStorage() {
    try {
      const raw = localStorage.getItem(FLOOR_TRACKER_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((n) => Number.isInteger(n) && n >= 1 && n <= FLOOR_TRACKER_MAX));
    } catch (_e) {
      return new Set();
    }
  }

  function writeFloorTrackerStorage(clearedSet) {
    try {
      localStorage.setItem(FLOOR_TRACKER_STORAGE_KEY, JSON.stringify(Array.from(clearedSet).sort((a, b) => a - b)));
    } catch (_e) {}
  }

  function renderFloorTracker(clearedFloors) {
    if (!floorTrackerEl) return;

    const cells = [];
    for (let f = 1; f <= FLOOR_TRACKER_MAX; f++) {
      const cleared = clearedFloors.has(f);
      cells.push(
        `<button type="button" class="floor-tracker-cell${cleared ? " cleared" : ""}" data-floor="${f}" aria-pressed="${cleared}" title="Floor ${f}${cleared ? " — Cleared" : ""}">
          <span class="ft-num">F${f}</span>
          <span class="ft-check">✓</span>
        </button>`,
      );
    }
    floorTrackerEl.innerHTML = cells.join("");

    if (floorTrackerSummary) {
      const count = clearedFloors.size;
      if (count === 0) {
        floorTrackerSummary.textContent = "No floors cleared yet. Click a floor to mark it.";
      } else if (count === FLOOR_TRACKER_MAX) {
        floorTrackerSummary.innerHTML = `<strong>All ${FLOOR_TRACKER_MAX} floors cleared!</strong> 🎉`;
      } else {
        const highest = Math.max(...clearedFloors);
        floorTrackerSummary.innerHTML = `<strong>${count}</strong> of ${FLOOR_TRACKER_MAX} floors cleared — highest: <strong>Floor ${highest}</strong>`;
      }
    }
  }

  function initializeFloorTracker() {
    if (!floorTrackerEl) return;

    let clearedFloors = readFloorTrackerStorage();
    renderFloorTracker(clearedFloors);

    floorTrackerEl.addEventListener("click", (e) => {
      const cell = e.target.closest(".floor-tracker-cell");
      if (!cell) return;
      const floor = toInt(cell.dataset.floor, 0);
      if (floor < 1 || floor > FLOOR_TRACKER_MAX) return;

      if (clearedFloors.has(floor)) {
        clearedFloors.delete(floor);
      } else {
        clearedFloors.add(floor);
      }
      writeFloorTrackerStorage(clearedFloors);
      renderFloorTracker(clearedFloors);
    });

    if (ftClearAllBtn) {
      ftClearAllBtn.addEventListener("click", () => {
        clearedFloors = new Set();
        writeFloorTrackerStorage(clearedFloors);
        renderFloorTracker(clearedFloors);
      });
    }

    if (ftMarkToFloorBtn) {
      ftMarkToFloorBtn.addEventListener("click", () => {
        const maxFloor = toInt(form?.querySelector('[name="maxFloorReached"]')?.value, 1);
        const cap = Math.min(Math.max(1, maxFloor), FLOOR_TRACKER_MAX);
        for (let f = 1; f <= cap; f++) clearedFloors.add(f);
        writeFloorTrackerStorage(clearedFloors);
        renderFloorTracker(clearedFloors);
      });
    }
  }

  function toInt(value, fallback = 0) {
    const num = Number.parseInt(`${value}`, 10);
    return Number.isFinite(num) ? num : fallback;
  }

  function toNumber(value, fallback = 0) {
    const num = Number.parseFloat(`${value}`);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function escapeHtml(value) {
    return `${value}`.replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[char];
    });
  }

  function makeSyntheticInput(overrides) {
    const base = {
      currentLevel: 1,
      levelsToPlan: 47,
      maxFloorReached: 5,
      weaponClass: "two-handed",
      playstyle: "balanced",
      allocationMode: "adaptive",
      weaponSkill: 1,
      itemPoolMode: "standard",
      dataQualityMode: "exact-only",
      ownership: { rawInput: "", tokens: new Set(), onlyOwnedRequested: false, onlyOwned: false },
      optimization: {
        budgetCap: null,
        strictBudgetCap: false,
        avoidItems: "",
        avoidTokens: new Set(),
        minDpsFloor: null,
        minDamageReductionFloor: null,
        minBonusHpFloor: null,
      },
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      gear: { attack: 3, defense: 0.5, dexterity: 3 },
    };
    const merged = { ...base, ...overrides };
    if (overrides?.stats) merged.stats = { ...base.stats, ...overrides.stats };
    return merged;
  }

  function runDeterminismTest() {
    const input1 = makeSyntheticInput({ currentLevel: 1, levelsToPlan: 47 });
    const plan1 = buildLevelPlan(input1);
    const row30 = (plan1.rows || []).find((r) => r.level === 30);
    if (!row30) {
      return { pass: false, error: "Plan 1 has no row for level 30" };
    }
    const input2 = makeSyntheticInput({
      currentLevel: 30,
      levelsToPlan: 18,
      stats: { ...row30.totals },
    });
    const plan2 = buildLevelPlan(input2);
    const rows1_31_48 = (plan1.rows || []).filter((r) => r.level >= 31 && r.level <= 48);
    const rows2 = plan2.rows || [];
    if (rows2.length !== 18) {
      return { pass: false, error: `Plan 2 has ${rows2.length} rows, expected 18` };
    }
    for (let i = 0; i < rows1_31_48.length; i += 1) {
      const r1 = rows1_31_48[i];
      const r2 = rows2[i];
      if (!r2 || r1.level !== r2.level) {
        return { pass: false, error: `Level mismatch at index ${i}: ${r1?.level} vs ${r2?.level}` };
      }
      const keys = ["str", "def", "agi", "vit", "luk"];
      for (const k of keys) {
        if ((r1.added?.[k] ?? 0) !== (r2.added?.[k] ?? 0)) {
          return {
            pass: false,
            error: `Level ${r1.level} ${k} added: ${r1.added?.[k]} vs ${r2.added?.[k]}`,
          };
        }
      }
    }
    return { pass: true };
  }

  if (typeof window !== "undefined") {
    window.__sboRunDeterminismTest = runDeterminismTest;
  }
})();
