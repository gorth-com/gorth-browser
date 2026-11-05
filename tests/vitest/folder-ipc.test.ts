import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { FolderSnapshot } from "@/utils/folder-interface";
const fixture = vi.hoisted(() => ({
  data: "",
  downloads: "",
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  frame: { url: "https://fixture.invalid/public/index.html" },
  open: vi.fn(async () => ""),
}));
const sender = vi.hoisted(() => ({ mainFrame: fixture.frame }));
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: () => fixture.data,
    getPath: () => fixture.data,
  },
  BrowserWindow: {
    fromWebContents: (value: unknown) =>
      value === sender ? { webContents: sender } : null,
  },
  ipcMain: {
    handle: (key: string, handler: (...args: unknown[]) => unknown) =>
      fixture.handlers.set(key, handler),
  },
  shell: { openPath: fixture.open },
}));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => fixture.frame.url,
  isRpcRendererUrl: (actual: string, expected: string) => actual === expected,
}));
vi.mock("@/main/services/downloads", () => ({
  getDownloadPreferences: () => ({ directory: fixture.downloads }),
  chooseDownloadDirectory: async () => {
    fixture.downloads = path.join(fixture.data, "New-downloads");
    return { directory: fixture.downloads };
  },
}));
import {
  registerFolderIpc,
  browserFolderSnapshot,
} from "@/main/services/folders";
import { settingsPages, settingsPageDefinitions } from "@/utils/constant";
import { parseInternalPage } from "@/lib/browser/internal-pages";
const event = { sender, senderFrame: fixture.frame };
beforeEach(async () => {
  fixture.data = await mkdtemp(path.join(os.tmpdir(), "gorth-folder-ipc-"));
  fixture.downloads = path.join(fixture.data, "Downloads");
  fixture.handlers.clear();
  fixture.open.mockClear();
  registerFolderIpc();
});
afterEach(async () => {
  await rm(fixture.data, { recursive: true, force: true });
});
it("resolves the hidden folders route without adding it to the Settings sidebar", () => {
  expect(settingsPageDefinitions["settings/folders"].url).toBe(
    "gorth://settings/folders",
  );
  expect(parseInternalPage("gorth://settings/folders")).toBe(
    "settings/folders",
  );
  expect(
    settingsPages.some((item) => String(item.id) === "settings/folders"),
  ).toBe(false);
});
it("shows app/profile/download/log locations and reuses actual download preferences", async () => {
  expect(
    browserFolderSnapshot().folders.find((item) => item.id === "application")
      ?.editable,
  ).toBe(false);
  const snapshot = (await fixture.handlers.get("folders:choose")!(
    event,
    "downloads",
  )) as FolderSnapshot;
  expect(
    snapshot.folders.find((item: { id: string }) => item.id === "downloads")
      ?.path,
  ).toBe(fixture.downloads);
  expect(snapshot.restartRequired).toBe(false);
});
it("rejects untrusted frames, arbitrary paths and attempts to move the live profile", async () => {
  expect(() =>
    fixture.handlers.get("folders:list")!({
      sender: {},
      senderFrame: fixture.frame,
    }),
  ).toThrow("Untrusted");
  expect(() =>
    fixture.handlers.get("folders:list")!({
      sender,
      senderFrame: { ...fixture.frame },
    }),
  ).toThrow("Untrusted");
  await expect(
    fixture.handlers.get("folders:choose")!(event, "data"),
  ).rejects.toThrow();
  await expect(
    fixture.handlers.get("folders:open")!(event, "/arbitrary/path"),
  ).rejects.toThrow();
  expect(fixture.open).not.toHaveBeenCalled();
});
it("passes only an approved directory to shell.openPath", async () => {
  await fixture.handlers.get("folders:open")!(event, "downloads");
  expect(fixture.open).toHaveBeenCalledWith(fixture.downloads);
});
