import { defaultBrowserPreferences } from "@/utils/constant";
import { describe, expect, it } from "vitest";

import { browserSnapshotSchema } from "@/lib/browser/session-schema";
import {
  getBrowserChromeLayout,
  getCompactTabWidth,
  selectTabLayout,
} from "@/lib/browser/tab-layout";

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

describe("tab layout persistence", () => {
  it("preserves sidebar collapse settings and supports older profiles", () => {
    const preferences: Record<string, unknown> = {
      ...defaultBrowserPreferences,
    };
    delete preferences.sidebarCollapsible;
    delete preferences.sidebarCollapseMode;
    expect(
      browserSnapshotSchema.parse(snapshot(preferences)).preferences,
    ).toMatchObject({ sidebarCollapsible: false, sidebarCollapseMode: "icon" });
    for (const sidebarCollapseMode of ["icon", "none"]) {
      expect(
        browserSnapshotSchema.parse(
          snapshot({
            ...preferences,
            sidebarCollapsible: true,
            sidebarCollapseMode,
          }),
        ).preferences,
      ).toMatchObject({ sidebarCollapsible: true, sidebarCollapseMode });
    }
    expect(
      browserSnapshotSchema.safeParse(
        snapshot({ ...preferences, sidebarCollapseMode: "invalid" }),
      ).success,
    ).toBe(false);
  });
  it("defaults old sessions to Separate", () => {
    const preferences: Record<string, unknown> = {
      ...defaultBrowserPreferences,
    };
    delete preferences.tabLayout;
    expect(defaultBrowserPreferences.tabLayout).toBe("separate");
    expect(
      browserSnapshotSchema.parse(snapshot(preferences)).preferences.tabLayout,
    ).toBe("separate");
  });
  it.each(["separate", "compact"])(
    "round-trips %s through the database snapshot contract",
    (tabLayout) => {
      const saved = JSON.parse(
        JSON.stringify(
          snapshot({
            ...defaultBrowserPreferences,
            tabLayout,
            verticalTabs: true,
          }),
        ),
      );
      expect(browserSnapshotSchema.parse(saved).preferences).toMatchObject({
        tabLayout,
        verticalTabs: true,
      });
    },
  );
  it("rejects unknown layouts", () => {
    expect(
      browserSnapshotSchema.safeParse(
        snapshot({ ...defaultBrowserPreferences, tabLayout: "other" }),
      ).success,
    ).toBe(false);
  });
});

describe("browser chrome geometry", () => {
  it("keeps vertical and compact selections consistent without enabling extra features", () => {
    expect(selectTabLayout("separate", false, true)).toEqual({
      tabLayout: "compact",
      verticalTabs: true,
    });
    expect(selectTabLayout("compact", true, "separate")).toEqual({
      tabLayout: "separate",
      verticalTabs: false,
    });
    expect(selectTabLayout("separate", false, "compact")).toEqual({
      tabLayout: "compact",
      verticalTabs: false,
    });
    expect(selectTabLayout("compact", true, false)).toEqual({
      tabLayout: "compact",
      verticalTabs: false,
    });
    expect(selectTabLayout("compact", true, "compact")).toEqual({
      tabLayout: "compact",
      verticalTabs: true,
    });
  });
  it.each([
    ["separate", false, false, 112],
    ["separate", true, true, 56],
    ["compact", false, false, 56],
    ["compact", true, true, 56],
  ] as const)(
    "uses the correct native webview inset for %s / vertical %s",
    (layout, vertical, hasVerticalTabs, height) => {
      expect(getBrowserChromeLayout(layout, vertical)).toEqual({
        hasVerticalTabs,
        height,
      });
    },
  );
  it("caps regular tabs at 180px and active tabs at 360px", () => {
    const regular = getCompactTabWidth(1000, 2);
    expect(regular).toBe(180);
    expect(regular * 2).toBe(360);
  });
  it.each([1, 2, 3, 4])(
    "shrinks proportionally with %i inactive tabs",
    (count) => {
      const available = (count + 2) * 130;
      const regular = getCompactTabWidth(available, count);
      expect(regular).toBe(130);
      expect(regular * count + regular * 2).toBe(available);
    },
  );
  it("keeps action buttons reachable at the minimum width, allowing scrolling", () => {
    expect(getCompactTabWidth(10, 20)).toBe(96);
    expect(getCompactTabWidth(10, 20) * 2).toBe(192);
  });
});
