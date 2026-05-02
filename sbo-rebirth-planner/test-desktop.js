const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = __dirname;
const packageJson = require("./package.json");
const mainPath = path.join(rootDir, "desktop", "main.cjs");
const iconIcoPath = path.join(rootDir, "desktop", "assets", "icon.ico");
const iconSvgPath = path.join(rootDir, "desktop", "assets", "icon.svg");

assert.equal(packageJson.main, "desktop/main.cjs", "package.json must point Electron at the desktop main process");
assert.ok(packageJson.scripts.desktop, "package.json must expose npm run desktop");
assert.ok(packageJson.scripts["desktop:package"], "package.json must expose npm run desktop:package");
assert.ok(packageJson.scripts["desktop:package:portable"], "package.json must expose portable packaging");
assert.ok(packageJson.scripts["desktop:package:installer"], "package.json must expose installer packaging");
assert.ok(packageJson.scripts["desktop:icons"], "package.json must expose desktop icon generation");
assert.ok(existsSync(mainPath), "desktop/main.cjs must exist");
assert.ok(existsSync(iconIcoPath), "desktop icon.ico must exist");
assert.ok(existsSync(iconSvgPath), "desktop icon.svg must exist");
assert.equal(packageJson.build.win.icon, "desktop/assets/icon.ico", "Windows build must use the desktop icon");
assert.deepEqual(
  packageJson.build.win.target.map((target) => target.target).sort(),
  ["nsis", "portable"],
  "Windows build must include installer and portable targets",
);
assert.equal(packageJson.build.nsis.createDesktopShortcut, true, "installer must create a Desktop shortcut");
assert.equal(packageJson.build.nsis.createStartMenuShortcut, true, "installer must create a Start Menu shortcut");

let electronPath;
try {
  electronPath = require("electron");
} catch (err) {
  throw new Error(`Electron must be installed before running the desktop smoke test: ${err.message}`);
}

function runDesktopSmoke(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, [mainPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        SBO_DESKTOP_SMOKE: "1",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`desktop smoke timed out\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    }, 15000);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      try {
        assert.equal(code, 0, `desktop smoke process exited with ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        const smokeLine = stdout
          .split(/\r?\n/)
          .find((line) => line.startsWith("SBO_DESKTOP_SMOKE:"));
        assert.ok(smokeLine, `missing desktop smoke output\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        resolve(JSON.parse(smokeLine.slice("SBO_DESKTOP_SMOKE:".length)));
      } catch (err) {
        reject(err);
      }
    });
  });
}

(async () => {
  const tempUserData = mkdtempSync(path.join(os.tmpdir(), "sbo-desktop-smoke-"));
  try {
    const firstResult = await runDesktopSmoke({
      SBO_DESKTOP_SMOKE_USER_DATA: tempUserData,
      SBO_DESKTOP_SMOKE_EXTERNAL: "1",
      SBO_DESKTOP_SMOKE_SET_BOUNDS: "1180x760+32+48",
    });

    assert.equal(firstResult.title, "SBO:Rebirth Dashboard v0.9.7");
    assert.match(firstResult.url, /dashboard\.html$/);
    assert.equal(firstResult.windowBounds.width, 1180);
    assert.equal(firstResult.windowBounds.height, 760);
    assert.ok(firstResult.iconPath.endsWith("desktop\\assets\\icon.ico") || firstResult.iconPath.endsWith("desktop/assets/icon.ico"));
    assert.deepEqual(firstResult.externalUrls, ["https://swordbloxonlinerebirth.fandom.com/wiki/Stats"]);
    assert.match(firstResult.urlAfterExternalProbe, /dashboard\.html$/);

    const flattenedMenu = firstResult.menuLabels.flatMap((item) => [item.label, ...item.submenu]);
    for (const label of ["Navigate", "Dashboard", "Planner", "Inventory", "Bosses", "Progress", "Tools", "Reload", "Reset Zoom", "Toggle Developer Tools"]) {
      assert.ok(flattenedMenu.includes(label), `desktop menu must include ${label}`);
    }

    const secondResult = await runDesktopSmoke({
      SBO_DESKTOP_SMOKE_USER_DATA: tempUserData,
    });
    assert.equal(secondResult.windowBounds.width, 1180);
    assert.equal(secondResult.windowBounds.height, 760);
  } finally {
    rmSync(tempUserData, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
