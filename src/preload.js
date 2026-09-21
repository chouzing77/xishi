/* 安全桥接：把窗口控制能力暴露给页面（window.mochi），
   页面本身依然没有 Node 权限（contextIsolation: true） */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mochi", {
  // 窗口
  close:   () => ipcRenderer.send("win-close"),
  compact: () => ipcRenderer.send("win-compact"),
  restore: () => ipcRenderer.send("win-restore"),
  fit:     (w, h) => ipcRenderer.send("win-fit", w, h),

  // 置顶
  setTop:  (on) => ipcRenderer.send("win-set-top", !!on),
  getTop:  () => ipcRenderer.sendSync("win-get-top"),
  onTopChanged: (cb) => {
    if (typeof cb !== "function") return;
    ipcRenderer.on("top-changed", (e, on) => cb(!!on));
  },

  // 开机自启
  getAutoLaunch: () => ipcRenderer.invoke("win-get-autolaunch"),
  setAutoLaunch: (on) => ipcRenderer.invoke("win-set-autolaunch", !!on),

  // 到点提醒（系统通知）
  notify: (title, body) => ipcRenderer.send("notify", { title: title, body: body }),

  // 备份
  backup:  (json) => ipcRenderer.invoke("backup-save", json),
  openBackupDir: () => ipcRenderer.invoke("open-backup-dir"),

  // 环境信息
  info: () => ipcRenderer.invoke("win-info")
});
