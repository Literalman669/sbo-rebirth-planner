(function bootstrapInventoryPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const INVENTORY_FAVORITES_KEY = "sbo-rebirth-planner.inventory-favorites.v1";
  const LAST_GENERATED_PLAN_KEY = "sbo-rebirth-planner.last-generated-plan.v1";
  const RAW_ITEM_CATALOG = window.SBO_DATA?.itemCatalog || [];
  function isCatalogNoise(item) {
    const name = String(item?.name || "");
    const id = String(item?.id || "");
    if (!name || !id) return true;
    if (name.length > 140) return true;
    if (/\{\{|\[\[|==|Category:/.test(name)) return true;
    if (/^\s*\{+\s*PAGENAME/.test(name)) return true;
    return false;
  }

  const ITEM_CATALOG = RAW_ITEM_CATALOG
    .filter((item) => !isCatalogNoise(item))
    .map((item) => ({
      ...item,
      _idToken: normalizeToken(item.id),
      _nameToken: normalizeToken(item.name),
      _searchHay: normalizeToken(`${item.name} ${item.id} ${item.slot} ${item.weaponClass || ""} ${item.sourceType || ""} ${item.notes || ""}`),
    }));

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function displayName(item) {
    const raw = String(item?.name || "");
    if (raw.length <= 54) return raw;
    return `${raw.slice(0, 54)}...`;
  }


  const els = {
    search: document.getElementById("invSearch"),
    slot: document.getElementById("invSlot"),
    maxFloor: document.getElementById("invMaxFloor"),
    source: document.getElementById("invSource"),
    quality: document.getElementById("invQuality"),
    sort: document.getElementById("invSort"),
    minFloor: document.getElementById("invMinFloor"),
    weaponClass: document.getElementById("invWeaponClass"),
    scaling: document.getElementById("invScaling"),
    atkMin: document.getElementById("invAtkMin"),
    atkMax: document.getElementById("invAtkMax"),
    defMin: document.getElementById("invDefMin"),
    defMax: document.getElementById("invDefMax"),
    dexMin: document.getElementById("invDexMin"),
    dexMax: document.getElementById("invDexMax"),
    colMin: document.getElementById("invColMin"),
    colMax: document.getElementById("invColMax"),
    lvMin: document.getElementById("invLvMin"),
    lvMax: document.getElementById("invLvMax"),
    skMin: document.getElementById("invSkMin"),
    skMax: document.getElementById("invSkMax"),
    notes: document.getElementById("invNotes"),
    hideFreeCol: document.getElementById("invHideFreeCol"),
    resetAdvanced: document.getElementById("invResetAdvanced"),
    ownedOnly: document.getElementById("invOwnedOnly"),
    favoritesOnly: document.getElementById("invFavoritesOnly"),
    markFilteredOwned: document.getElementById("invMarkFilteredOwned"),
    clearFilteredOwned: document.getElementById("invClearFilteredOwned"),
    saveOwned: document.getElementById("invSaveOwned"),
    bulkPaste: document.getElementById("invBulkPaste"),
    mergeBulk: document.getElementById("invMergeBulk"),
    exportOwned: document.getElementById("invExportOwned"),
    copyOwned: document.getElementById("invCopyOwned"),
    prevPageBtn: document.getElementById("invPrevPageBtn"),
    nextPageBtn: document.getElementById("invNextPageBtn"),
    pageInfo: document.getElementById("invPageInfo"),
    list: document.getElementById("invList"),
    slotBreakdown: document.getElementById("invSlotBreakdown"),
    missingSummary: document.getElementById("invMissingSummary"),
    missingList: document.getElementById("invMissingList"),
    plannerGearSummary: document.getElementById("invPlannerGearSummary"),
    plannerGearList: document.getElementById("invPlannerGearList"),
    quickGearSearch: document.getElementById("invQuickGearSearch"),
    quickGearClear: document.getElementById("invQuickGearClear"),
    quickGearResults: document.getElementById("invQuickGearResults"),
    equipTopPicks: document.getElementById("invEquipTopPicks"),
    applyEquippedTotals: document.getElementById("invApplyEquippedTotals"),
    equippedLoadout: document.getElementById("invEquippedLoadout"),
    compareSummary: document.getElementById("invCompareSummary"),
    compareList: document.getElementById("invCompareList"),
    summary: document.getElementById("invSummary"),
    message: document.getElementById("invMessage"),
    themeToggle: document.getElementById("themeToggleBtn"),
  };

  function parseOwnedTokens(raw) {
    const tokens = String(raw || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const set = new Set();
    tokens.forEach((token) => set.add(normalizeToken(token)));
    return set;
  }

  function normalizeToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
  }

  function parseOptionalInt(el) {
    const raw = String(el?.value ?? "").trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }

  function parseOptionalFloat(el) {
    const raw = String(el?.value ?? "").trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function statTotal(item) {
    const a = Number(item?.attack);
    const d = Number(item?.defense);
    const x = Number(item?.dexterity);
    let sum = 0;
    if (Number.isFinite(a)) sum += a;
    if (Number.isFinite(d)) sum += d;
    if (Number.isFinite(x)) sum += x;
    return sum;
  }

  function inNumericRange(value, min, max) {
    if (min == null && max == null) return true;
    if (!Number.isFinite(value)) return false;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
  }

  function getDraft() {
    return state?.getJson(keys.formDraft, {}) || {};
  }

  let draft = getDraft();
  let owned = parseOwnedTokens(draft.ownedItems || "");
  let equipped = state?.getJson(keys.equipped, { slots: {} }) || { slots: {} };
  let favorites = new Set((state?.getJson(INVENTORY_FAVORITES_KEY, []) || []).map((id) => String(id || "")));
  let compareSelected = new Set();
  let currentPage = 1;
  const PAGE_SIZE = 140;
  let ownedRevision = 0;
  let favoritesRevision = 0;
  let filteredCacheKey = "";
  let filteredCacheValue = ITEM_CATALOG;

  function persistFavorites() {
    state?.setJson(INVENTORY_FAVORITES_KEY, Array.from(favorites.values()).sort());
  }

  function setThemeToggle() {
    const btn = els.themeToggle;
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

  function showMessage(text) {
    if (!els.message) return;
    els.message.textContent = text;
  }

  function getFilteredItems() {
    const search = normalizeToken(els.search?.value || "");
    const slot = String(els.slot?.value || "all");
    const maxFloor = Math.max(1, Number(els.maxFloor?.value) || 19);
    const minFloorRaw = parseOptionalInt(els.minFloor);
    const minFloor = minFloorRaw != null ? Math.max(1, minFloorRaw) : null;
    const weaponClass = String(els.weaponClass?.value || "all");
    const scaling = String(els.scaling?.value || "all");
    const atkMin = parseOptionalFloat(els.atkMin);
    const atkMax = parseOptionalFloat(els.atkMax);
    const defMin = parseOptionalFloat(els.defMin);
    const defMax = parseOptionalFloat(els.defMax);
    const dexMin = parseOptionalFloat(els.dexMin);
    const dexMax = parseOptionalFloat(els.dexMax);
    const colMin = parseOptionalInt(els.colMin);
    const colMax = parseOptionalInt(els.colMax);
    const lvMin = parseOptionalInt(els.lvMin);
    const lvMax = parseOptionalInt(els.lvMax);
    const skMin = parseOptionalInt(els.skMin);
    const skMax = parseOptionalInt(els.skMax);
    const notesQ = normalizeToken(els.notes?.value || "");
    const hideFreeCol = Boolean(els.hideFreeCol?.checked);
    const ownedOnly = Boolean(els.ownedOnly?.checked);
    const favoritesOnly = Boolean(els.favoritesOnly?.checked);
    const source = String(els.source?.value || "all");
    const quality = String(els.quality?.value || "all");
    const sort = String(els.sort?.value || "floor-asc");
    const cacheKey = [
      search, slot, maxFloor, minFloor, weaponClass, scaling,
      atkMin, atkMax, defMin, defMax, dexMin, dexMax, colMin, colMax, lvMin, lvMax, skMin, skMax,
      notesQ, hideFreeCol,
      ownedOnly, favoritesOnly, source, quality, sort, ownedRevision, favoritesRevision,
    ].join("|");
    if (cacheKey === filteredCacheKey) return filteredCacheValue;
    const filtered = ITEM_CATALOG.filter((item) => {
      if (slot !== "all" && item.slot !== slot) return false;
      const floor = Number(item.floorMin) || 1;
      if (floor > maxFloor) return false;
      if (minFloor != null && floor < minFloor) return false;
      if (source !== "all" && String(item.sourceType || "") !== source) return false;
      if (quality === "exact" && item.exactStats !== true) return false;
      if (quality === "estimated" && item.exactStats === true) return false;
      if (ownedOnly && !isOwned(item)) return false;
      if (favoritesOnly && !favorites.has(String(item.id))) return false;
      if (weaponClass !== "all") {
        if (slot === "weapon") {
          if (String(item.weaponClass || "") !== weaponClass) return false;
        } else if (slot === "all") {
          if (item.slot === "weapon") {
            if (String(item.weaponClass || "") !== weaponClass) return false;
          } else {
            return false;
          }
        }
      }
      if (scaling !== "all") {
        const st = String(item.scalingType || "fixed");
        if (st !== scaling) return false;
      }
      if (!inNumericRange(Number(item.attack), atkMin, atkMax)) return false;
      if (!inNumericRange(Number(item.defense), defMin, defMax)) return false;
      if (!inNumericRange(Number(item.dexterity), dexMin, dexMax)) return false;
      const col = Number(item.colValue);
      if (hideFreeCol && Number.isFinite(col) && col === 0) return false;
      if (!inNumericRange(col, colMin, colMax)) return false;
      if (!inNumericRange(Number(item.levelReq), lvMin, lvMax)) return false;
      if (!inNumericRange(Number(item.skillReq), skMin, skMax)) return false;
      if (notesQ) {
        const hay = normalizeToken(item.notes || "");
        if (!hay.includes(notesQ)) return false;
      }
      if (!search) return true;
      return item._searchHay.includes(search);
    });
    filtered.sort((a, b) => {
      if (sort === "name-asc") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "name-desc") return String(b.name || "").localeCompare(String(a.name || ""));
      if (sort === "floor-desc") return (Number(b.floorMin) || 1) - (Number(a.floorMin) || 1);
      if (sort === "col-asc") return (Number(a.colValue) || 0) - (Number(b.colValue) || 0);
      if (sort === "col-desc") return (Number(b.colValue) || 0) - (Number(a.colValue) || 0);
      if (sort === "stats-desc") return statTotal(b) - statTotal(a);
      return (Number(a.floorMin) || 1) - (Number(b.floorMin) || 1);
    });
    filteredCacheKey = cacheKey;
    filteredCacheValue = filtered;
    return filtered;
  }

  function isOwned(item) {
    return owned.has(item._idToken) || owned.has(item._nameToken);
  }

  function isOwnedByTokens(item, tokenSet) {
    if (!tokenSet || tokenSet.size === 0) return false;
    return tokenSet.has(item._idToken) || tokenSet.has(item._nameToken);
  }

  function getPlannerContext() {
    const lastPlan = state?.getJson(LAST_GENERATED_PLAN_KEY, null);
    const stats = {
      str: Number(draft.str) || 0,
      def: Number(draft.def) || 0,
      agi: Number(draft.agi) || 0,
      vit: Number(draft.vit) || 0,
      luk: Number(draft.luk) || 0,
    };
    const contextKeyMatches = lastPlan &&
      Number(lastPlan.currentLevel) === (Number(draft.currentLevel) || 1) &&
      Number(lastPlan.levelsToPlan) === (Number(draft.levelsToPlan) || 1) &&
      String(lastPlan.weaponClass || "") === String(draft.weaponClass || "") &&
      String(lastPlan.playstyle || "") === String(draft.playstyle || "") &&
      Number(lastPlan.weaponSkill) === (Number(draft.weaponSkill) || 1);
    const scoringStats = contextKeyMatches && lastPlan.finalStats ? lastPlan.finalStats : stats;
    return {
      currentLevel: Math.max(1, Number(draft.currentLevel) || 1),
      levelsToPlan: Math.max(1, Number(draft.levelsToPlan) || 1),
      maxFloorReached: Math.max(1, Number(draft.maxFloorReached) || Number(els.maxFloor?.value) || 19),
      weaponClass: String(draft.weaponClass || els.weaponClass?.value || "two-handed"),
      weaponSkill: Math.max(1, Number(draft.weaponSkill) || 1),
      playstyle: String(draft.playstyle || "balanced"),
      itemPoolMode: String(draft.itemPoolMode || "standard"),
      dataQualityMode: String(draft.dataQualityMode || "exact-only"),
      gearSortMode: String(draft.gearSortMode || "score"),
      ownership: {
        onlyOwned: Boolean(draft.onlyOwned),
      },
      optimization: {
        budgetCap: Number(draft.budgetCap),
        strictBudgetCap: Boolean(draft.strictBudgetCap),
        avoidTokens: parseOwnedTokens(draft.avoidItems || ""),
      },
      stats: scoringStats,
      currentStats: stats,
      hasGeneratedPlanStats: Boolean(contextKeyMatches && lastPlan.finalStats),
    };
  }

  function getRecommendedSlots(weaponClass) {
    const slots = ["weapon", "armor", "upper", "lower"];
    if (["one-handed", "rapier", "dagger"].includes(weaponClass)) slots.push("shield");
    return slots;
  }

  function isWeaponClassCompatible(itemWeaponClass, requestedWeaponClass) {
    const itemClass = `${itemWeaponClass || ""}`.trim().toLowerCase();
    const requestedClass = `${requestedWeaponClass || ""}`.trim().toLowerCase();
    if (!itemClass || !requestedClass) return false;
    if (requestedClass === "dual-wield") return itemClass === "dual-wield" || itemClass === "one-handed";
    return itemClass === requestedClass;
  }

  function getSlotLabel(slot) {
    return { weapon: "Weapon", armor: "Armor", upper: "Headwear", lower: "Accessory", shield: "Shield" }[slot] || slot;
  }

  function itemStatBlock(item) {
    return {
      attack: Number(item.attack) || 0,
      defense: Number(item.defense) || 0,
      dexterity: Number(item.dexterity) || 0,
    };
  }

  function itemRequirementStatus(item, context) {
    const projectedLevel = context.currentLevel + context.levelsToPlan;
    const levelReq = Number(item.levelReq);
    const skillReq = Number(item.skillReq);
    const misses = [];
    if (item.slot !== "weapon" && Number.isFinite(levelReq) && levelReq > projectedLevel) misses.push(`Lv ${levelReq}`);
    if (Number.isFinite(skillReq) && skillReq > context.weaponSkill) misses.push(`Skill ${skillReq}`);
    if (misses.length) return `Needs ${misses.join(" + ")}`;
    if (item.slot !== "weapon" && Number.isFinite(levelReq) && levelReq > context.currentLevel) return `Planned by Lv ${levelReq}`;
    return "Usable now";
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
    if (Number.isFinite(minValue) && Number.isFinite(maxValue)) return minValue + (maxValue - minValue) * scaleRatio;
    if (Number.isFinite(baseValue)) return baseValue;
    return fallbackValue;
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
    return {
      attack: resolveScaledStatValue(item.attack, item.attackMin, item.attackMax, scaleRatio, attackFallback),
      defense: resolveScaledStatValue(item.defense, item.defenseMin, item.defenseMax, scaleRatio, defenseFallback),
      dexterity: resolveScaledStatValue(item.dexterity, item.dexterityMin, item.dexterityMax, scaleRatio, dexterityFallback),
      projectedLevel,
      weaponSkill,
    };
  }

  function computeItemStatPower(item, statBlock, style, finalStats, weaponClass) {
    const attackPower = Math.log10(1 + statBlock.attack * 10);
    const defensePower = Math.log10(1 + statBlock.defense * 50);
    const dexterityPower = Math.log10(1 + statBlock.dexterity * 3);
    let statPower = 1;
    if (item.slot === "weapon") {
      statPower += attackPower * (0.2 + style.weights.damage * 0.16);
      if (weaponClass === "two-handed") statPower += attackPower * 0.05;
    }
    if (["armor", "upper", "lower", "shield"].includes(item.slot)) {
      const defenseNeed = clamp((35 - finalStats.def) / 35, 0, 1);
      const vitalityNeed = clamp((35 - finalStats.vit) / 35, 0, 1);
      statPower += defensePower * (0.1 + style.weights.survival * 0.18 + defenseNeed * 0.08);
      statPower += dexterityPower * (0.08 + style.weights.survival * 0.12 + vitalityNeed * 0.06);
    }
    return Math.max(1, statPower);
  }

  function computeRequirementFit(item, projectedLevel, weaponSkill) {
    if (item.slot === "weapon") {
      const availableSkill = Math.max(1, Number(weaponSkill) || 1);
      const minReq = Math.max(1, Number(item.skillReq) || 1);
      const maxReq = Number.isFinite(item.skillReqMax) ? Math.max(minReq, Number(item.skillReqMax)) : minReq;
      const minGapRatio = clamp((availableSkill - minReq) / Math.max(18, availableSkill * 0.55), 0, 1);
      const maxOvershootRatio = clamp((availableSkill - maxReq) / Math.max(28, availableSkill * 0.65), 0, 1);
      return clamp(1.12 - minGapRatio * 0.2 - maxOvershootRatio * 0.06, 0.84, 1.13);
    }
    const availableLevel = Math.max(1, Number(projectedLevel) || 1);
    const minReq = Math.max(1, Number(item.levelReq) || 1);
    const maxReq = Number.isFinite(item.levelReqMax) ? Math.max(minReq, Number(item.levelReqMax)) : minReq;
    const minGapRatio = clamp((availableLevel - minReq) / Math.max(8, availableLevel * 0.42), 0, 1);
    const maxOvershootRatio = clamp((availableLevel - maxReq) / Math.max(14, availableLevel * 0.52), 0, 1);
    return clamp(1.11 - minGapRatio * 0.22 - maxOvershootRatio * 0.07, 0.82, 1.12);
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
    if (!Number.isFinite(budgetCap) || budgetCap <= 0) return { budgetFit: 1, overBudget: false };
    const value = Math.max(0, Number(item.colValue) || 0);
    if (value <= 0) return { budgetFit: 1, overBudget: false };
    const budgetSensitivity = clamp(0.5 + style.weights.farming * 0.3 + style.weights.survival * 0.12 - style.weights.damage * 0.14, 0.35, 0.95);
    const overBudget = value > budgetCap;
    if (overBudget) {
      const overRatio = clamp((value - budgetCap) / Math.max(1, budgetCap), 0, 2.2);
      const hardPenalty = strictBudgetCap ? 0.22 : 0;
      return { budgetFit: clamp(1 - overRatio * (0.26 + budgetSensitivity * 0.28) - hardPenalty, 0.45, 1), overBudget: true };
    }
    const underRatio = clamp((budgetCap - value) / Math.max(1, budgetCap), 0, 1);
    return { budgetFit: clamp(1 + underRatio * (0.04 + budgetSensitivity * 0.08), 1, 1.14), overBudget: false };
  }

  function plannerGearScore(item, context) {
    const data = window.SBO_DATA || {};
    const sourceQ = data.sourceQuality?.[item.sourceType] || 1;
    const scalingQ = data.scalingQuality?.[item.scalingType || "fixed"] || 1;
    const style = data.playstyles?.[context.playstyle] || data.playstyles?.balanced || { weights: { damage: 1, survival: 1, farming: 0.35 } };
    const projectedLevel = context.currentLevel + context.levelsToPlan;
    const floorFit = 1 + clamp((projectedLevel - (item.floorMin || 1)) / 30, -0.4, 0.7);
    let scalingProgress = 1;
    if (item.scalingType === "level_1") scalingProgress += projectedLevel * 0.003;
    else if (item.scalingType === "level_5") scalingProgress += Math.floor(projectedLevel / 5) * 0.007;
    else if (item.scalingType === "skill_1") scalingProgress += context.weaponSkill * 0.002;
    else if (item.scalingType === "skill_5") scalingProgress += Math.floor(context.weaponSkill / 5) * 0.005;
    let styleFit = 1;
    if (item.slot === "weapon") styleFit += style.weights.damage * 0.25;
    if (["armor", "upper", "lower", "shield"].includes(item.slot)) styleFit += style.weights.survival * 0.2;
    if (context.weaponClass === "dual-wield" && item.slot === "weapon") {
      const skillTarget = Math.max(1, context.weaponSkill || 1);
      const itemSkillReq = Math.max(1, item.skillReq || 1);
      const skillCloseness = 1 - clamp(Math.abs(skillTarget - itemSkillReq) / 220, 0, 1);
      if (item.weaponClass === "dual-wield") styleFit += 0.18 + skillCloseness * 0.14;
      else if (item.weaponClass === "one-handed") styleFit -= 0.04;
    }
    if (context.weaponClass === "two-handed" && item.slot === "weapon" && ["crafted", "boss"].includes(item.sourceType)) styleFit += 0.12;
    if (context.playstyle === "farming" && ["badge", "event"].includes(item.sourceType)) styleFit += 0.08;
    const statBlock = deriveItemStatBlock(item, sourceQ, projectedLevel, context.weaponSkill);
    const statPower = computeItemStatPower(item, statBlock, style, context.stats, context.weaponClass);
    const requirementFit = computeRequirementFit(item, projectedLevel, context.weaponSkill);
    const valueEfficiency = computeValueEfficiency(item, projectedLevel, sourceQ, style);
    const { budgetFit, overBudget } = computeBudgetFit(item, context.optimization?.budgetCap, context.optimization?.strictBudgetCap, style);
    const isItemOwned = isOwned(item);
    const ownedBoost = isItemOwned ? 1.08 : 1;
    const total = sourceQ * scalingQ * floorFit * scalingProgress * styleFit * statPower * requirementFit * valueEfficiency * budgetFit * ownedBoost;
    return {
      total,
      value: (item.colValue || 0) > 0 ? total / (item.colValue / 1000) : total,
      reqFit: requirementFit,
      ownedBoost,
      confidence: item.exactStats ? "exact" : "estimated",
      overBudget,
      stats: statBlock,
    };
  }

  function buildPlannerGearRecommendations() {
    const context = getPlannerContext();
    const projectedLevel = context.currentLevel + context.levelsToPlan;
    const slots = getRecommendedSlots(context.weaponClass);
    const recommendations = {};
    slots.forEach((slot) => {
      const candidates = ITEM_CATALOG
        .filter((item) => item.slot === slot)
        .filter((item) => (Number(item.floorMin) || 1) <= context.maxFloorReached)
        .filter((item) => context.itemPoolMode !== "standard" || !["badge", "gamepass", "event"].includes(String(item.sourceType || "")))
        .filter((item) => context.dataQualityMode !== "exact-only" || item.exactStats === true)
        .filter((item) => item.slot === "weapon" ? (item.skillReq || 1) <= context.weaponSkill : (item.levelReq || 1) <= projectedLevel)
        .filter((item) => !context.ownership.onlyOwned || isOwned(item))
        .filter((item) => !context.optimization?.avoidTokens?.size || !isOwnedByTokens(item, context.optimization.avoidTokens))
        .filter((item) => !(
          context.optimization?.strictBudgetCap &&
          Number.isFinite(context.optimization.budgetCap) &&
          Number(item.colValue) > context.optimization.budgetCap
        ))
        .filter((item) => slot !== "weapon" || isWeaponClassCompatible(item.weaponClass, context.weaponClass))
        .map((item) => ({ item, score: plannerGearScore(item, context) }))
        .sort((a, b) => {
          const aVal = context.gearSortMode === "value" ? a.score.value : a.score.total;
          const bVal = context.gearSortMode === "value" ? b.score.value : b.score.total;
          const scoreDiff = bVal - aVal;
          if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
          const valDiff = (a.item.colValue || 0) - (b.item.colValue || 0);
          if (valDiff !== 0) return valDiff;
          return (a.item.id || "").localeCompare(b.item.id || "");
        })
        .slice(0, 3);
      recommendations[slot] = candidates;
    });
    return { context, recommendations };
  }

  function buildGearWhy(item, score) {
    if (isOwned(item)) return "Owned item, useful immediately.";
    const stats = score.stats || itemStatBlock(item);
    if (stats.attack >= stats.defense && stats.attack > 0) return "Strong ATK option for damage-focused progress.";
    if (stats.defense > 0) return "Strong DEF upgrade for survivability.";
    if (stats.dexterity > 0) return "DEX helps HP scaling through your VIT formula.";
    return "Best available score for your current Planner draft.";
  }

  function getEquippedSlotForItem(item) {
    const slots = equipped?.slots || {};
    const match = Object.entries(slots).find(([, itemId]) => String(itemId) === String(item.id));
    return match?.[0] || "";
  }

  function buildGearActionResultHtml(item, options = {}) {
    const stats = itemStatBlock(item);
    const statLine = [
      Number.isFinite(stats.attack) && stats.attack ? `ATK +${stats.attack}` : null,
      Number.isFinite(stats.defense) && stats.defense ? `DEF +${stats.defense}` : null,
      Number.isFinite(stats.dexterity) && stats.dexterity ? `DEX +${stats.dexterity}` : null,
    ].filter(Boolean).join(" / ") || "No visible stat gains";
    const colValue = Number(item.colValue);
    const cost = Number.isFinite(colValue) ? `${colValue.toLocaleString()} Col` : "Cost unknown";
    const equippedSlot = getEquippedSlotForItem(item);
    const heading = options.heading || `${getSlotLabel(item.slot)} result`;
    return `<article class="quick-gear-result">
      <div class="quick-gear-result-main">
        <div class="gear-card-header">
          <span class="gear-slot">${escapeHtml(heading)}</span>
          <strong>${escapeHtml(item.name)}</strong>
        </div>
        <div class="quality-badge-row">${buildItemQualityBadges(item)}</div>
        <div class="gear-visible-facts">
          <span>${escapeHtml(isOwned(item) ? "Owned" : "Not owned")}</span>
          ${equippedSlot ? `<span>Equipped: ${escapeHtml(getSlotLabel(equippedSlot))}</span>` : ""}
          <span>F${escapeHtml(item.floorMin || "?")} / ${escapeHtml(item.sourceType || "unknown")}</span>
          <span>${escapeHtml(cost)}</span>
        </div>
        <p class="gear-statline">${escapeHtml(statLine)}</p>
      </div>
      <div class="button-row quick-gear-actions">
        <button type="button" class="secondary compact" data-action="equip-recommendation" data-slot="${escapeHtml(item.slot)}" data-item-id="${escapeHtml(item.id)}">Equip</button>
        <button type="button" class="secondary compact ghost" data-action="mark-owned" data-item-id="${escapeHtml(item.id)}">Mark Owned</button>
        <button type="button" class="secondary compact ghost" data-action="compare-add" data-item-id="${escapeHtml(item.id)}">Compare</button>
      </div>
    </article>`;
  }

  function getQuickGearMatches() {
    const query = normalizeToken(els.quickGearSearch?.value || "");
    if (!query) return [];
    return ITEM_CATALOG
      .filter((item) => item._searchHay.includes(query))
      .map((item) => {
        const name = item._nameToken || "";
        const id = item._idToken || "";
        const rank =
          name === query || id === query ? 0 :
          name.startsWith(query) || id.startsWith(query) ? 1 :
          name.includes(query) ? 2 :
          item._searchHay.includes(query) ? 3 :
          4;
        return { item, rank };
      })
      .sort((a, b) =>
        a.rank - b.rank ||
        (Number(a.item.floorMin) || 1) - (Number(b.item.floorMin) || 1) ||
        String(a.item.name || "").localeCompare(String(b.item.name || "")),
      )
      .slice(0, 8)
      .map(({ item }) => item);
  }

  function renderQuickGearSearch() {
    if (!els.quickGearResults || !els.quickGearSearch || !els.quickGearClear) return;
    const query = String(els.quickGearSearch.value || "").trim();
    els.quickGearClear.hidden = !query;
    if (!query) {
      els.quickGearResults.hidden = true;
      els.quickGearResults.innerHTML = "";
      return;
    }
    const matches = getQuickGearMatches();
    els.quickGearResults.hidden = false;
    els.quickGearResults.innerHTML = matches.length
      ? `<div class="quick-results-heading"><strong>${matches.length} result${matches.length === 1 ? "" : "s"}</strong><span>Use actions without leaving Inventory.</span></div>${matches.map((item) => buildGearActionResultHtml(item, { heading: getSlotLabel(item.slot) })).join("")}`
      : `<div class="empty-state compact"><strong>No matching gear found.</strong><span>No matching gear found. Try a shorter name or clear filters.</span></div>`;
  }

  function renderPlannerGearWorkspace() {
    if (!els.plannerGearList || !els.plannerGearSummary) return;
    const { context, recommendations } = buildPlannerGearRecommendations();
    const allCandidates = Object.values(recommendations).flat();
    const ownedCount = ITEM_CATALOG.filter((item) => isOwned(item)).length;
    const exactOnly = context.dataQualityMode === "exact-only" ? "exact rows only" : "exact and estimated rows";
    const statSource = context.hasGeneratedPlanStats ? "generated plan stats" : "current draft stats";
    els.plannerGearSummary.textContent = `Using Planner draft: Lv ${context.currentLevel}, ${context.weaponClass}, Floor ${context.maxFloorReached}, ${exactOnly}, ${statSource}. ${ownedCount} owned catalog item(s).`;
    renderEquippedLoadout();
    if (!allCandidates.length) {
      els.plannerGearList.innerHTML = `<div class="empty-state compact">
        <strong>No gear matches the current Planner draft.</strong>
        <span>Raise max floor, allow estimated data from Planner settings, or clear strict catalog filters.</span>
        <a class="secondary link-button compact" href="./index.html">Open Planner</a>
      </div>`;
      return;
    }
    els.plannerGearList.innerHTML = Object.entries(recommendations).map(([slot, candidates]) => {
      if (!candidates.length) {
        return `<article class="gear-card inventory-recommendation-card empty-slot-card">
          <div class="gear-card-header"><span class="gear-slot">${escapeHtml(getSlotLabel(slot))}</span><strong>No pick found</strong></div>
          <p class="muted-text">No eligible item for this slot under the current Planner draft.</p>
        </article>`;
      }
      return candidates.map(({ item, score }, index) => {
        return `<article class="gear-card inventory-recommendation-card ${index === 0 ? "top-pick" : "alternative-pick"}">
          <div class="gear-card-header">
            <span class="gear-slot">${escapeHtml(getSlotLabel(slot))}${index === 0 ? " top pick" : ` option ${index + 1}`}</span>
            <strong>${escapeHtml(item.name)}</strong>
          </div>
          <div class="quality-badge-row">${buildItemQualityBadges(item)}</div>
          <p class="gear-why"><strong>Why this pick?</strong> ${escapeHtml(buildGearWhy(item, score))}</p>
          <div class="gear-visible-facts">
            <span>${escapeHtml(isOwned(item) ? "Owned" : "Not owned")}</span>
            ${equipped?.slots?.[slot] === item.id ? `<span>Equipped</span>` : ""}
            <span>${escapeHtml(itemRequirementStatus(item, context))}</span>
            <span>${escapeHtml(Number.isFinite(Number(item.colValue)) ? `${Number(item.colValue).toLocaleString()} Col` : "Cost unknown")}</span>
          </div>
          <p class="gear-statline">${escapeHtml([
            score.stats?.attack ? `ATK +${score.stats.attack}` : null,
            score.stats?.defense ? `DEF +${score.stats.defense}` : null,
            score.stats?.dexterity ? `DEX +${score.stats.dexterity}` : null,
          ].filter(Boolean).join(" / ") || "No visible stat gains")}</p>
          <div class="button-row">
            <button type="button" class="secondary compact" data-action="equip-recommendation" data-slot="${escapeHtml(slot)}" data-item-id="${escapeHtml(item.id)}">Equip</button>
            <button type="button" class="secondary compact ghost" data-action="mark-owned" data-item-id="${escapeHtml(item.id)}">Mark Owned</button>
            <button type="button" class="secondary compact ghost" data-action="compare-add" data-item-id="${escapeHtml(item.id)}">Compare</button>
          </div>
        </article>`;
      }).join("");
    }).join("");
  }

  function getEquippedItems() {
    const slots = equipped?.slots || {};
    return Object.entries(slots)
      .map(([slot, itemId]) => ({ slot, item: ITEM_CATALOG.find((candidate) => String(candidate.id) === String(itemId)) }))
      .filter((entry) => entry.item);
  }

  function summarizeEquippedTotals() {
    return getEquippedItems().reduce((totals, { item }) => {
      const stats = itemStatBlock(item);
      totals.attack += stats.attack;
      totals.defense += stats.defense;
      totals.dexterity += stats.dexterity;
      return totals;
    }, { attack: 0, defense: 0, dexterity: 0 });
  }

  function renderEquippedLoadout() {
    if (!els.equippedLoadout) return;
    const equippedItems = getEquippedItems();
    if (!equippedItems.length) {
      els.equippedLoadout.innerHTML = `<p class="muted-text">No equipped gear selected yet. Equip picks below, then apply totals to Planner.</p>`;
      return;
    }
    const totals = summarizeEquippedTotals();
    els.equippedLoadout.innerHTML = `
      <div class="equipped-loadout-summary">
        <strong>Equipped totals</strong>
        <span>ATK ${totals.attack} / DEF ${totals.defense} / DEX ${totals.dexterity}</span>
      </div>
      <div class="equipped-loadout-grid">
        ${equippedItems.map(({ slot, item }) => `<span class="pill owned">${escapeHtml(getSlotLabel(slot))}: ${escapeHtml(item.name)}</span>`).join("")}
      </div>`;
  }

  function saveEquipped() {
    equipped.updatedAt = new Date().toISOString();
    state?.setJson(keys.equipped, equipped);
  }

  function equipItem(slot, itemId) {
    equipped = equipped || { slots: {} };
    equipped.slots = equipped.slots || {};
    equipped.slots[slot] = itemId;
    saveEquipped();
  }

  function applyEquippedTotalsToDraft() {
    const totals = summarizeEquippedTotals();
    draft = getDraft();
    draft.gearAttack = String(Math.max(1, totals.attack));
    draft.gearDefense = String(totals.defense);
    draft.gearDexterity = String(totals.dexterity);
    draft.updatedAt = new Date().toISOString();
    state?.setJson(keys.formDraft, draft);
    showMessage("Equipped totals applied to Planner draft.");
  }

  function handleGearActionControl(control) {
    const item = ITEM_CATALOG.find((candidate) => String(candidate.id) === String(control.dataset.itemId || ""));
    if (!item) return false;
    const action = String(control.dataset.action || "");
    if (action === "equip-recommendation") {
      equipItem(String(control.dataset.slot || item.slot), String(item.id));
      if (!isOwned(item)) {
        owned.add(item._idToken);
        owned.add(item._nameToken);
        ownedRevision += 1;
        persistOwned();
      }
      showMessage(`${item.name} equipped in Inventory workspace.`);
      render();
      return true;
    }
    if (action === "mark-owned") {
      owned.add(item._idToken);
      owned.add(item._nameToken);
      ownedRevision += 1;
      persistOwned();
      render();
      return true;
    }
    if (action === "compare-add") {
      if (compareSelected.size >= 4 && !compareSelected.has(String(item.id))) {
        showMessage("You can compare up to 4 items at once.");
        return true;
      }
      compareSelected.add(String(item.id));
      render();
      return true;
    }
    return false;
  }

  function render() {
    if (!els.list) return;
    const items = getFilteredItems();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    const rows = pageItems
      .map((item) => {
        const checked = isOwned(item);
        const isFav = favorites.has(String(item.id));
        const statBits = [];
        if (Number.isFinite(item.attack)) statBits.push(`ATK ${item.attack}`);
        if (Number.isFinite(item.defense)) statBits.push(`DEF ${item.defense}`);
        if (Number.isFinite(item.dexterity)) statBits.push(`DEX ${item.dexterity}`);
        const reqBits = [];
        if (Number.isFinite(item.levelReq)) reqBits.push(`Lv ${item.levelReq}`);
        if (Number.isFinite(item.skillReq)) reqBits.push(`Skill ${item.skillReq}`);
        const colValue = Number.isFinite(item.colValue) ? item.colValue.toLocaleString() : "N/A";
        const compareChecked = compareSelected.has(String(item.id));
        const qualityBadges = buildItemQualityBadges(item);
        return `<label class="owned-inventory-row">
          <input type="checkbox" data-item-id="${escapeHtml(item.id)}" ${checked ? "checked" : ""} />
          <button type="button" class="favorite-btn${isFav ? " active" : ""}" data-action="toggle-favorite" data-item-id="${escapeHtml(item.id)}" aria-label="Toggle favorite">${isFav ? "★" : "☆"}</button>
          <span class="owned-row-name" title="${escapeHtml(item.name)}">${escapeHtml(displayName(item))}</span>
          <span class="owned-row-meta">F${escapeHtml(item.floorMin || "?")} • ${escapeHtml(item.slot)} • ${escapeHtml(item.sourceType || "unknown")} • ${escapeHtml(colValue)} Col</span>
          <span class="owned-row-meta">${escapeHtml(statBits.join(" • ") || "No stat values")} • ${escapeHtml(reqBits.join(" • ") || "No req values")}</span>
          <span class="owned-row-meta quality-badge-row">${qualityBadges}</span>
          <span class="compare-toggle">
            <input type="checkbox" data-action="compare-select" data-item-id="${escapeHtml(item.id)}" ${compareChecked ? "checked" : ""} />
            <span>Compare</span>
          </span>
          <span class="pill ${checked ? "owned" : "not-owned"}">${checked ? "Owned" : "Not owned"}</span>
        </label>`;
      })
      .join("");
    els.list.innerHTML = rows || `<p class="muted-text">No items match these filters.</p>`;
    if (els.summary) {
      els.summary.textContent = `Showing ${pageItems.length} of ${items.length} filtered items • ${owned.size} owned tokens • filtered noisy imports: ${RAW_ITEM_CATALOG.length - ITEM_CATALOG.length}`;
    }
    if (els.pageInfo) {
      els.pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
    }
    if (els.prevPageBtn) els.prevPageBtn.disabled = currentPage <= 1;
    if (els.nextPageBtn) els.nextPageBtn.disabled = currentPage >= totalPages;
    if (els.slotBreakdown) {
      const counts = { weapon: 0, armor: 0, upper: 0, lower: 0, shield: 0 };
      ITEM_CATALOG.forEach((item) => {
        if (isOwned(item) && counts[item.slot] != null) counts[item.slot] += 1;
      });
      els.slotBreakdown.innerHTML = `
        <span class="pill owned">Weapon ${counts.weapon}</span>
        <span class="pill owned">Armor ${counts.armor}</span>
        <span class="pill owned">Headwear ${counts.upper}</span>
        <span class="pill owned">Accessory ${counts.lower}</span>
        <span class="pill owned">Shield ${counts.shield}</span>
        <span class="pill exact">Favorites ${favorites.size}</span>
      `;
    }
    renderPlannerGearWorkspace();
    renderQuickGearSearch();
    renderMissingUpgrades();
    renderComparePanel();
  }

  function buildItemQualityBadges(item) {
    const exact = item?.exactStats === true;
    const unknown = typeof item?.exactStats === "undefined";
    const hasWikiNote = hasWikiSourceEvidence(item);
    const badges = [
      unknown
        ? '<span class="data-quality-badge unknown" title="Unknown means this row has no explicit source-quality marker yet.">Unknown</span>'
        : exact
        ? '<span class="data-quality-badge exact" title="Exact means this item has confirmed stat values in the catalog.">Exact</span>'
        : '<span class="data-quality-badge estimated" title="Estimated means one or more item values need formula fallback or confirmation.">Estimated</span>',
    ];
    if (hasWikiNote) {
      badges.push('<span class="data-quality-badge wiki" title="Wiki-sourced means this item was imported from captured SBO:Rebirth wiki notes.">Wiki-sourced</span>');
    }
    if (!exact) {
      badges.push('<span class="data-quality-badge testing" title="Needs Testing means live in-game confirmation would improve this row.">Needs Testing</span>');
    }
    return badges.join("");
  }

  function hasWikiSourceEvidence(item) {
    if (!item || typeof item !== "object") return false;
    if (item.wikiUrl || String(item.sourceUrl || "").includes("fandom.com") || item.source?.wikiUrl) return true;
    const sourceText = `${item.source || ""} ${item.sourceType || ""} ${item.sourceName || ""}`.toLowerCase();
    if (/\bwiki\b|fandom/.test(sourceText)) return true;
    const notes = `${item.notes || ""} ${item.sourceNotes || ""}`;
    return /wiki sync import|imported from latest wiki extraction|captured .*wiki|wiki source|extracted from .*wiki|fandom/i.test(notes);
  }

  function computeMissingUpgrades() {
    const maxFloor = Math.max(1, Number(els.maxFloor?.value) || 19);
    const candidateFloor = maxFloor + 1;
    const candidates = ITEM_CATALOG
      .filter((item) => Number(item.floorMin) === candidateFloor && !isOwned(item))
      .map((item) => {
        const score = (Number(item.attack) || 0) * 2 + (Number(item.defense) || 0) + (Number(item.dexterity) || 0) * 0.05;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return { candidateFloor, candidates };
  }

  function renderMissingUpgrades() {
    if (!els.missingList || !els.missingSummary) return;
    const { candidateFloor, candidates } = computeMissingUpgrades();
    els.missingSummary.textContent = candidates.length
      ? `Top ${candidates.length} unowned items likely useful for Floor ${candidateFloor}.`
      : `No unowned candidates found for Floor ${candidateFloor}. Increase max floor or collect more items.`;
    els.missingList.innerHTML = candidates.length
      ? candidates
          .map(({ item }) => {
            const stats = [
              Number.isFinite(item.attack) ? `ATK ${item.attack}` : null,
              Number.isFinite(item.defense) ? `DEF ${item.defense}` : null,
              Number.isFinite(item.dexterity) ? `DEX ${item.dexterity}` : null,
            ].filter(Boolean).join(" • ");
            const req = [
              Number.isFinite(item.levelReq) ? `Lv ${item.levelReq}` : null,
              Number.isFinite(item.skillReq) ? `Skill ${item.skillReq}` : null,
            ].filter(Boolean).join(" • ");
            return `<div class="progress-list-item">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="muted-text">F${escapeHtml(item.floorMin || "?")} • ${escapeHtml(item.slot)} • ${escapeHtml(item.sourceType || "unknown")}</span>
              <span class="muted-text">${escapeHtml(stats || "No stat values")} • ${escapeHtml(req || "No req values")}</span>
            </div>`;
          })
          .join("")
      : `<p class="muted-text">No missing upgrades to suggest at this floor boundary.</p>`;
  }

  function renderComparePanel() {
    if (!els.compareList || !els.compareSummary) return;
    const selected = ITEM_CATALOG.filter((item) => compareSelected.has(String(item.id))).slice(0, 4);
    if (!selected.length) {
      els.compareSummary.textContent = "Select up to 4 items using “Compare” on catalog rows.";
      els.compareList.innerHTML = `<p class="muted-text">No items selected.</p>`;
      return;
    }
    els.compareSummary.textContent = `Comparing ${selected.length} item(s).`;
    els.compareList.innerHTML = selected.map((item) => {
      const stats = [
        Number.isFinite(item.attack) ? `ATK ${item.attack}` : "ATK —",
        Number.isFinite(item.defense) ? `DEF ${item.defense}` : "DEF —",
        Number.isFinite(item.dexterity) ? `DEX ${item.dexterity}` : "DEX —",
      ].join(" • ");
      const req = [
        Number.isFinite(item.levelReq) ? `Lv ${item.levelReq}` : "Lv —",
        Number.isFinite(item.skillReq) ? `Skill ${item.skillReq}` : "Skill —",
      ].join(" • ");
      const value = Number.isFinite(item.colValue) ? `${item.colValue.toLocaleString()} Col` : "N/A";
      return `<div class="progress-list-item">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="muted-text">F${escapeHtml(item.floorMin || "?")} • ${escapeHtml(item.slot)} • ${escapeHtml(item.sourceType || "unknown")}</span>
        <span class="muted-text">${escapeHtml(stats)} • ${escapeHtml(req)} • ${escapeHtml(value)}</span>
      </div>`;
    }).join("");
  }

  function ownedListToRaw() {
    const preferredNames = [];
    ITEM_CATALOG.forEach((item) => {
      if (isOwned(item)) preferredNames.push(item.name);
    });
    const unique = [...new Set(preferredNames)];
    return unique.join(", ");
  }

  function persistOwned() {
    draft = getDraft();
    draft.ownedItems = ownedListToRaw();
    draft.updatedAt = new Date().toISOString();
    try {
      state?.setJson(keys.formDraft, draft);
      showMessage("Owned inventory saved to Planner draft.");
    } catch (_) {
      showMessage("Could not save inventory state.");
    }
  }

  function bindEvents() {
    const rerenderFromFirstPage = () => { currentPage = 1; render(); };
    const advancedEls = [
      els.minFloor,
      els.weaponClass,
      els.scaling,
      els.atkMin,
      els.atkMax,
      els.defMin,
      els.defMax,
      els.dexMin,
      els.dexMax,
      els.colMin,
      els.colMax,
      els.lvMin,
      els.lvMax,
      els.skMin,
      els.skMax,
      els.notes,
      els.hideFreeCol,
    ];
    const resetAdvancedFilters = () => {
      if (els.minFloor) els.minFloor.value = "";
      if (els.weaponClass) els.weaponClass.value = "all";
      if (els.scaling) els.scaling.value = "all";
      [
        els.atkMin,
        els.atkMax,
        els.defMin,
        els.defMax,
        els.dexMin,
        els.dexMax,
        els.colMin,
        els.colMax,
        els.lvMin,
        els.lvMax,
        els.skMin,
        els.skMax,
      ].forEach((el) => {
        if (el) el.value = "";
      });
      if (els.notes) els.notes.value = "";
      if (els.hideFreeCol) els.hideFreeCol.checked = false;
      rerenderFromFirstPage();
    };
    els.search?.addEventListener("input", rerenderFromFirstPage);
    els.slot?.addEventListener("change", rerenderFromFirstPage);
    els.maxFloor?.addEventListener("change", rerenderFromFirstPage);
    els.source?.addEventListener("change", rerenderFromFirstPage);
    els.quality?.addEventListener("change", rerenderFromFirstPage);
    els.sort?.addEventListener("change", rerenderFromFirstPage);
    advancedEls.forEach((el) => {
      if (!el) return;
      const evt = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
      el.addEventListener(evt, rerenderFromFirstPage);
    });
    els.resetAdvanced?.addEventListener("click", resetAdvancedFilters);
    els.ownedOnly?.addEventListener("change", rerenderFromFirstPage);
    els.favoritesOnly?.addEventListener("change", rerenderFromFirstPage);

    els.list?.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
      const action = String(input.dataset.action || "");
      if (action === "compare-select") {
        const compareItemId = String(input.dataset.itemId || "");
        if (!compareItemId) return;
        if (input.checked) {
          if (compareSelected.size >= 4) {
            input.checked = false;
            showMessage("You can compare up to 4 items at once.");
            return;
          }
          compareSelected.add(compareItemId);
        } else {
          compareSelected.delete(compareItemId);
        }
        renderComparePanel();
        return;
      }
      const itemId = String(input.dataset.itemId || "");
      const item = ITEM_CATALOG.find((entry) => entry.id === itemId);
      if (!item) return;
      const idToken = item._idToken;
      const nameToken = item._nameToken;
      if (input.checked) {
        owned.add(idToken);
        owned.add(nameToken);
      } else {
        owned.delete(idToken);
        owned.delete(nameToken);
      }
      ownedRevision += 1;
      render();
    });

    els.list?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='toggle-favorite'][data-item-id]");
      if (!button) return;
      const itemId = String(button.dataset.itemId || "");
      if (!itemId) return;
      if (favorites.has(itemId)) favorites.delete(itemId);
      else favorites.add(itemId);
      favoritesRevision += 1;
      persistFavorites();
      render();
    });

    els.plannerGearList?.addEventListener("click", (event) => {
      const control = event.target.closest("[data-action][data-item-id]");
      if (!control) return;
      handleGearActionControl(control);
    });

    els.quickGearSearch?.addEventListener("input", renderQuickGearSearch);
    els.quickGearClear?.addEventListener("click", () => {
      if (els.quickGearSearch) els.quickGearSearch.value = "";
      renderQuickGearSearch();
      els.quickGearSearch?.focus();
    });
    els.quickGearResults?.addEventListener("click", (event) => {
      const control = event.target.closest("[data-action][data-item-id]");
      if (!control) return;
      handleGearActionControl(control);
    });

    els.equipTopPicks?.addEventListener("click", () => {
      const { recommendations } = buildPlannerGearRecommendations();
      Object.entries(recommendations).forEach(([slot, candidates]) => {
        const top = candidates?.[0];
        if (top?.item?.id) {
          equipItem(slot, String(top.item.id));
          owned.add(top.item._idToken);
          owned.add(top.item._nameToken);
        }
      });
      ownedRevision += 1;
      persistOwned();
      showMessage("Top gear picks equipped in Inventory workspace.");
      render();
    });

    els.applyEquippedTotals?.addEventListener("click", () => {
      applyEquippedTotalsToDraft();
      render();
    });

    els.markFilteredOwned?.addEventListener("click", () => {
      getFilteredItems().forEach((item) => {
        owned.add(item._idToken);
        owned.add(item._nameToken);
      });
      ownedRevision += 1;
      render();
      showMessage("Marked filtered items as owned.");
    });

    els.clearFilteredOwned?.addEventListener("click", () => {
      getFilteredItems().forEach((item) => {
        owned.delete(item._idToken);
        owned.delete(item._nameToken);
      });
      ownedRevision += 1;
      render();
      showMessage("Cleared ownership for filtered items.");
    });

    els.mergeBulk?.addEventListener("click", () => {
      const lines = String(els.bulkPaste?.value || "")
        .split(/[\n,]+/)
        .map((line) => line.trim())
        .filter(Boolean);
      let merged = 0;
      lines.forEach((line) => {
        const token = normalizeToken(line);
        const match = ITEM_CATALOG.find(
          (item) => item._nameToken === token || item._idToken === token,
        );
        if (!match) return;
        const before = owned.size;
        owned.add(match._idToken);
        owned.add(match._nameToken);
        if (owned.size > before) merged += 1;
      });
      if (merged > 0) ownedRevision += 1;
      render();
      showMessage(`Merged ${merged} item(s) from bulk paste.`);
    });

    els.saveOwned?.addEventListener("click", persistOwned);
    els.prevPageBtn?.addEventListener("click", () => { currentPage = Math.max(1, currentPage - 1); render(); });
    els.nextPageBtn?.addEventListener("click", () => { currentPage += 1; render(); });
    els.exportOwned?.addEventListener("click", () => {
      const raw = ownedListToRaw();
      if (els.bulkPaste) els.bulkPaste.value = raw;
      showMessage("Owned list exported into bulk paste box.");
    });
    els.copyOwned?.addEventListener("click", async () => {
      const raw = ownedListToRaw();
      if (!raw) {
        showMessage("No owned items to copy.");
        return;
      }
      try {
        await navigator.clipboard.writeText(raw);
        showMessage("Owned list copied to clipboard.");
      } catch (_) {
        showMessage("Clipboard copy failed in this browser.");
      }
    });
  }

  setThemeToggle();
  bindEvents();
  render();
  state?.subscribe(keys.formDraft, () => {
    draft = getDraft();
    owned = parseOwnedTokens(draft.ownedItems || "");
    ownedRevision += 1;
    render();
  });
  state?.subscribe(keys.equipped, () => {
    equipped = state?.getJson(keys.equipped, { slots: {} }) || { slots: {} };
    render();
  });
})();
