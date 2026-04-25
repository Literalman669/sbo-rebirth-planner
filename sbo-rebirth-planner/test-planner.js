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

    await page.fill('[name="currentLevel"]', "10");
    await page.waitForTimeout(100);
    results.phaseK.staleBannerAppears = await page.isVisible("#stalePlanBanner");

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    results.phaseK.syncToPlanExists = await page.isVisible("#syncToPlanBtn");
  } catch (err) {
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));

  const allPass =
    results.phaseK?.staleBannerAppears &&
    results.phaseK?.syncToPlanExists &&
    results.phaseK?.determinism?.pass &&
    results.errors.length === 0;

  process.exit(allPass ? 0 : 1);
})();
