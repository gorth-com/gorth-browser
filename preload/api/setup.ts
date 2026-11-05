import { ipcRenderer } from "electron";
import type { SetupPreferences } from "@/lib/browser/setup";
import type { PersistedBookmark } from "@/lib/browser/persistence";

export const setupApi = {
  isDefaultBrowser: () =>
    ipcRenderer.invoke("setup:is-default-browser") as Promise<boolean>,
  ready: () => ipcRenderer.invoke("setup:ready") as Promise<void>,
  load: () => ipcRenderer.invoke("setup:load") as Promise<SetupPreferences>,
  save: (preferences: SetupPreferences) =>
    ipcRenderer.invoke("setup:save", preferences) as Promise<SetupPreferences>,
  importBookmarks: (items: { title: string; url: string }[]) =>
    ipcRenderer.invoke("setup:import", items) as Promise<number>,
  openDefaultBrowserSettings: () =>
    ipcRenderer.invoke("setup:default-browser") as Promise<void>,
  revealDockApplication: () =>
    ipcRenderer.invoke("setup:dock") as Promise<void>,
  onChanged: (callback: (preferences: SetupPreferences) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: SetupPreferences,
    ) => callback(value);
    ipcRenderer.on("setup:changed", listener);
    return () => {
      ipcRenderer.removeListener("setup:changed", listener);
    };
  },
  onBookmarksImported: (callback: (items: PersistedBookmark[]) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      items: PersistedBookmark[],
    ) => callback(items);
    ipcRenderer.on("setup:bookmarks", listener);
    return () => {
      ipcRenderer.removeListener("setup:bookmarks", listener);
    };
  },
};
