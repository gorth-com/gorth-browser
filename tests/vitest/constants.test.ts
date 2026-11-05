import { expect, it } from "vitest";
import { shortcutDefinitions } from "@/utils/constant";
import { validateShortcutChange } from "@/lib/shortcuts";

import {
  defaultBrowserPreferences,
  defaultShieldPreferences,
  internalIcons,
  internalPageDefinitions,
  settingsPages,
  systemPageButtons,
  quickLinks,
  updateRepository,
} from "@/utils/constant";
import {
  getInternalPageUrl,
  parseInternalPage,
} from "@/lib/browser/internal-pages";
it("keeps the centralized browser navigation and settings definitions consistent", () => {
  for (const item of settingsPages)
    expect(getInternalPageUrl(item.id)).toBe(
      internalPageDefinitions[item.id].url,
    );
  for (const item of systemPageButtons) {
    expect(parseInternalPage(getInternalPageUrl(item.page))).toBe(item.page);
    expect(item.icon).toBeDefined();
  }
  expect(internalIcons["new-tab"]).toBeDefined();
  expect(defaultBrowserPreferences.tabLayout).toBe("separate");
  expect(defaultShieldPreferences.enabled).toBe(true);
  expect(quickLinks.map((item) => new URL(item.url).protocol)).toEqual([
    "https:",
    "https:",
    "https:",
  ]);
  expect(updateRepository.repository).toBe("gorth-browser");
});

it("preserves the shortcut catalog and reserved accelerator policy", () => {
  expect(new Set(shortcutDefinitions.map((item) => item.id)).size).toBe(
    shortcutDefinitions.length,
  );
  const shortcuts = shortcutDefinitions.map((item) => ({
    ...item,
    accelerator: item.defaultAccelerator,
  }));
  expect(() =>
    validateShortcutChange(shortcuts, shortcuts[0].id, "CmdOrCtrl+C", false),
  ).toThrow();
});
