(function plannerStorageInit() {
  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function readBuildStorage(getRaw, key) {
    const parsed = safeParse(getRaw(key), {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }

  function readPinnedPresetStorage(getRaw, key) {
    const parsed = safeParse(getRaw(key), []);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((name) => String(name || "").trim()).filter(Boolean));
  }

  function writePinnedPresetStorage(setRaw, key, set) {
    const raw = JSON.stringify(Array.from(set).sort((a, b) => a.localeCompare(b)));
    setRaw(key, raw);
    return raw;
  }

  function readPresetFilterPreference(getRaw, key, parseBoolean) {
    const parsed = safeParse(getRaw(key), { showPinnedOnly: false });
    return parseBoolean(parsed?.showPinnedOnly);
  }

  function writePresetFilterPreference(setRaw, key, showPinnedOnly) {
    const raw = JSON.stringify({ showPinnedOnly: Boolean(showPinnedOnly) });
    setRaw(key, raw);
    return raw;
  }

  function readFloorTrackerStorage(getRaw, key, maxFloor) {
    const parsed = safeParse(getRaw(key), []);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n) => Number.isInteger(n) && n >= 1 && n <= maxFloor));
  }

  function writeFloorTrackerStorage(setRaw, key, clearedSet) {
    const raw = JSON.stringify(Array.from(clearedSet).sort((a, b) => a - b));
    setRaw(key, raw);
    return raw;
  }

  window.SBO_PLANNER_STORAGE = Object.freeze({
    readBuildStorage,
    readPinnedPresetStorage,
    writePinnedPresetStorage,
    readPresetFilterPreference,
    writePresetFilterPreference,
    readFloorTrackerStorage,
    writeFloorTrackerStorage,
  });
})();
