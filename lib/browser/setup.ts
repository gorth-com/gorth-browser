import { z } from "@gorth-com/structure/cores/zod";
import type { BrowserSnapshot, PersistedTab } from "@/lib/browser/persistence";

export const setupPreferencesSchema = z
  .object({
    profileName: z.string().trim().min(1).max(80).default("Personal"),
    profileIcon: z.enum(["globe", "user", "rocket", "star"]).default("user"),
    startup: z.enum(["new-tab", "restore", "pages"]).default("restore"),
    startupPages: z
      .array(z.url({ protocol: /^https?$/i }).max(2048))
      .max(20)
      .default([]),
    newTab: z.enum(["dashboard", "blank"]).default("dashboard"),
  })
  .refine(
    (value) => value.startup !== "pages" || value.startupPages.length > 0,
    {
      message: "Add at least one startup URL.",
      path: ["startupPages"],
    },
  );
export type SetupPreferences = z.infer<typeof setupPreferencesSchema>;
export const importedBookmarksSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(8192),
      url: z.url({ protocol: /^https?$/i }).max(32768),
    }),
  )
  .min(1)
  .max(10000);

export function applyStartupPreferences(
  snapshot: BrowserSnapshot,
  preferences: SetupPreferences,
): BrowserSnapshot {
  if (preferences.startup === "restore") return snapshot;
  const urls =
    preferences.startup === "pages" ? preferences.startupPages : [""];
  const tabs: PersistedTab[] = urls.map((url) => ({
    id: crypto.randomUUID(),
    title: url || "New tab",
    url,
    faviconUrl: "",
    isMuted: false,
    isPinned: false,
    internalPage: url ? null : "new-tab",
  }));
  return {
    ...snapshot,
    tabs,
    activeTabId: tabs[0].id,
    splitTabId: null,
    groups: [],
  };
}
