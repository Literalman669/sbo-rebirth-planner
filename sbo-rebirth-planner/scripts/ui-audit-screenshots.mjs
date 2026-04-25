import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, process.argv[2] || "ui-audit/baseline");
fs.mkdirSync(out, { recursive: true });

const url = process.env.PLANNER_URL || "http://127.0.0.1:60290/index.html";
const viewports = [
  ["1280", 1280, 720],
  ["900", 900, 720],
  ["390", 390, 844],
];

const browser = await chromium.launch();
for (const [name, w, h] of viewports) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
console.log("Wrote screenshots to", out);
