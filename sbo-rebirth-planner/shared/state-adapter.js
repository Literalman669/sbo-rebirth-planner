(function stateAdapterInit() {
  const KEYS = Object.freeze({
    builds: "sbo-rebirth-planner.builds.v1",
    floorTracker: "sbo-rebirth-planner.floor-tracker.v1",
    pinnedPresets: "sbo-rebirth-planner.pinned-presets.v1",
    presetFilter: "sbo-rebirth-planner.preset-filter.v1",
    formDraft: "sbo-rebirth-planner.form-draft.v1",
    equipped: "sbo-rebirth-planner.equipped.v1",
    calibration: "sbo-rebirth-planner.calibration.v1",
    bossFilters: "sbo-rebirth-planner.boss-filters.v1",
    bossBeaten: "sbo-rebirth-planner.boss-beaten.v1",
    bossLastSynced: "sbo-rebirth-planner.boss-last-synced.v1",
  });

  function getRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function setRaw(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getJson(key, fallback) {
    const raw = getRaw(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (parsed == null) return fallback;
      const normalized = window.SBO_STATE_SCHEMA?.normalizeByKey
        ? window.SBO_STATE_SCHEMA.normalizeByKey(key, parsed)
        : parsed;
      return normalized == null ? fallback : normalized;
    } catch (_) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      const normalized = window.SBO_STATE_SCHEMA?.normalizeByKey
        ? window.SBO_STATE_SCHEMA.normalizeByKey(key, value)
        : value;
      const raw = JSON.stringify(normalized);
      return setRaw(key, raw);
    } catch (_) {
      return false;
    }
  }

  function subscribe(keys, callback) {
    const watched = new Set(Array.isArray(keys) ? keys : [keys]);
    const handler = (event) => {
      if (event && watched.has(event.key)) callback(event);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }

  window.SBO_STATE_ADAPTER = Object.freeze({
    KEYS,
    getRaw,
    setRaw,
    getJson,
    setJson,
    subscribe,
  });
})();
