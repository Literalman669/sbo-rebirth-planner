(function stateSchemaInit() {
  const KEY_PREFIX = "sbo-rebirth-planner.";

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampInt(value, min, max, fallback) {
    const n = Math.trunc(toNumber(value, fallback));
    return Math.min(max, Math.max(min, n));
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    const unique = new Set();
    value.forEach((entry) => {
      const clean = String(entry || "").trim();
      if (clean) unique.add(clean);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }

  function normalizeFloorTracker(value) {
    const floors = new Set();
    if (Array.isArray(value)) {
      value.forEach((floor) => {
        const n = clampInt(floor, 1, 99, 0);
        if (n >= 1) floors.add(n);
      });
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([floorKey, isCleared]) => {
        if (!isCleared) return;
        const n = clampInt(floorKey, 1, 99, 0);
        if (n >= 1) floors.add(n);
      });
    }
    return Array.from(floors.values()).sort((a, b) => a - b);
  }

  function normalizeBuilds(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    Object.entries(value).forEach(([name, snapshot]) => {
      const key = String(name || "").trim();
      if (!key) return;
      if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) out[key] = snapshot;
    });
    return out;
  }

  function normalizeFormDraft(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = { ...value };
    if ("ownedItems" in out && typeof out.ownedItems !== "string") {
      const list = Array.isArray(out.ownedItems) ? out.ownedItems : [out.ownedItems];
      out.ownedItems = normalizeStringArray(list).join(", ");
    }
    if ("maxFloorReached" in out) out.maxFloorReached = clampInt(out.maxFloorReached, 1, 99, 1);
    return out;
  }

  function normalizeEquipped(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { slots: {} };
    const slots = value.slots && typeof value.slots === "object" && !Array.isArray(value.slots) ? value.slots : {};
    return { ...value, slots };
  }

  function normalizePresetFilter(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { showPinnedOnly: false };
    return { showPinnedOnly: Boolean(value.showPinnedOnly) };
  }

  function normalizeBossFilters(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = { ...value };
    if ("maxFloor" in out) out.maxFloor = clampInt(out.maxFloor, 1, 99, 19);
    if ("hideBeaten" in out) out.hideBeaten = Boolean(out.hideBeaten);
    if ("onlyUnlocked" in out) out.onlyUnlocked = Boolean(out.onlyUnlocked);
    return out;
  }

  const normalizersByKey = Object.freeze({
    [`${KEY_PREFIX}builds.v1`]: normalizeBuilds,
    [`${KEY_PREFIX}floor-tracker.v1`]: normalizeFloorTracker,
    [`${KEY_PREFIX}pinned-presets.v1`]: normalizeStringArray,
    [`${KEY_PREFIX}preset-filter.v1`]: normalizePresetFilter,
    [`${KEY_PREFIX}form-draft.v1`]: normalizeFormDraft,
    [`${KEY_PREFIX}equipped.v1`]: normalizeEquipped,
    [`${KEY_PREFIX}calibration.v1`]: (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {}),
    [`${KEY_PREFIX}boss-filters.v1`]: normalizeBossFilters,
    [`${KEY_PREFIX}boss-beaten.v1`]: normalizeStringArray,
  });

  function normalizeByKey(key, value) {
    const normalize = normalizersByKey[key];
    if (!normalize) return value;
    return normalize(value);
  }

  window.SBO_STATE_SCHEMA = Object.freeze({
    normalizeByKey,
  });
})();
