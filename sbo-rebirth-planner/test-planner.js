/**
 * Playwright smoke test for core planner behavior (determinism, stale banner, sync-to-plan).
 * Run: npm test (with dev server on http://localhost:60290)
 */
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.BASE_URL || "http://localhost:60290";
  const results = { phaseK: {}, errors: [] };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
    results.loaded = true;
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });

    const determinismResult = await page.evaluate(() => {
      return typeof window.__sboRunDeterminismTest === "function"
        ? window.__sboRunDeterminismTest()
        : { pass: false, error: "Test not found" };
    });
    results.phaseK.determinism = determinismResult;
    results.phaseK.projectionCoreLoaded = await page.evaluate(
      () => typeof window.SBO_PROJECTION_CORE?.computeBuildMetrics === "function",
    );
    results.phaseK.floor19ItemCoverage = await page.evaluate(() =>
      (window.SBO_DATA?.itemCatalog || []).some((item) => Number(item.floorMin) === 19),
    );
    results.phaseK.floor19BossCoverage = await page.evaluate(() =>
      ([...(window.SBO_BOSS_DATA?.bosses || []), ...(window.SBO_BOSS_DATA?.minibosses || [])]).some(
        (boss) => Number(boss.floor) === 19,
      ),
    );
    results.phaseK.startHereFlowVisible = await page.isVisible("#startHereFlow");
    results.phaseK.advancedControlsCollapsedByDefault = await page.evaluate(() => {
      const advanced = document.getElementById("advancedPlannerOptions");
      const statRef = document.querySelector(".stat-reference-panel");
      const saved = document.querySelector('[data-disclosure-key="saved-builds"]');
      return Boolean(advanced && !advanced.open && statRef && !statRef.open && saved && !saved.open);
    });
    results.phaseK.emptyPlanStateShown = await page.isVisible("#noGeneratedPlanEmptyState");

    await page.click("#loadExampleBuildBtn");
    await page.click("#startHereGenerateBtn");
    await page.waitForTimeout(500);
    results.phaseK.exampleBuildGeneratesPlan = await page.evaluate(() => {
      const level = document.querySelector('[name="currentLevel"]')?.value;
      const buildName = document.querySelector('[name="buildName"]')?.value || "";
      const firstRow = document.querySelector("#planTable tbody tr");
      const marker = document.querySelector("#exampleBuildNotice");
      return level === "12" && buildName.toLowerCase().includes("example") && Boolean(firstRow) && Boolean(marker);
    });
    results.phaseK.planSummaryAppears = await page.evaluate(() => {
      const panel = document.getElementById("plannerOutputPriority");
      const summary = document.getElementById("planSummary");
      return Boolean(panel && !panel.hidden && summary && summary.textContent.includes("Build direction") && summary.textContent.includes("Gear workspace"));
    });
    results.phaseK.statPriorityAppears = await page.evaluate(() => {
      const panel = document.getElementById("statPriorityPanel");
      return Boolean(panel && panel.textContent.includes("Primary") && panel.textContent.includes("Defensive"));
    });
    results.phaseK.plannerLayoutRevamped = await page.evaluate(() => {
      const command = document.querySelector(".planner-command-panel .planner-route-summary");
      const shell = document.querySelector(".planner-shell");
      const groups = document.querySelectorAll(".core-build-section .planner-form-group");
      const map = document.querySelector(".planner-output-map");
      const outputHeading = document.getElementById("panel-output-heading");
      return Boolean(
        command &&
        shell &&
        groups.length >= 4 &&
        map &&
        !map.hidden &&
        outputHeading?.textContent?.includes("Stat Plan"),
      );
    });
    results.phaseK.plannerAllocationControls = await page.evaluate(() => {
      const summary = document.getElementById("allocationSummary");
      const controls = document.getElementById("planTableControls");
      const nextActions = document.getElementById("planAfterTableActions");
      const rows = Array.from(document.querySelectorAll("#planTable tbody tr"));
      const hiddenMilestones = rows.filter((row) => row.hidden).length;
      controls?.querySelector('button[data-plan-table-view="every"]')?.click();
      const hiddenEvery = rows.filter((row) => row.hidden).length;
      controls?.querySelector('button[data-plan-table-view="full"]')?.click();
      const hiddenFull = rows.filter((row) => row.hidden).length;
      return Boolean(
        summary?.textContent?.includes("First 5 levels") &&
        summary?.textContent?.includes("Biggest gain") &&
        controls?.textContent?.includes("Milestones Only") &&
        controls?.textContent?.includes("Every Level") &&
        controls?.textContent?.includes("Show Full Table") &&
        nextActions?.textContent?.includes("Save Build") &&
        hiddenMilestones > 0 &&
        hiddenEvery === 0 &&
        hiddenFull === 0,
      );
    });
    results.phaseK.plannerLinksGearToInventory = await page.evaluate(() => {
      const routing = document.querySelector(".inventory-routing-card");
      const summary = document.getElementById("planSummary");
      return Boolean(
        routing?.textContent?.includes("Inventory") &&
        summary?.querySelector('a[href="./inventory.html"]'),
      );
    });
    results.phaseK.savePromptExists = await page.evaluate(() => {
      return Boolean(document.querySelector('[data-summary-action="open-save"], [data-summary-action="save"]'));
    });
    results.phaseK.dataQualityBadgesVisible = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll(".data-quality-badge"));
      return badges.some((badge) => /Exact|Estimated|Wiki-sourced|Needs Testing/.test(badge.textContent || ""));
    });

    await page.fill('[name="currentLevel"]', "10");
    await page.waitForTimeout(100);
    results.phaseK.staleBannerAppears = await page.isVisible("#stalePlanBanner");

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.getElementById("advancedPlannerOptions").open = true;
      document.querySelector('[data-disclosure-key="saved-builds"]').open = true;
      document.getElementById("tools-importexport").open = true;
    });
    await page.fill("#presetName", "Smoke Saved Build");
    await page.click("#saveBuildBtn");
    await page.waitForTimeout(150);
    results.phaseK.plannerGearPanelsRemoved = await page.evaluate(() =>
      !document.querySelector("#gearResults") &&
      !document.querySelector('[data-dashboard-view="gear"]') &&
      !document.querySelector('[data-dashboard-panel="gear"]'),
    );
    results.phaseK.plannerProgressToolsMoved = await page.evaluate(() =>
      !document.querySelector('[data-dashboard-view="progress"]') &&
      !document.querySelector('[data-dashboard-view="tools"]') &&
      !document.querySelector('[data-dashboard-panel="progress"]') &&
      !document.querySelector('[data-dashboard-panel="tools"]') &&
      Boolean(document.querySelector('a[href="./progress.html"]')) &&
      Boolean(document.querySelector('a[href="./tools.html"]')),
    );

    const hasDashboardViews = await page.isVisible("#dashboardViewNav");
    if (hasDashboardViews) {
      await page.click('#dashboardViewNav button[data-dashboard-view="plan"]');
      await page.waitForTimeout(150);
    }
    results.phaseK.syncToPlanExists = await page.isVisible("#syncToPlanBtn");

    const navLabels = await page.$$eval(".tab-nav .tab-link", (links) => links.map((a) => a.textContent.trim()));
    const expected = ["Dashboard", "Planner", "Inventory", "Bosses", "Progress", "Tools"];
    results.phaseK.sixTabNav = expected.every((label) => navLabels.includes(label));

    await page.goto(`${baseUrl}/inventory.html`, { waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.inventoryGearWorkspace = await page.evaluate(() => {
      const workspace = document.getElementById("invPlannerGearList");
      return Boolean(
        document.getElementById("inv-gear-workspace-title") &&
        document.getElementById("invQuickGearSearch") &&
        workspace?.querySelector(".inventory-recommendation-card") &&
        workspace?.querySelector(".gear-why") &&
        workspace?.querySelector(".gear-visible-facts") &&
        workspace?.querySelector(".gear-statline"),
      );
    });
    await page.fill("#invQuickGearSearch", "Greatsword");
    await page.waitForTimeout(150);
    results.phaseK.inventoryFastSearchActions = await page.evaluate(() => {
      const resultsPanel = document.getElementById("invQuickGearResults");
      return Boolean(
        resultsPanel &&
        !resultsPanel.hidden &&
        resultsPanel.querySelector(".quick-gear-result") &&
        resultsPanel.querySelector('[data-action="equip-recommendation"]') &&
        resultsPanel.querySelector('[data-action="mark-owned"]') &&
        resultsPanel.querySelector('[data-action="compare-add"]'),
      );
    });
    await page.click('#invQuickGearResults [data-action="compare-add"]');
    await page.waitForTimeout(100);
    results.phaseK.inventoryFastSearchCompare = await page.evaluate(() =>
      (document.getElementById("invCompareSummary")?.textContent || "").includes("Comparing"),
    );
    await page.click('#invQuickGearResults [data-action="equip-recommendation"]');
    await page.waitForTimeout(100);
    results.phaseK.inventoryFastSearchEquip = await page.evaluate(() =>
      (document.getElementById("invEquippedLoadout")?.textContent || "").includes("Equipped totals"),
    );
    await page.click("#invQuickGearClear");
    await page.waitForTimeout(100);
    results.phaseK.inventoryFastSearchClear = await page.evaluate(() => {
      const input = document.getElementById("invQuickGearSearch");
      const resultsPanel = document.getElementById("invQuickGearResults");
      return input?.value === "" && resultsPanel?.hidden === true && Boolean(document.querySelector("#invPlannerGearList .inventory-recommendation-card"));
    });
    await page.fill("#invBulkPaste", "Akumu Cloak");
    await page.click("#invMergeBulk");
    await page.click("#invSaveOwned");
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.inventoryToPlannerSync = await page.$eval(
      '[name="ownedItems"]',
      (input) => String(input.value || "").toLowerCase().includes("akumu cloak"),
    );

    await page.goto(`${baseUrl}/progress.html`, { waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.progressWorkspacePanels = await page.evaluate(() =>
      Boolean(
        document.getElementById("progressFloorTracker") &&
        document.getElementById("progressSkillChecklist") &&
        document.getElementById("progressPartyRoleAdvisor") &&
        document.querySelector("#progressFloorTracker .floor-tracker-cell"),
      ),
    );
    await page.click('#progressFloorTracker .floor-tracker-cell[data-floor="1"]');
    await page.waitForTimeout(100);
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.progressFloorPersists = await page.evaluate(() =>
      document.querySelector('#progressFloorTracker .floor-tracker-cell[data-floor="1"]')?.classList.contains("cleared") === true,
    );

    await page.goto(`${baseUrl}/tools.html`, { waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.toolsWorkspacePanels = await page.evaluate(() =>
      Boolean(
        document.getElementById("toolsCopyLoadoutBtn") &&
        document.getElementById("toolsCopyShareLinkBtn") &&
        document.getElementById("toolsPrintBtn") &&
        document.getElementById("toolsComparePanel") &&
        document.getElementById("toolsCalibrationPanel") &&
        document.getElementById("toolsExportJsonBtn") &&
        document.getElementById("toolsBackupJson"),
      ),
    );
    await page.click("#toolsExportJsonBtn");
    await page.waitForTimeout(100);
    results.phaseK.toolsBackupStillWorks = await page.evaluate(() =>
      (document.getElementById("toolsBackupJson")?.value || "").includes("schemaVersion"),
    );

    await page.goto(`${baseUrl}/dashboard.html`, { waitUntil: "networkidle", timeout: 15000 });
    await page.evaluate(() => {
      localStorage.removeItem("sbo-rebirth-planner.form-draft.v1");
      localStorage.removeItem("sbo-rebirth-planner.equipped.v1");
    });
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.savedBuildCountObjectStorage = await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem("sbo-rebirth-planner.builds.v1") || "{}");
      const countText = document.getElementById("dashSavedBuilds")?.textContent?.trim();
      return stored && !Array.isArray(stored) && Object.keys(stored).length === 1 && countText === "1";
    });
    results.phaseK.dashboardSavedOnlyStatusConsistent = await page.evaluate(() => {
      const continueText = document.getElementById("dashContinuePlanning")?.textContent || "";
      const statusText = document.getElementById("dashLastUpdated")?.textContent || "";
      return (
        continueText.includes("Open Planner to load") &&
        statusText.includes("Saved builds are available") &&
        !statusText.includes("No draft state saved yet")
      );
    });
    results.phaseK.dashboardActionCards = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return [
        "Continue Planning",
        "Next Recommended Boss",
        "Next Gear Upgrade",
        "Inventory Status",
        "Backup Your Progress",
      ].every((label) => text.includes(label));
    });

    const mobileBossPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobileBossPage.goto(`${baseUrl}/boss.html`, { waitUntil: "networkidle", timeout: 15000 });
    await mobileBossPage.locator(".boss-card").first().waitFor({ timeout: 5000 });
    results.phaseK.bossMobileActionsFit = await mobileBossPage.locator(".boss-card").first().evaluate((card) => {
      const actions = card.querySelector(".boss-card-actions");
      const cta = card.querySelector(".boss-card-cta");
      if (!actions || !cta) return false;
      const cardRect = card.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const ctaRect = cta.getBoundingClientRect();
      return (
        actionsRect.left >= cardRect.left - 1 &&
        actionsRect.right <= cardRect.right + 1 &&
        ctaRect.left >= cardRect.left - 1 &&
        ctaRect.right <= cardRect.right + 1 &&
        ctaRect.width >= 120
      );
    });
    await mobileBossPage.close();
  } catch (err) {
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));

  const allPass =
    results.phaseK?.staleBannerAppears &&
    results.phaseK?.syncToPlanExists &&
    results.phaseK?.sixTabNav &&
    results.phaseK?.inventoryToPlannerSync &&
    results.phaseK?.plannerGearPanelsRemoved &&
    results.phaseK?.plannerProgressToolsMoved &&
    results.phaseK?.progressWorkspacePanels &&
    results.phaseK?.progressFloorPersists &&
    results.phaseK?.toolsWorkspacePanels &&
    results.phaseK?.toolsBackupStillWorks &&
    results.phaseK?.bossMobileActionsFit &&
    results.phaseK?.projectionCoreLoaded &&
    results.phaseK?.floor19ItemCoverage &&
    results.phaseK?.floor19BossCoverage &&
    results.phaseK?.determinism?.pass &&
    results.phaseK?.startHereFlowVisible &&
    results.phaseK?.advancedControlsCollapsedByDefault &&
    results.phaseK?.emptyPlanStateShown &&
    results.phaseK?.exampleBuildGeneratesPlan &&
    results.phaseK?.planSummaryAppears &&
    results.phaseK?.statPriorityAppears &&
    results.phaseK?.plannerLayoutRevamped &&
    results.phaseK?.plannerAllocationControls &&
    results.phaseK?.plannerLinksGearToInventory &&
    results.phaseK?.inventoryGearWorkspace &&
    results.phaseK?.inventoryFastSearchActions &&
    results.phaseK?.inventoryFastSearchCompare &&
    results.phaseK?.inventoryFastSearchEquip &&
    results.phaseK?.inventoryFastSearchClear &&
    results.phaseK?.savePromptExists &&
    results.phaseK?.dataQualityBadgesVisible &&
    results.phaseK?.savedBuildCountObjectStorage &&
    results.phaseK?.dashboardSavedOnlyStatusConsistent &&
    results.phaseK?.dashboardActionCards &&
    results.errors.length === 0;

  process.exit(allPass ? 0 : 1);
})();
