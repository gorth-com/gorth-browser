import { defaultBrowserPreferences } from "@/utils/constant";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { rawInitializeDatabase, rawCloseDatabase } from "@/services/database"
import { rawLoadBrowserSnapshot, rawSaveBrowserSnapshot } from "@/models/tab"
import { rawSaveTabGroup, rawLoadTabGroups } from "@/models/tab-group"
import { rawAddRecentlyClosedTab, rawPopRecentlyClosedTab } from "@/models/recently-closed"
import { rawSaveWindowState, rawLoadWindowState, rawGetRestoredWindowIds, rawSetWindowOpen } from "@/models/window"
import { rawArchiveTab, rawListArchivedTabs, rawRestoreArchivedTab } from "@/models/archived-tab"
import { type PersistedTab } from "@/lib/browser/persistence";
import { shouldSleepTab } from "@/lib/browser/lifecycle";
import { isSiteExcluded, normalizeSite } from "@/lib/browser/shields";
import {
  parseInternalPage,
  getInternalPageUrl,
} from "@/lib/browser/internal-pages";

test("Auth completion and profile destinations are real internal pages", () => {
  assert.equal(parseInternalPage("gorth://auth"), "auth");
  assert.equal(
    parseInternalPage("gorth://settings/profile"),
    "settings/profile",
  );
  assert.equal(
    getInternalPageUrl("settings/profile"),
    "gorth://settings/profile",
  );
});

test("Independent multiwindow sessions, shared-data deltas, recently closed, groups and archive survive restart", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-foundation-"));
  const makeTab = (id: string): PersistedTab => ({
    id,
    title: id,
    url: `https://${id}.example`,
    faviconUrl: "",
    isMuted: false,
    isPinned: false,
    internalPage: null,
  });
  try {
    rawInitializeDatabase(directory);
    const a = rawLoadBrowserSnapshot("main");
    const b = rawLoadBrowserSnapshot("second");
    a.tabs = [makeTab("a"), makeTab("b")];
    a.activeTabId = "a";
    a.bookmarks = [{ id: "bookmark-a", title: "A", url: "https://a.example" }];
    b.tabs = [makeTab("c")];
    b.activeTabId = "c";
    b.bookmarks = [{ id: "bookmark-c", title: "C", url: "https://c.example" }];
    a.history = [
      {
        id: "visit-a",
        tabId: "a",
        title: "A",
        url: "https://a.example",
        visitedAt: 1,
      },
    ];
    b.history = [
      {
        id: "visit-c",
        tabId: "c",
        title: "C",
        url: "https://c.example",
        visitedAt: 2,
      },
    ];
    rawSaveBrowserSnapshot(a, "main");
    rawSaveBrowserSnapshot(b, "second");
    rawSaveBrowserSnapshot(a, "main");
    rawSaveTabGroup(
      { id: "g", name: "Work", mode: "normal", tabIds: ["a", "b"] },
      "main",
    );
    assert.equal(rawLoadTabGroups("second").length, 0);
    assert.throws(() =>
      rawSaveTabGroup(
        {
          id: "g",
          name: "Cannot steal a group",
          mode: "normal",
          tabIds: ["c"],
        },
        "second",
      ),
    );
    assert.equal(rawLoadTabGroups("main").length, 1);
    const shared = rawLoadBrowserSnapshot("third");
    assert.equal(shared.bookmarks.length, 2);
    assert.equal(shared.history.length, 2);
    assert.equal(shared.tabs.length, 0);
    a.bookmarks = [];
    a.history = [];
    rawSaveBrowserSnapshot(a, "main");
    assert.deepEqual(
      rawLoadBrowserSnapshot("third").bookmarks.map((row) => row.id),
      ["bookmark-c"],
    );
    assert.deepEqual(
      rawLoadBrowserSnapshot("third").history.map((row) => row.id),
      ["visit-c"],
    );
    rawAddRecentlyClosedTab(b.tabs[0], "second");
    assert.equal(rawPopRecentlyClosedTab("main"), null);
    assert.equal(rawPopRecentlyClosedTab("second")?.id, "c");
    rawSaveWindowState(
      { x: 20, y: 20, width: 1280, height: 720, isMaximized: false },
      "main",
    );
    rawSaveWindowState(
      { x: 40, y: 40, width: 1920, height: 1080, isMaximized: true },
      "second",
    );
    assert.equal(rawLoadWindowState("main")?.width, 1280);
    assert.equal(rawLoadWindowState("second")?.width, 1920);
    assert.deepEqual(rawGetRestoredWindowIds().sort(), ["main", "second"]);
    rawSetWindowOpen("second", false);
    assert.deepEqual(rawGetRestoredWindowIds(), ["main"]);
    rawArchiveTab(a.tabs[1], "main");
    rawSaveBrowserSnapshot(a, "main"); // Stale window snapshots must not revive archives.
    assert.deepEqual(
      rawLoadBrowserSnapshot("main").tabs.map((tab) => tab.id),
      ["a"],
    );
    rawCloseDatabase();
    rawInitializeDatabase(directory);
    assert.equal(rawListArchivedTabs().length, 1);
    const restored = rawRestoreArchivedTab("b", "second");
    assert.notEqual(restored?.id, "b");
    assert.equal(restored?.url, "https://b.example");
    assert.equal(rawListArchivedTabs().length, 0);
    assert.equal(rawLoadBrowserSnapshot("second").tabs.length, 2);
    assert.equal(rawLoadBrowserSnapshot("main").tabs.length, 1);
  } finally {
    rawCloseDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Memory saver eligibility is explicit and exceptions match hostnames, not URL substrings", () => {
  const input = {
    active: false,
    pinned: false,
    grouped: false,
    internal: false,
    busy: false,
    lastActiveAt: 1,
    now: 1_000_000,
    preferences: {
      memorySaver: true,
      sleepAfterMinutes: 15,
      archiveAfterDays: 0,
    },
  };
  assert.equal(shouldSleepTab(input), true);
  for (const key of [
    "active",
    "pinned",
    "grouped",
    "internal",
    "busy",
  ] as const)
    assert.equal(shouldSleepTab({ ...input, [key]: true }), false);
  assert.equal(
    shouldSleepTab({
      ...input,
      preferences: { ...input.preferences, memorySaver: false },
    }),
    false,
  );
  assert.equal(normalizeSite("https://www.example.com/path"), "example.com");
  assert.equal(
    isSiteExcluded("https://sub.example.com/path", ["example.com"]),
    true,
  );
  assert.equal(
    isSiteExcluded("https://evil-example.com", ["example.com"]),
    false,
  );
  assert.equal(
    isSiteExcluded("https://example.com.evil.test", ["example.com"]),
    false,
  );
  assert.throws(() => normalizeSite("file:///etc/passwd"));
  assert.deepEqual(defaultBrowserPreferences.flags, {
    memorySaver: true,
    smoothScrolling: true,
  });
});
