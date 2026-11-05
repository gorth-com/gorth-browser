import { app, BrowserWindow, ipcMain, shell, powerMonitor } from "electron";
import { spawn } from "node:child_process";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import {
  getSystemPreferences,
  saveSystemPreferences,
} from "@/main/services/system-preferences";
import { readBattery } from "@/main/services/battery";
import { requestConfirmation } from "@/main/services/confirmation";
import {
  energySaverActive,
  type BatteryState,
  type SystemSnapshot,
} from "@/lib/browser/system";

let battery: BatteryState = { onBattery: null, percent: null };
let initialAcceleration = true;
let quitting = false;
let quitPending = false;
const windows = new Map<BrowserWindow, () => number>();
const closing = new WeakSet<BrowserWindow>();
const pending = new WeakSet<BrowserWindow>();
export function isSystemQuitting() {
  return quitting;
}
// Internal lifecycle only: a stopped dev server cannot render a Quit dialog.
export function quitBrowserForShutdown() {
  quitting = true;
  app.quit();
}
export function systemSnapshot(): SystemSnapshot {
  const preferences = getSystemPreferences();
  return {
    preferences,
    battery,
    energyActive: energySaverActive(preferences, battery),
    restartRequired: initialAcceleration !== preferences.hardwareAcceleration,
  };
}
function broadcast() {
  const snapshot = systemSnapshot();
  for (const window of windows.keys())
    if (!window.isDestroyed())
      window.webContents.send("system:changed", snapshot);
}
export function installSystemWindow(
  window: BrowserWindow,
  tabCount: () => number,
) {
  windows.set(window, tabCount);
  window.once("closed", () => windows.delete(window));
  window.on("close", (event) => {
    if (
      quitting ||
      closing.delete(window) ||
      tabCount() <= 1 ||
      !getSystemPreferences().warnMultipleTabs
    )
      return;
    event.preventDefault();
    if (pending.has(window)) return;
    pending.add(window);
    void requestConfirmation(window, {
      title: `Close window with ${tabCount()} tabs?`,
      description: "All tabs in this window will close.",
      confirmLabel: "Close window",
    }).then((confirmed) => {
      pending.delete(window);
      if (confirmed && !window.isDestroyed()) {
        closing.add(window);
        window.close();
      }
    });
  });
  window.on("enter-full-screen", () => {
    if (getSystemPreferences().fullscreenReminder)
      window.webContents.send("system:fullscreen-reminder");
  });
}
export function initializeSystemStartup() {
  initialAcceleration = getSystemPreferences().hardwareAcceleration;
  if (!initialAcceleration) app.disableHardwareAcceleration();
  app.on("before-quit", (event) => {
    const owners = [...windows.keys()].filter(
      (window) => !window.isDestroyed(),
    );
    const owner = owners.find((window) => window.isFocused()) ?? owners[0];
    if (quitting || !owner || !getSystemPreferences().warnQuit) {
      quitting = true;
      return;
    }
    event.preventDefault();
    if (quitPending) return;
    quitPending = true;
    if (owner.isMinimized()) owner.restore();
    owner.show();
    owner.focus();
    void requestConfirmation(owner, {
      title: "Quit Gorth Browser?",
      description: "All browser windows will close.",
      confirmLabel: "Quit",
    }).then((confirmed) => {
      quitPending = false;
      if (confirmed) {
        quitting = true;
        app.quit();
      }
    });
  });
}
export function startSystemPowerMonitor() {
  let reading = false;
  const refresh = async () => {
    if (reading) return;
    reading = true;
    try {
      battery = await readBattery();
      if (process.platform === "darwin" || process.platform === "win32")
        battery.onBattery = powerMonitor.isOnBatteryPower();
      broadcast();
    } finally {
      reading = false;
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), 30_000);
  timer.unref();
  powerMonitor.on("on-ac", refresh);
  powerMonitor.on("on-battery", refresh);
  powerMonitor.on("resume", refresh);
  app.once("will-quit", () => {
    clearInterval(timer);
    powerMonitor.off("on-ac", refresh);
    powerMonitor.off("on-battery", refresh);
    powerMonitor.off("resume", refresh);
  });
}
export async function openSystemProxySettings() {
  if (process.platform === "win32")
    return shell.openExternal("ms-settings:network-proxy");
  if (process.platform === "darwin")
    return shell.openExternal(
      "x-apple.systempreferences:com.apple.Network-Settings.extension?Proxies",
    );
  await new Promise<void>((resolve, reject) => {
    const child = spawn("gnome-control-center", ["network"], {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () =>
      reject(
        new Error(
          "Open your desktop's Network / Proxy settings manually, or use Gorth's Proxy settings page.",
        ),
      ),
    );
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
export function registerSystemIpc() {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (
      !owner ||
      !windows.has(owner) ||
      owner.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      throw new Error("Untrusted system request.");
    return owner;
  };
  ipcMain.handle("system:get", (event) => {
    trusted(event);
    return systemSnapshot();
  });
  ipcMain.handle("system:update", (event, input: unknown) => {
    trusted(event);
    saveSystemPreferences(input);
    broadcast();
    return systemSnapshot();
  });
  ipcMain.handle("system:open-proxy", (event) => {
    trusted(event);
    return openSystemProxySettings();
  });
  ipcMain.handle("system:close-last-tab", (event) => {
    const owner = trusted(event);
    if (getSystemPreferences().closeLastTab && windows.get(owner)!() <= 1)
      owner.close();
  });
}
