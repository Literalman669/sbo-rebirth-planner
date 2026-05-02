const { app, BrowserWindow, Menu, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const APP_ROOT = path.resolve(__dirname, "..");
const START_PAGE = path.join(APP_ROOT, "dashboard.html");
const ICON_PATH = path.join(APP_ROOT, "desktop", "assets", "icon.ico");
const IS_SMOKE_TEST = process.env.SBO_DESKTOP_SMOKE === "1";
const externalUrls = [];

if (process.env.SBO_DESKTOP_SMOKE_USER_DATA) {
  app.setPath("userData", process.env.SBO_DESKTOP_SMOKE_USER_DATA);
}

app.setName("SBO Rebirth Planner");

function getWindowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(getWindowStatePath(), "utf8"));
    const width = Number(state.width);
    const height = Number(state.height);
    const x = Number(state.x);
    const y = Number(state.y);
    if (width >= 1040 && height >= 680) {
      return {
        width,
        height,
        ...(Number.isFinite(x) ? { x } : {}),
        ...(Number.isFinite(y) ? { y } : {}),
      };
    }
  } catch {
    // Missing or invalid window state should not block app startup.
  }
  return {};
}

function saveWindowState(win) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(win.getNormalBounds(), null, 2));
  } catch {
    // Window state persistence is best effort.
  }
}

function parseSmokeBounds(value) {
  const match = /^(\d+)x(\d+)(?:\+(-?\d+)\+(-?\d+))?$/.exec(String(value || ""));
  if (!match) return null;
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    ...(match[3] !== undefined ? { x: Number(match[3]) } : {}),
    ...(match[4] !== undefined ? { y: Number(match[4]) } : {}),
  };
}

function isLocalAppUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "file:") return false;
    const targetPath = path.resolve(fileURLToPath(parsed));
    return targetPath === APP_ROOT || targetPath.startsWith(`${APP_ROOT}${path.sep}`);
  } catch {
    return false;
  }
}

function openExternal(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (IS_SMOKE_TEST) {
        externalUrls.push(targetUrl);
        return;
      }
      shell.openExternal(targetUrl);
    }
  } catch {
    // Ignore malformed URLs from navigation events.
  }
}

function loadLocalPage(win, pageName) {
  win.loadFile(path.join(APP_ROOT, pageName));
}

function serializeMenuLabels() {
  const menu = Menu.getApplicationMenu();
  return (menu?.items || []).map((item) => ({
    label: item.label,
    submenu: (item.submenu?.items || []).filter((subItem) => subItem.type !== "separator").map((subItem) => subItem.label),
  }));
}

async function runSmokeProbe(win) {
  let urlAfterExternalProbe = win.webContents.getURL();
  if (process.env.SBO_DESKTOP_SMOKE_EXTERNAL === "1") {
    await win.webContents
      .executeJavaScript('window.location.href = "https://swordbloxonlinerebirth.fandom.com/wiki/Stats"', true)
      .catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 250));
    urlAfterExternalProbe = win.webContents.getURL();
  }

  saveWindowState(win);
  const result = {
    title: win.webContents.getTitle(),
    url: win.webContents.getURL(),
    urlAfterExternalProbe,
    windowBounds: win.getNormalBounds(),
    iconPath: ICON_PATH,
    externalUrls,
    menuLabels: serializeMenuLabels(),
  };
  if (process.env.SBO_DESKTOP_SMOKE_FILE) {
    fs.writeFileSync(process.env.SBO_DESKTOP_SMOKE_FILE, JSON.stringify(result, null, 2));
  }
  console.log(`SBO_DESKTOP_SMOKE:${JSON.stringify(result)}`);
  app.quit();
}

function createMainWindow() {
  const savedWindowState = readWindowState();
  const win = new BrowserWindow({
    title: "SBO:Rebirth Planner",
    width: 1320,
    height: 900,
    ...savedWindowState,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#f5f2ee",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const smokeBounds = parseSmokeBounds(process.env.SBO_DESKTOP_SMOKE_SET_BOUNDS);
  if (smokeBounds) {
    win.setBounds(smokeBounds);
  }

  win.once("ready-to-show", () => {
    if (!IS_SMOKE_TEST) {
      win.show();
    }
  });

  win.on("close", () => {
    saveWindowState(win);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalAppUrl(url)) {
      openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isLocalAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  if (IS_SMOKE_TEST) {
    win.webContents.once("did-finish-load", () => {
      runSmokeProbe(win).catch((err) => {
        console.error(err);
        app.exit(1);
      });
    });
  }

  win.loadFile(START_PAGE);
  return win;
}

function configureApplicationMenu() {
  const focusedWindow = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [{ role: "quit" }],
      },
      {
        label: "Navigate",
        submenu: [
          { label: "Dashboard", accelerator: "CommandOrControl+1", click: () => loadLocalPage(focusedWindow(), "dashboard.html") },
          { label: "Planner", accelerator: "CommandOrControl+2", click: () => loadLocalPage(focusedWindow(), "index.html") },
          { label: "Inventory", accelerator: "CommandOrControl+3", click: () => loadLocalPage(focusedWindow(), "inventory.html") },
          { label: "Bosses", accelerator: "CommandOrControl+4", click: () => loadLocalPage(focusedWindow(), "boss.html") },
          { label: "Progress", accelerator: "CommandOrControl+5", click: () => loadLocalPage(focusedWindow(), "progress.html") },
          { label: "Tools", accelerator: "CommandOrControl+6", click: () => loadLocalPage(focusedWindow(), "tools.html") },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { label: "Reset Zoom", role: "resetZoom" },
          { type: "separator" },
          { role: "toggleDevTools" },
        ],
      },
    ]),
  );
}

app.whenReady().then(() => {
  configureApplicationMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
