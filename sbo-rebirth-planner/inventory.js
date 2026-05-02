(function bootstrapInventoryPage() {
  const state = window.SBO_STATE_ADAPTER;
  const keys = state?.KEYS || {};
  const INVENTORY_FAVORITES_KEY = "sbo-rebirth-planner.inventory-favorites.v1";
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
      _searchHay: normalizeToken(`${item.name} ${item.id} ${item.slot} ${item.weaponClass || ""}`),
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
    renderMissingUpgrades();
    renderComparePanel();
  }

  function buildItemQualityBadges(item) {
    const exact = item?.exactStats === true;
    const hasWikiNote = /wiki/i.test(`${item?.notes || ""}`);
    const badges = [
      exact
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
})();
