import { beforeEach, expect, it, vi } from "vitest";
import { defaultBrowserPreferences } from "@/utils/constant";
import {
  applyStartupPreferences,
  setupPreferencesSchema,
  importedBookmarksSchema,
} from "@/lib/browser/setup";
import type { BrowserSnapshot } from "@/lib/browser/persistence";
import {
  getSetupPreferences,
  saveSetupPreferences,
  importBookmarks,
} from "@/main/services/browser-setup";

const database = vi.hoisted(() => ({
  read: vi.fn(() => ({})),
  write: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));
vi.mock("electron", () => ({ app: {}, shell: {} }));
vi.mock("@/services/browser-database", () => ({
  readBrowserSetting: database.read,
  writeBrowserSetting: database.write,
  loadBrowserSnapshot: database.load,
  saveBrowserSnapshot: database.save,
}));
function snapshot(): BrowserSnapshot {
  return {
    tabs: [
      {
        id: "old",
        title: "Old",
        url: "https://example.com",
        faviconUrl: "",
        isPinned: false,
        isMuted: false,
        internalPage: null,
      },
    ],
    groups: [],
    activeTabId: "old",
    splitTabId: null,
    bookmarks: [
      { id: "existing", title: "Example", url: "https://example.com" },
    ],
    history: [],
    preferences: defaultBrowserPreferences,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  database.read.mockReturnValue({});
  database.load.mockReturnValue(snapshot());
});
it("preserves restore mode and defaults existing installations to it", () => {
  const saved = snapshot();
  expect(applyStartupPreferences(saved, getSetupPreferences())).toBe(saved);
});
it("opens one clean new tab without removing bookmarks or history", () => {
  const saved = snapshot();
  const result = applyStartupPreferences(
    saved,
    setupPreferencesSchema.parse({ startup: "new-tab" }),
  );
  expect(result.tabs).toHaveLength(1);
  expect(result.tabs[0].internalPage).toBe("new-tab");
  expect(result.bookmarks).toEqual(saved.bookmarks);
  expect(result.history).toEqual(saved.history);
  expect(saved.tabs[0].id).toBe("old");
});
it("opens specific startup pages in order", () => {
  const urls = ["https://example.com/one", "https://example.com/two"];
  const result = applyStartupPreferences(
    snapshot(),
    setupPreferencesSchema.parse({ startup: "pages", startupPages: urls }),
  );
  expect(result.tabs.map((item) => item.url)).toEqual(urls);
  expect(result.activeTabId).toBe(result.tabs[0].id);
});
it("rejects empty page lists, executable URLs and invalid choices before writing", () => {
  for (const input of [
    { startup: "pages", startupPages: [] },
    { startupPages: ["javascript:alert(1)"] },
    { newTab: "other" },
    { profileIcon: "other" },
  ]) {
    expect(() => saveSetupPreferences(input)).toThrow();
  }
  expect(database.write).not.toHaveBeenCalled();
  expect(
    importedBookmarksSchema.safeParse([
      { title: "X", url: "file:///private/secret" },
    ]).success,
  ).toBe(false);
});
it("persists setup preferences through the existing setting store", () => {
  const saved = saveSetupPreferences({
    profileName: "Work",
    profileIcon: "star",
    newTab: "blank",
  });
  expect(database.write).toHaveBeenCalledWith("browserSetup", saved);
  expect(saved).toMatchObject({
    profileName: "Work",
    profileIcon: "star",
    newTab: "blank",
  });
});
it("imports only new bookmarks and preserves the window session", () => {
  const added = importBookmarks(
    [
      { title: "Duplicate", url: "https://example.com" },
      { title: "New", url: "https://example.org" },
      { title: "Duplicate new", url: "https://example.org" },
    ],
    "main",
  );
  expect(added).toHaveLength(1);
  const [saved, window] = database.save.mock.calls[0];
  expect(window).toBe("main");
  expect(saved.tabs).toEqual(snapshot().tabs);
  expect(saved.bookmarks).toHaveLength(2);
});
