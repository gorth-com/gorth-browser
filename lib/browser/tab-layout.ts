import type { BrowserPreferences } from "@/lib/browser/persistence";

export type TabLayout = BrowserPreferences["tabLayout"];

export function selectTabLayout(
  tabLayout: TabLayout,
  verticalTabs: boolean,
  selection: TabLayout | boolean,
) {
  if (typeof selection === "boolean")
    return {
      tabLayout: selection ? ("compact" as const) : tabLayout,
      verticalTabs: selection,
    };
  return {
    tabLayout: selection,
    verticalTabs: selection === "separate" ? false : verticalTabs,
  };
}

// Border-box widths: padding and borders must not distort the 2:1 ratio.
export function getCompactTabWidth(
  availableWidth: number,
  inactiveCount: number,
) {
  return Math.max(96, Math.min(180, availableWidth / (inactiveCount + 2)));
}

export function getBrowserChromeLayout(
  tabLayout: TabLayout,
  verticalTabs: boolean,
) {
  const hasVerticalTabs = verticalTabs;
  return {
    hasVerticalTabs,
    height: tabLayout === "compact" || hasVerticalTabs ? 56 : 112,
  };
}
