import { ipcMain } from "electron";
import { isDefaultBrowser } from "@/main/services/browser-setup";
import { markBrowserLinksReady } from "@/main/services/browser-links";
import {
  getWindowFromSender,
  getBrowserState,
  getBrowserWindows,
} from "@/main/windows/capital";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import {
  getSetupPreferences,
  saveSetupPreferences,
  importBookmarks,
  openDefaultBrowserSettings,
  revealDockApplication,
} from "@/main/services/browser-setup";

export function registerSetupIpc() {
  function trusted(event: Electron.IpcMainInvokeEvent) {
    const window = getWindowFromSender(event.sender);
    if (
      !window ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.sender.getURL(), getRpcRendererUrl())
    )
      throw new Error("Untrusted browser settings request.");
    return window;
  }
  ipcMain.handle("setup:ready", (event) => {
    markBrowserLinksReady(trusted(event));
  });
  ipcMain.handle("setup:is-default-browser", (event) => {
    trusted(event);
    return isDefaultBrowser();
  });
  ipcMain.handle("setup:load", (event) => {
    trusted(event);
    return getSetupPreferences();
  });
  ipcMain.handle("setup:save", (event, input: unknown) => {
    trusted(event);
    const result = saveSetupPreferences(input);
    for (const window of getBrowserWindows())
      window.webContents.send("setup:changed", result);
    return result;
  });
  ipcMain.handle("setup:import", (event, input: unknown) => {
    const window = trusted(event);
    const additions = importBookmarks(input, getBrowserState(window).sessionId);
    for (const target of getBrowserWindows())
      target.webContents.send("setup:bookmarks", additions);
    return additions.length;
  });
  ipcMain.handle("setup:default-browser", (event) => {
    trusted(event);
    return openDefaultBrowserSettings();
  });
  ipcMain.handle("setup:dock", (event) => {
    trusted(event);
    revealDockApplication();
  });
}
