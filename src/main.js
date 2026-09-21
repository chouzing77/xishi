const { app, BrowserWindow, globalShortcut, ipcMain, screen, Notification, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// 任务栏/通知归组用；与 package.json 的 appId 保持一致
app.setAppUserModelId("com.zhouzhou.mochiboard");

const ICON = path.join(__dirname, "icon.ico");
const pad2 = n => (n < 10 ? "0" + n : "" + n);

let win = null;
let normalBounds = null;          // 便签模式前的窗口位置/尺寸，用于还原
let saveTimer = null;

const FULL_W = 940, FULL_H = 780;
const NOTE_W = 340, NOTE_H = 460;
const MIN_W = 300, MIN_H = 240;

/* ---------- 窗口位置记忆（存 userData/win-state.json） ---------- */
const stateFile = () => path.join(app.getPath("userData"), "win-state.json");

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")) || {}; }
  catch (e) { return {}; }
}

function saveState() {
  if (!win) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const b = win.getBounds();
      const s = loadState();
      s.x = b.x; s.y = b.y; s.w = b.width; s.h = b.height;
      fs.writeFileSync(stateFile(), JSON.stringify(s));
    } catch (e) { /* 忽略写入失败 */ }
  }, 400);
}

/* 保证窗口始终有可见部分（换屏 / 拔显示器后不跑到屏幕外） */
function clampToWorkArea(b) {
  const wa = screen.getDisplayMatching(b).workArea;
  const width = Math.max(MIN_W, Math.min(b.width, wa.width));
  const height = Math.max(MIN_H, Math.min(b.height, wa.height));
  const x = Math.round(Math.max(wa.x, Math.min(b.x, wa.x + wa.width - width)));
  const y = Math.round(Math.max(wa.y, Math.min(b.y, wa.y + wa.height - height)));
  return { x, y, width: Math.round(width), height: Math.round(height) };
}

function createWindow() {
  const st = loadState();
  const hasSaved = Number.isFinite(st.x) && Number.isFinite(st.y);
  const init = hasSaved
    ? clampToWorkArea({ x: st.x, y: st.y, width: st.w || FULL_W, height: st.h || FULL_H })
    : { width: FULL_W, height: FULL_H };

  win = new BrowserWindow(Object.assign({
    minWidth: MIN_W,
    minHeight: MIN_H,
    frame: false,               // 无边框：用看板顶栏代替系统标题栏
    transparent: true,          // 桌面透明：可透过应用看到壁纸与桌面图标
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: true,
    skipTaskbar: false,
    icon: ICON,
    title: "毛玻璃日程看板",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }, hasSaved ? init : {}));

  if (!hasSaved) win.center();

  win.loadFile(path.join(__dirname, "index.html"));
  win.setMenuBarVisibility(false);

  win.on("move", saveState);
  win.on("resize", saveState);
  win.on("closed", () => { win = null; });
}

/* ---------- 窗口置顶 ---------- */
function setTop(on) {
  if (!win) return;
  win.setAlwaysOnTop(!!on, "floating");
  if (win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send("top-changed", !!on);
  }
}

/* ---------- 单实例：重复双击只唤起已有窗口，不会开出两份数据 ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) { createWindow(); return; }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(() => {
    createWindow();

    // 全局快捷键：Ctrl/Cmd + T 切换置顶
    globalShortcut.register("CommandOrControl+T", () => setTop(!win || !win.isAlwaysOnTop()));

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

/* ---------- 渲染进程发来的窗口控制指令 ---------- */

ipcMain.on("win-close", () => { if (win) win.close(); });

ipcMain.on("win-set-top", (e, on) => setTop(on));

ipcMain.on("win-get-top", (e) => {
  e.returnValue = win ? win.isAlwaysOnTop() : false;
});

/* 便利贴：只显示今日日程，贴到当前屏幕右下角并置顶 */
ipcMain.on("win-compact", () => {
  if (!win) return;
  if (!normalBounds) normalBounds = win.getBounds();

  const disp = screen.getDisplayMatching(win.getBounds());
  const wa = disp.workArea;                       // 已排除任务栏
  win.setAlwaysOnTop(true, "floating");
  win.setBounds({
    x: Math.round(wa.x + wa.width - NOTE_W - 18),
    y: Math.round(wa.y + wa.height - NOTE_H - 18),
    width: NOTE_W,
    height: NOTE_H
  });
});

/* 还原完整看板 */
ipcMain.on("win-restore", () => {
  if (!win) return;
  win.setAlwaysOnTop(false);
  if (normalBounds) {
    win.setBounds(clampToWorkArea(normalBounds));
    normalBounds = null;
  } else {
    win.setSize(FULL_W, FULL_H);
    win.center();
  }
});

/* 窗口贴合看板：让透明窗口紧贴内容，避免大片透明区域挡住桌面点击 */
ipcMain.on("win-fit", (e, w, h) => {
  if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return;
  const b = win.getBounds();
  const d = Math.abs(b.width - w) > 2 || Math.abs(b.height - h) > 2;
  if (!d) return;
  const nb = clampToWorkArea({ x: b.x, y: b.y, width: Math.max(MIN_W, Math.ceil(w)), height: Math.max(MIN_H, Math.ceil(h)) });
  win.setBounds(nb);
});

/* 开机自启 */
ipcMain.handle("win-get-autolaunch", () => {
  try { return app.getLoginItemSettings().openAtLogin; } catch (e) { return false; }
});

ipcMain.handle("win-set-autolaunch", (e, on) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: false, path: process.execPath });
    return app.getLoginItemSettings().openAtLogin;
  } catch (err) { return false; }
});

/* 让渲染进程知道当前是否在桌面客户端里跑（决定是否显示窗口按钮） */
ipcMain.handle("win-info", () => ({
  desktop: true,
  platform: process.platform
}));

/* 到点提醒：渲染进程到点后请求弹系统通知 */
ipcMain.on("notify", (e, payload) => {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title: (payload && payload.title) || "日程提醒",
      body: (payload && payload.body) || "",
      icon: ICON,
      urgency: "critical",
      timeoutType: "never"
    });
    n.on("click", () => { if (win) { win.show(); win.focus(); } });
    n.show();
  } catch (err) { /* 通知失败不影响主流程 */ }
});

/* 每日自动备份：把渲染进程传来的数据快照写进 userData\backups，只留最近 7 份 */
function backupDir() { return path.join(app.getPath("userData"), "backups"); }

ipcMain.handle("backup-save", (e, json) => {
  try {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const name = "日程看板_" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + ".json";
    fs.writeFileSync(path.join(dir, name), String(json), "utf8");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
    while (files.length > 7) {
      const old = files.shift();
      try { fs.unlinkSync(path.join(dir, old)); } catch (err) { }
    }
    return { ok: true, file: name, kept: fs.readdirSync(dir).filter(f => f.endsWith(".json")).length };
  } catch (err) {
    return { ok: false, msg: String(err && err.message) };
  }
});

ipcMain.handle("open-backup-dir", () => {
  try {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
    return dir;
  } catch (err) { return ""; }
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
