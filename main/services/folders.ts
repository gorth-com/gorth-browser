import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import {
  getDownloadPreferences,
  chooseDownloadDirectory,
} from "@/main/services/downloads";
import type { FolderSnapshot } from "@/utils/folder-interface";

export function browserFolderSnapshot(): FolderSnapshot {
  const executable = path.dirname(app.getPath("exe"));
  const application = app.isPackaged
    ? process.platform === "darwin"
      ? path.resolve(executable, "../..")
      : executable
    : app.getAppPath();
  const paths = [
    {
      id: "application",
      label: "Application",
      path: application,
      editable: false,
    },
    {
      id: "data",
      label: "Application data",
      path: app.getPath("userData"),
      editable: false,
    },
    {
      id: "downloads",
      label: "Downloads",
      path: getDownloadPreferences().directory,
      editable: true,
    },
    { id: "logs", label: "Logs", path: app.getPath("logs"), editable: false },
    {
      id: "cache",
      label: "Session data",
      path: app.getPath("sessionData"),
      editable: false,
    },
  ];
  return {
    folders: paths.map((folder) => ({
      ...folder,
      activePath: folder.path,
      description: folder.editable
        ? "New downloads use this folder immediately. Existing downloads stay where they are."
        : "Application-managed location. Moving a live profile is not supported.",
    })),
    restartRequired: false,
  };
}
export function registerFolderIpc() {
  function trusted(event: Electron.IpcMainInvokeEvent) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (
      !owner ||
      owner.webContents !== event.sender ||
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      throw new Error("Untrusted folder request.");
    return owner;
  }
  ipcMain.handle("folders:list", (event) => {
    trusted(event);
    return browserFolderSnapshot();
  });
  ipcMain.handle("folders:choose", async (event, input: unknown) => {
    const owner = trusted(event);
    if (input !== "downloads")
      throw new Error("This folder cannot be changed.");
    const previous = getDownloadPreferences().directory;
    const preferences = await chooseDownloadDirectory(owner);
    return previous === preferences.directory ? null : browserFolderSnapshot();
  });
  ipcMain.handle("folders:open", async (event, input: unknown) => {
    trusted(event);
    const folder = browserFolderSnapshot().folders.find(
      (item) => item.id === input,
    );
    if (!folder) throw new Error("Unknown folder.");
    await mkdir(folder.path, { recursive: true });
    const error = await shell.openPath(folder.path);
    if (error) throw new Error("Could not open folder.");
  });
}
