import { app, shell } from "electron";
import path from "node:path";
import {
  readBrowserSetting,
  writeBrowserSetting,
  loadBrowserSnapshot,
  saveBrowserSnapshot,
} from "@/services/browser-database";
import {
  setupPreferencesSchema,
  importedBookmarksSchema,
} from "@/lib/browser/setup";

export function getSetupPreferences() {
  return setupPreferencesSchema.parse(readBrowserSetting("browserSetup", {}));
}
export function saveSetupPreferences(input: unknown) {
  const preferences = setupPreferencesSchema.parse(input);
  writeBrowserSetting("browserSetup", preferences);
  return preferences;
}
export function importBookmarks(input: unknown, windowId: string) {
  const imported = importedBookmarksSchema.parse(input);
  const snapshot = loadBrowserSnapshot(windowId);
  const urls = new Set(snapshot.bookmarks.map((item) => item.url));
  const additions = imported
    .filter((item) => {
      if (urls.has(item.url)) return false;
      urls.add(item.url);
      return true;
    })
    .map((item) => ({ ...item, id: crypto.randomUUID() }));
  if (snapshot.bookmarks.length + additions.length > 10000)
    throw new Error("Bookmark limit exceeded.");
  saveBrowserSnapshot(
    { ...snapshot, bookmarks: [...snapshot.bookmarks, ...additions] },
    windowId,
  );
  return additions;
}
export async function openDefaultBrowserSettings() {
  if (process.platform === "darwin")
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.Desktop-Settings.extension",
    );
  else if (process.platform === "win32")
    await shell.openExternal("ms-settings:defaultapps");
  else
    throw new Error(
      "Open your system settings and select Gorth as the default browser.",
    );
}
export function isDefaultBrowser() {
  return (
    app.isPackaged &&
    app.isDefaultProtocolClient("http") &&
    app.isDefaultProtocolClient("https")
  );
}
export function revealDockApplication() {
  if (process.platform !== "darwin" || !app.isPackaged)
    throw new Error(
      "Install the packaged macOS app first, then drag it into the Dock.",
    );
  shell.showItemInFolder(path.resolve(app.getPath("exe"), "../../.."));
}
