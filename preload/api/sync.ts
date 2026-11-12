import { ipcRenderer } from "electron";
import type { BrowserSnapshot } from "@/lib/browser/persistence";
import type { SyncOptions } from "@/lib/browser/sync";
import type { syncStatus } from "@/main/services/sync";
export const syncApi = {
  status: () => ipcRenderer.invoke("sync:status") as Promise<ReturnType<typeof syncStatus>>,
  configure: (options: SyncOptions) => ipcRenderer.invoke("sync:configure", options) as Promise<ReturnType<typeof syncStatus>>,
  now: () => ipcRenderer.invoke("sync:now") as Promise<ReturnType<typeof syncStatus>>,
  backups: (action: "list" | "save" | "restore" | "delete", id?: string) => ipcRenderer.invoke("sync:backups", action, id) as Promise<unknown>,
  onApplied: (callback: (snapshot: BrowserSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: BrowserSnapshot) => callback(snapshot);
    ipcRenderer.on("sync:applied", listener);
    return () => { ipcRenderer.removeListener("sync:applied", listener); };
  },
};
