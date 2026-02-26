/**
 * Verification test for Phase K and Phase L.
 * Run: npx playwright test test-planner.js (or: node test-planner.js with playwright installed)
 * Or: npx -y playwright run test-planner.js --config - << 'EOF'
 * Actually using a simpler approach - run with node + playwright via require.
 */
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.BASE_URL || "http://localhost:60290";
  const results = { phaseK: {}, phaseL: {}, errors: [] };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Load planner
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
    results.loaded = true;

    // 2. Phase K: Determinism test
    const determinismResult = await page.evaluate(() => {
      return typeof window.__sboRunDeterminismTest === "function"
        ? window.__sboRunDeterminismTest()
        : { pass: false, error: "Test not found" };
    });
    results.phaseK.determinism = determinismResult;

    // 3. Phase K: Stale banner - change input, check banner appears
    await page.fill('[name="currentLevel"]', "10");
    await page.waitForTimeout(100);
    const staleBannerVisible = await page.isVisible("#stalePlanBanner");
    results.phaseK.staleBannerAppears = staleBannerVisible;

    // 4. Phase K: Generate Plan and check Sync to plan exists
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    const syncBtnExists = await page.isVisible("#syncToPlanBtn");
    results.phaseK.syncToPlanExists = syncBtnExists;

    // 5. Phase L: Check AI panel and config
    const hasAiConfig = await page.evaluate(() => !!window.SBO_AI_CONFIG?.anonKey);
    results.phaseL.hasConfig = hasAiConfig;

    const aiPanelExists = await page.isVisible("#aiChatPanel");
    results.phaseL.aiPanelExists = aiPanelExists;

    // 6. Phase L: Expand AI panel and send message
    const aiPanel = page.locator("#aiChatPanel");
    await aiPanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const panelToggle = aiPanel.locator("button.panel-toggle");
    const toggleExists = await panelToggle.count() > 0;
    if (toggleExists) {
      const toggleText = await panelToggle.textContent();
      if (toggleText?.toLowerCase().includes("expand")) {
        await panelToggle.click();
        await page.waitForTimeout(500);
      }
    }
    await page.waitForSelector("#aiChatInput", { state: "visible", timeout: 8000 });

    await page.fill("#aiChatInput", "How does multi-hit work?");
    await page.click("#aiChatSendBtn");
    await page.waitForTimeout(12000); // HF can be slow on cold start

    const assistantMsgs = page.locator(".ai-chat-message.assistant");
    const count = await assistantMsgs.count();
    const hasResponse = count > 0;
    let responseText = "";
    if (hasResponse) {
      responseText = await assistantMsgs.nth(count - 1).textContent();
    }
    results.phaseL.aiResponded = hasResponse;
    results.phaseL.responseLength = responseText?.length || 0;
    results.phaseL.responsePreview = responseText ? responseText.slice(0, 150) + (responseText.length > 150 ? "..." : "") : "";
  } catch (err) {
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));

  const corePass =
    results.phaseK?.staleBannerAppears &&
    results.phaseK?.syncToPlanExists &&
    results.phaseL?.hasConfig &&
    results.phaseL?.aiPanelExists;

  const allPass = corePass && results.phaseK?.determinism?.pass && results.phaseL?.aiResponded && results.errors.length === 0;
  process.exit(allPass ? 0 : 1);
})();
