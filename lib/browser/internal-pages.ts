import {
  internalPageDefinitions,
  settingsPageDefinitions,
} from "@/utils/constant";

import { urlSchema } from "@/utils/schema";
import type { PersistedTab } from "@/lib/browser/persistence";

interface InternalPageDefinition {
  title: string;
  url: string;
}

type BrowserInternalPage = "new-tab" | keyof typeof internalPageDefinitions;

/** Prefer the active New Tab; otherwise keep the existing feature-tab reuse policy. */
function findInternalPageTab<
  T extends Pick<PersistedTab, "id" | "internalPage">,
>(
  tabs: readonly T[],
  activeTabId: string,
  page: Exclude<BrowserInternalPage, "new-tab">,
): T | undefined {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (activeTab?.internalPage === "new-tab") return activeTab;

  const isSettings = page === "settings" || page.startsWith("settings/");
  return (
    tabs.find((tab) => tab.internalPage === page) ??
    (isSettings
      ? tabs.find(
          (tab) =>
            tab.internalPage === "settings" ||
            tab.internalPage?.startsWith("settings/"),
        )
      : undefined)
  );
}

function parseInternalPage(value: string): BrowserInternalPage | null {
  try {
    const url = new URL(urlSchema.parse(value));
    if (url.protocol !== "gorth:") return null;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "about") return "settings/help";
    if (hostname === "settings" && url.pathname.replace(/\/$/, "")) {
      const page = `settings${url.pathname.replace(/\/$/, "").toLowerCase()}`;
      return page in settingsPageDefinitions
        ? (page as keyof typeof settingsPageDefinitions)
        : null;
    }
    if (hostname === "new-tab" || hostname === "newtab") return "new-tab";
    if (hostname in internalPageDefinitions) {
      return hostname as keyof typeof internalPageDefinitions;
    }
  } catch {
    return null;
  }

  return null;
}

function getInternalPageUrl(page: BrowserInternalPage) {
  return page === "new-tab" ? "" : internalPageDefinitions[page].url;
}

function getInternalPageTitle(page: BrowserInternalPage) {
  return page === "new-tab" ? "Home" : internalPageDefinitions[page].title;
}

export {
  findInternalPageTab,
  getInternalPageTitle,
  getInternalPageUrl,
  parseInternalPage,
};
export type { BrowserInternalPage, InternalPageDefinition };
