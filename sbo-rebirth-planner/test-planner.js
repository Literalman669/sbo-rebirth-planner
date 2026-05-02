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
      const ownership = document.querySelector('[data-disclosure-key="gear-inventory"]');
      const saved = document.querySelector('[data-disclosure-key="saved-builds"]');
      return Boolean(advanced && !advanced.open && statRef && !statRef.open && ownership && !ownership.open && saved && !saved.open);
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
    results.phaseK.plannerCostSummaryNotClipped = await page.evaluate(() => {
      const wrapper = document.querySelector("#recommendations .gear-cost-summary");
      const table = wrapper?.querySelector("table");
      if (!wrapper || !table) return false;
      const wrapperRect = wrapper.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const overflowX = getComputedStyle(wrapper).overflowX;
      return !(tableRect.right > wrapperRect.right + 1 && overflowX === "hidden");
    });

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
    await page.fill("#invBulkPaste", "Akumu Cloak");
    await page.click("#invMergeBulk");
    await page.click("#invSaveOwned");
    await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle", timeout: 15000 });
    results.phaseK.inventoryToPlannerSync = await page.$eval(
      '[name="ownedItems"]',
      (input) => String(input.value || "").toLowerCase().includes("akumu cloak"),
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
    results.phaseK?.plannerCostSummaryNotClipped &&
    results.phaseK?.bossMobileActionsFit &&
    results.phaseK?.projectionCoreLoaded &&
    results.phaseK?.floor19ItemCoverage &&
    results.phaseK?.floor19BossCoverage &&
    results.phaseK?.determinism?.pass &&
    results.phaseK?.startHereFlowVisible &&
    results.phaseK?.advancedControlsCollapsedByDefault &&
    results.phaseK?.emptyPlanStateShown &&
    results.phaseK?.exampleBuildGeneratesPlan &&
    results.phaseK?.dataQualityBadgesVisible &&
    results.phaseK?.savedBuildCountObjectStorage &&
    results.phaseK?.dashboardSavedOnlyStatusConsistent &&
    results.phaseK?.dashboardActionCards &&
    results.errors.length === 0;

  process.exit(allPass ? 0 : 1);
})();
