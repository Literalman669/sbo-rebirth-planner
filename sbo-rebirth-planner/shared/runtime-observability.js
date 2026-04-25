(function runtimeObservabilityInit() {
  const KEY = "sbo-rebirth-planner.runtime-events.v1";
  const LIMIT = 25;

  function readEvents() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeEvents(events) {
    try {
      localStorage.setItem(KEY, JSON.stringify(events.slice(-LIMIT)));
    } catch {
      // Ignore storage write failures; never break the app for telemetry.
    }
  }

  function pushEvent(kind, details) {
    const existing = readEvents();
    existing.push({
      kind,
      details: String(details || "").slice(0, 500),
      page: location.pathname,
      at: new Date().toISOString(),
    });
    writeEvents(existing);
  }

  window.addEventListener("error", (event) => {
    pushEvent("error", event?.message || "Unknown runtime error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const details = reason && typeof reason === "object" ? (reason.message || JSON.stringify(reason)) : String(reason || "Unhandled rejection");
    pushEvent("unhandledrejection", details);
  });
})();
