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

    await page.fill('[name="currentLevel"]', "10");
    await page.waitForTimeout(100);
    results.phaseK.staleBannerAppears = await page.isVisible("#stalePlanBanner");

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
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
    results.phaseK?.projectionCoreLoaded &&
    results.phaseK?.floor19ItemCoverage &&
    results.phaseK?.floor19BossCoverage &&
    results.phaseK?.determinism?.pass &&
    results.errors.length === 0;

  process.exit(allPass ? 0 : 1);
})();
