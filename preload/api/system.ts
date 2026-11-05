import { ipcRenderer } from "electron";
import type { SystemPreferences, SystemSnapshot } from "@/lib/browser/system";
export const systemApi = {
  get: (): Promise<SystemSnapshot> => ipcRenderer.invoke("system:get"),
  update: (preferences: SystemPreferences): Promise<SystemSnapshot> =>
    ipcRenderer.invoke("system:update", preferences),
  openProxySettings: (): Promise<void> =>
    ipcRenderer.invoke("system:open-proxy"),
  closeLastTab: (): Promise<void> =>
    ipcRenderer.invoke("system:close-last-tab"),
  onChanged: (callback: (snapshot: SystemSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: SystemSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on("system:changed", listener);
    return () => {
      ipcRenderer.removeListener("system:changed", listener);
    };
  },
  onFullscreenReminder: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("system:fullscreen-reminder", listener);
    return () => {
      ipcRenderer.removeListener("system:fullscreen-reminder", listener);
    };
  },
};
