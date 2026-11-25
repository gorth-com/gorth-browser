import { EventEmitter } from "node:events";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { defaultSystemPreferences } from "@/lib/browser/system";
import { defaultBrowserPreferences } from "@/utils/constant";
import type { PersistedTab } from "@/lib/browser/persistence";
const fixture = vi.hoisted(() => ({
  state: null as unknown,
  preferences: null as unknown,
  energyActive: false,
  download: false,
  archive: vi.fn(),
  send: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("@/main/windows/capital", () => ({
  getBrowserState: () => fixture.state,
  sendTabUpdate: fixture.send,
  createTabView: vi.fn(),
  updateViewBounds: vi.fn(),
  showInternalPage: vi.fn(),
  isAllowedNavigationUrl: () => true,
}));
vi.mock("@/main/windows/webview", () => ({ destroyWebview: fixture.destroy }));
vi.mock("@/main/services/downloads", () => ({
  hasActiveTabDownload: () => fixture.download,
}));
vi.mock("@/main/services/navigation", () => ({ loadWebsite: vi.fn() }));
vi.mock("@/main/services/browser-setup", () => ({
  getSetupPreferences: vi.fn(),
}));
vi.mock("@/main/services/system-preferences", () => ({
  getSystemPreferences: () => fixture.preferences,
}));
vi.mock("@/main/services/system", () => ({
  systemSnapshot: () => ({
    preferences: fixture.preferences,
    energyActive: fixture.energyActive,
  }),
}));
vi.mock("@/models/archived-tab", () => ({
  rawArchiveTab: fixture.archive,
}));
vi.mock("@/models/setting", () => ({
  rawWriteBrowserSetting: vi.fn(),
}));
import {
  sleepTab,
  archiveBrowserTab,
  trackTabLifecycle,
} from "@/main/services/tab-lifecycle";

let window: BrowserWindow;
let events: EventEmitter;
let tab: PersistedTab;
let state: {
  tabMetadata: Map<string, PersistedTab>;
  views: Map<string, { view: { webContents: typeof contents } }>;
  activeTabId: string | null;
  splitTabId: string | null;
  webFullScreenTabId: string | null;
  groupedTabIds: Set<string>;
  archivedTabIds: Set<string>;
  sessionId: string;
  preferences: typeof defaultBrowserPreferences;
};
let contents: EventEmitter & {
  id: number;
  isDestroyed: () => boolean;
  isLoading: () => boolean;
  isCurrentlyAudible: () => boolean;
  isBeingCaptured: () => boolean;
  executeJavaScript: ReturnType<typeof vi.fn>;
  getURL: () => string;
  getTitle: () => string;
  isAudioMuted: () => boolean;
  navigationHistory: {
    getAllEntries: () => { url: string; title: string }[];
    getActiveIndex: () => number;
  };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fixture.preferences = { ...defaultSystemPreferences, activeSites: [] };
  fixture.energyActive = false;
  fixture.download = false;
  events = new EventEmitter();
  window = Object.assign(events, {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  }) as unknown as BrowserWindow;
  tab = {
    id: "idle",
    url: "https://sub.example.com/",
    title: "Idle",
    faviconUrl: "",
    isMuted: false,
    isPinned: false,
    internalPage: null,
    lastActiveAt: Date.now() - 6 * 60_000,
  };
  contents = Object.assign(new EventEmitter(), {
    id: 1,
    isDestroyed: () => false,
    isLoading: () => false,
    isCurrentlyAudible: () => false,
    isBeingCaptured: () => false,
    executeJavaScript: vi.fn(async () => false),
    getURL: () => tab.url,
    getTitle: () => tab.title,
    isAudioMuted: () => false,
    navigationHistory: {
      getAllEntries: () => [{ url: tab.url, title: tab.title }],
      getActiveIndex: () => 0,
    },
  });
  state = {
    tabMetadata: new Map([[tab.id, tab]]),
    views: new Map([[tab.id, { view: { webContents: contents } }]]),
    activeTabId: "other",
    splitTabId: null,
    webFullScreenTabId: null,
    groupedTabIds: new Set(),
    archivedTabIds: new Set(),
    sessionId: "fixture",
    preferences: {
      ...defaultBrowserPreferences,
      flags: { memorySaver: false },
      sleepAfterMinutes: 60,
      archiveAfterDays: 0,
    },
  };
  fixture.state = state;
  fixture.destroy.mockImplementation(() => contents.emit("destroyed"));
});
afterEach(() => {
  events.emit("closed");
  vi.useRealTimers();
});
it("protects exception hosts from both actual sleep and archive paths", async () => {
  fixture.preferences = {
    ...defaultSystemPreferences,
    activeSites: ["example.com"],
  };
  expect(await sleepTab(window, tab.id)).toBe(false);
  expect(await archiveBrowserTab(window, tab.id)).toBe(false);
  expect(contents.executeJavaScript).not.toHaveBeenCalled();
  expect(fixture.destroy).not.toHaveBeenCalled();
  expect(fixture.archive).not.toHaveBeenCalled();
});
it("rechecks newly added exceptions after the asynchronous edited-form check", async () => {
  contents.executeJavaScript.mockImplementation(async () => {
    fixture.preferences = {
      ...defaultSystemPreferences,
      activeSites: ["example.com"],
    };
    return false;
  });
  expect(await sleepTab(window, tab.id)).toBe(false);
  expect(fixture.destroy).not.toHaveBeenCalled();
});
it("unloads safe inactive tabs on battery even with Memory Saver off, without changing the saved timeout", async () => {
  fixture.energyActive = true;
  trackTabLifecycle(window);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fixture.destroy).toHaveBeenCalledOnce();
  expect(fixture.send).toHaveBeenCalledWith(
    window,
    expect.objectContaining({ id: "idle", isSleeping: true }),
  );
  expect(state.preferences.sleepAfterMinutes).toBe(60);
  expect(state.preferences.flags.memorySaver).toBe(false);
});
it("does not unload when both savers are inactive", async () => {
  trackTabLifecycle(window);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fixture.destroy).not.toHaveBeenCalled();
});
it.each([
  "audible",
  "captured",
  "download",
  "edited-form",
  "active",
  "pinned",
  "grouped",
])("keeps %s tabs protected in Energy Saver", async (kind) => {
  fixture.energyActive = true;
  if (kind === "audible") contents.isCurrentlyAudible = () => true;
  if (kind === "captured") contents.isBeingCaptured = () => true;
  if (kind === "download") fixture.download = true;
  if (kind === "edited-form")
    contents.executeJavaScript.mockResolvedValue(true);
  if (kind === "active") state.activeTabId = tab.id;
  if (kind === "pinned") tab.isPinned = true;
  if (kind === "grouped") state.groupedTabIds.add(tab.id);
  trackTabLifecycle(window);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fixture.destroy).not.toHaveBeenCalled();
});
