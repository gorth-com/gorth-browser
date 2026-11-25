import { defaultBrowserPreferences } from "@/utils/constant";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { rawInitializeDatabase, rawCloseDatabase } from "@/services/database"
import { rawLoadBrowserSnapshot, rawSaveBrowserSnapshot } from "@/models/tab"
import { rawSaveTabGroup, rawDeleteTabGroup, rawLoadTabGroups } from "@/models/tab-group"
import { rawAddRecentlyClosedTab } from "@/models/recently-closed"
import { type PersistedTab } from "@/lib/browser/persistence";
import {
  updateWebviewBounds,
  type WebviewLayoutState,
} from "@/main/windows/webview";
import type { BrowserWindow } from "electron";

test("Tab groups: legacy migration, immediate CRUD, session save, restart and closed members", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-tab-groups-"));
  const filename = path.join(directory, "gorth-browser.db");
  const legacy = new Database(filename);
  legacy.exec(
    "CREATE TABLE tab_groups (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, mode TEXT NOT NULL, position INTEGER NOT NULL)",
  );
  legacy.close();
  try {
    rawInitializeDatabase(directory);
    const tabs: PersistedTab[] = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      title: id,
      url: `https://${id}.example`,
      faviconUrl: "",
      isMuted: false,
      isPinned: false,
      internalPage: null,
    }));
    const snapshot = {
      activeTabId: "a",
      tabs,
      groups: [],
      splitTabId: null,
      bookmarks: [],
      history: [],
      preferences: defaultBrowserPreferences,
    };
    rawSaveBrowserSnapshot(snapshot);
    rawSaveTabGroup({ id: "normal", name: "Work", mode: "normal", tabIds: ["a"] });
    rawSaveTabGroup({
      id: "split",
      name: "Compare",
      mode: "split",
      tabIds: ["b", "c"],
    });
    rawSaveTabGroup({
      id: "glance",
      name: "Preview",
      mode: "glance",
      tabIds: ["d", "e"],
    });
    const check = new Database(filename, { readonly: true });
    assert.equal(
      check.prepare("SELECT count(*) AS n FROM tab_group").get()?.n,
      3,
    );
    check.close();
    assert.throws(() =>
      rawSaveTabGroup({
        id: "conflict",
        name: "Duplicate",
        mode: "normal",
        tabIds: ["a"],
      }),
    );
    assert.throws(() =>
      rawSaveTabGroup({
        id: "missing",
        name: "Missing",
        mode: "normal",
        tabIds: ["missing"],
      }),
    );
    rawSaveBrowserSnapshot(snapshot); // A stale session snapshot must not erase named groups.
    rawCloseDatabase();
    rawInitializeDatabase(directory);
    assert.equal(rawLoadBrowserSnapshot().groups.length, 3);
    rawSaveTabGroup({
      id: "normal",
      name: "Renamed",
      mode: "normal",
      tabIds: ["a"],
    });
    assert.equal(rawLoadTabGroups()[0].name, "Renamed");
    rawDeleteTabGroup("normal");
    const deleted = new Database(filename, { readonly: true });
    assert.equal(
      deleted
        .prepare(
          "SELECT count(*) AS n FROM tab_group_member WHERE group_id = 'normal'",
        )
        .get()?.n,
      0,
    );
    deleted.close();
    rawAddRecentlyClosedTab(tabs[1]);
    assert.deepEqual(
      rawLoadTabGroups().map((group) => group.id),
      ["glance"],
    );
    rawDeleteTabGroup("glance");
    rawSaveBrowserSnapshot(snapshot);
    rawCloseDatabase();
    rawInitializeDatabase(directory);
    assert.deepEqual(rawLoadTabGroups(), []);
  } finally {
    rawCloseDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Split and glance native layouts keep chrome portals above web tabs", () => {
  const makeView = () => ({
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    visible: false,
    radius: 0,
    setBounds(bounds: { x: number; y: number; width: number; height: number }) {
      this.bounds = bounds;
    },
    setVisible(visible: boolean) {
      this.visible = visible;
    },
    setBorderRadius(radius: number) {
      this.radius = radius;
    },
  });
  const front = makeView();
  const back = makeView();
  const chrome = {};
  const portal = {};
  const children = [chrome, front, back, portal];
  const window = {
    getContentSize: () => [1280, 720],
    contentView: {
      children,
      addChildView(view: object, index: number) {
        children.splice(children.indexOf(view), 1);
        children.splice(index, 0, view);
      },
    },
  } as unknown as BrowserWindow;
  const state = {
    activeTabId: "a",
    splitTabId: "b",
    companionMode: "split",
    internalTabIds: new Set(),
    webFullScreenTabId: null,
    layout: {
      top: 112,
      sidebarWidth: 0,
      verticalTabsWidth: 0,
      sidebarSide: "left",
    },
    views: new Map([
      ["a", { view: front }],
      ["b", { view: back }],
    ]),
  } as unknown as WebviewLayoutState;
  updateWebviewBounds(window, state);
  assert.deepEqual(front.bounds, { x: 0, y: 112, width: 639, height: 608 });
  assert.deepEqual(back.bounds, { x: 640, y: 112, width: 640, height: 608 });
  state.companionMode = "glance";
  updateWebviewBounds(window, state);
  assert.equal(front.bounds.width, 1088);
  assert.equal(front.bounds.x, 96);
  assert.equal(front.radius, 12);
  assert.equal(children[0], chrome);
  assert.equal(children[2], front);
  assert.equal(children[3], portal);
  state.splitTabId = null;
  updateWebviewBounds(window, state);
  assert.equal(back.visible, false);
  assert.equal(front.bounds.width, 1280);
  assert.equal(front.radius, 0);
});
