import { defaultBrowserPreferences } from "@/utils/constant";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

import { browserSnapshotSchema } from "@/lib/browser/session-schema";
import { SIDEBAR_WIDTH } from "@/utils/constant";

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(),
}));
import {
  updateWebviewBounds,
  type WebviewLayoutState,
} from "@/main/windows/webview";

function snapshot(preferences: Record<string, unknown>) {
  return {
    activeTabId: null,
    splitTabId: null,
    tabs: [],
    groups: [],
    bookmarks: [],
    history: [],
    preferences,
  };
}

describe("workspace sidebar preference", () => {
  it("is disabled by default and supports old saved preferences", () => {
    expect(defaultBrowserPreferences.enableWorkspace).toBe(false);
    const preferences: Record<string, unknown> = {
      ...defaultBrowserPreferences,
    };
    delete preferences.enableWorkspace;
    expect(
      browserSnapshotSchema.parse(snapshot(preferences)).preferences
        .enableWorkspace,
    ).toBe(false);
  });
  it.each([true, false])(
    "preserves the enabled flag: %s",
    (enableWorkspace) => {
      const saved = snapshot({ ...defaultBrowserPreferences, enableWorkspace });
      expect(
        browserSnapshotSchema.parse(JSON.parse(JSON.stringify(saved)))
          .preferences.enableWorkspace,
      ).toBe(enableWorkspace);
    },
  );
  it("rejects invalid toggle values", () => {
    expect(
      browserSnapshotSchema.safeParse(
        snapshot({ ...defaultBrowserPreferences, enableWorkspace: "yes" }),
      ).success,
    ).toBe(false);
  });
});

describe("workspace sidebar webview spacing", () => {
  it.each([
    { spaceBarWidth: 0, sidebarSide: "left" },
    { spaceBarWidth: 56, sidebarSide: "left" },
    { spaceBarWidth: 0, sidebarSide: "right" },
    { spaceBarWidth: 56, sidebarSide: "right" },
  ] as const)(
    "reserves the icon sidebar on $sidebarSide with workspace width $spaceBarWidth",
    ({ spaceBarWidth, sidebarSide }) => {
      const view = {
        setVisible: vi.fn(),
        setBounds: vi.fn(),
        setBorderRadius: vi.fn(),
        webContents: { isDestroyed: vi.fn(), close: vi.fn() },
      };
      const state = {
        companionMode: "split",
        activeTabId: "web",
        internalTabIds: new Set<string>(),
        splitTabId: null,
        webFullScreenTabId: null,
        layout: {
          top: 112,
          verticalTabsWidth: 200,
          spaceBarWidth,
          sidebarWidth: SIDEBAR_WIDTH,
          sidebarSide,
        },
        views: new Map([["web", { view }]]),
      } as unknown as WebviewLayoutState;
      const window = {
        getContentSize: () => [1280, 720],
      } as unknown as BrowserWindow;
      updateWebviewBounds(window, state);
      expect(view.setBounds).toHaveBeenCalledWith({
        x: 200 + spaceBarWidth + (sidebarSide === "left" ? 56 : 0),
        y: 112,
        width: 1024 - spaceBarWidth,
        height: 608,
      });
      state.webFullScreenTabId = "web";
      updateWebviewBounds(window, state);
      expect(view.setBounds).toHaveBeenLastCalledWith({
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
      });
    },
  );
});
