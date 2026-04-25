const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const reportPath = path.join(ROOT, "data", "wiki-raw", "WIKI_SYNC_REPORT.json");

const MAX_REJECTED_TOTAL = Number(process.env.WIKI_SYNC_MAX_REJECTED_TOTAL || 60);
const MAX_REJECTED_WEAPONS = Number(process.env.WIKI_SYNC_MAX_REJECTED_WEAPONS || 40);
const MAX_REJECTED_ARMOR = Number(process.env.WIKI_SYNC_MAX_REJECTED_ARMOR || 20);
const MAX_REJECTED_SHIELDS = Number(process.env.WIKI_SYNC_MAX_REJECTED_SHIELDS || 10);
const MAX_REJECTED_BOSSES = Number(process.env.WIKI_SYNC_MAX_REJECTED_BOSSES || 15);
const MAX_REJECTED_MINIBOSSES = Number(process.env.WIKI_SYNC_MAX_REJECTED_MINIBOSSES || 15);

function fail(message) {
  console.error(`[wiki-sync-validate] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  fail(`Missing report: ${reportPath}. Run wiki sync before validating.`);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const rejected = Array.isArray(report.rejected) ? report.rejected : [];
const rejectedByCategory = rejected.reduce((acc, entry) => {
  const key = String(entry?.category || "unknown").toLowerCase();
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const thresholds = [
  ["total", rejected.length, MAX_REJECTED_TOTAL],
  ["weapon", rejectedByCategory.weapon || 0, MAX_REJECTED_WEAPONS],
  ["armor", rejectedByCategory.armor || 0, MAX_REJECTED_ARMOR],
  ["shield", rejectedByCategory.shield || 0, MAX_REJECTED_SHIELDS],
  ["boss", rejectedByCategory.boss || 0, MAX_REJECTED_BOSSES],
  ["miniboss", rejectedByCategory.miniboss || 0, MAX_REJECTED_MINIBOSSES],
];

const violations = thresholds.filter(([, count, max]) => count > max);

if (violations.length) {
  const detail = violations
    .map(([label, count, max]) => `${label}: ${count} > ${max}`)
    .join(", ");
  fail(`Threshold exceeded (${detail}).`);
}

console.log(
  `[wiki-sync-validate] PASS total=${rejected.length}, weapon=${rejectedByCategory.weapon || 0}, armor=${rejectedByCategory.armor || 0}, shield=${rejectedByCategory.shield || 0}, boss=${rejectedByCategory.boss || 0}, miniboss=${rejectedByCategory.miniboss || 0}`,
);
