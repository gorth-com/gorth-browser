import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BrowserTabItem } from "@/components/element/browser-tabs";
import {
  AddressBarInput,
  FeatureLeftBlock,
  FeatureRightBlock,
  type FeatureBlockProps,
} from "@/layouts/feature-block";
import { TooltipProvider } from "@/providers/tooltip";
import { findInternalPageTab } from "@/lib/browser/internal-pages";
import { formatAddress, formatAddressInput } from "@/utils/formatter";

const webTab: BrowserTabItem = {
  id: "web",
  title: "YouTube",
  url: "https://www.youtube.com/",
  faviconUrl: "",
  isHome: false,
  internalPage: null,
  isPinned: false,
  isMuted: false,
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
};

describe("feature tab navigation policy", () => {
  const home = { ...webTab, id: "home", internalPage: "new-tab" as const };
  const history = {
    ...webTab,
    id: "history",
    internalPage: "history" as const,
  };
  const settings = {
    ...webTab,
    id: "settings",
    internalPage: "settings/appearance" as const,
  };
  const tabs = [webTab, history, settings, home];

  it("reuses the active New Tab even when the requested feature is already open", () => {
    expect(findInternalPageTab(tabs, home.id, "history")).toBe(home);
    expect(findInternalPageTab(tabs, home.id, "bookmarks")).toBe(home);
    expect(findInternalPageTab(tabs, home.id, "settings/help")).toBe(home);
  });

  it("does not replace a web tab or a different feature tab", () => {
    expect(findInternalPageTab(tabs, webTab.id, "bookmarks")).toBeUndefined();
    expect(findInternalPageTab(tabs, history.id, "bookmarks")).toBeUndefined();
    expect(findInternalPageTab(tabs, webTab.id, "history")).toBe(history);
  });

  it("preserves the existing shared Settings tab behavior", () => {
    expect(findInternalPageTab(tabs, webTab.id, "settings/help")).toBe(
      settings,
    );
    expect(findInternalPageTab(tabs, history.id, "settings")).toBe(settings);
  });

  it("does not pick an inactive New Tab when a new feature tab is needed", () => {
    expect(findInternalPageTab(tabs, "missing", "archive")).toBeUndefined();
  });
});

describe("address display", () => {
  it.each([
    ["https://www.youtube.com/", "https://www.youtube.com"],
    ["http://localhost:3030/", "http://localhost:3030"],
    ["https://[::1]:3030/", "https://[::1]:3030"],
    ["gorth://settings/", "gorth://settings"],
  ])("omits the empty root path from %s", (url, expected) => {
    expect(formatAddressInput(url)).toBe(expected);
  });

  it.each([
    "https://www.youtube.com/watch/",
    "https://example.com/?next=/",
    "https://example.com/#path/",
    "gorth://settings/appearance/",
    "file:///tmp/",
    "search words/",
    "",
  ])("preserves meaningful paths and user text: %s", (url) => {
    expect(formatAddressInput(url)).toBe(url);
  });

  it("keeps the existing shortened display and the full editable address", () => {
    expect(formatAddress(webTab.url)).toBe("youtube.com");
    expect(formatAddress("gorth://settings/appearance")).toBe(
      "gorth://settings/appearance",
    );
    for (const autoFocus of [true, false]) {
      const markup = renderToStaticMarkup(
        <AddressBarInput
          activeTab={webTab}
          onNavigate={vi.fn()}
          autoFocus={autoFocus}
        />,
      );
      expect(markup).toContain(
        `value="${autoFocus ? "https://www.youtube.com" : "youtube.com"}"`,
      );
    }
    expect(webTab.url).toBe("https://www.youtube.com/");
  });
});

describe("feature button active colors", () => {
  const props: FeatureBlockProps = {
    activeTab: { ...webTab, internalPage: "archive" },
    verticalTabs: false,
    verticalCollapsed: false,
    isBookmarked: false,
    isSidebarOpen: true,
    isSplit: true,
    canSplit: true,
    onToggleVerticalSidebar: vi.fn(),
    onBack: vi.fn(),
    onBookmark: vi.fn(),
    onCreateTab: vi.fn(),
    onForward: vi.fn(),
    onHome: vi.fn(),
    onNavigate: vi.fn(),
    onReload: vi.fn(),
    onStop: vi.fn(),
    onOpenInternal: vi.fn(),
    onToggleSidebar: vi.fn(),
    onToggleSplit: vi.fn(),
  };

  function buttons(activeTab = props.activeTab) {
    return (
      renderToStaticMarkup(
        <TooltipProvider>
          <FeatureLeftBlock {...props} activeTab={activeTab} />
          <FeatureRightBlock {...props} activeTab={activeTab} />
        </TooltipProvider>,
      ).match(/<button\b[^>]*>/g) ?? []
    );
  }

  it.each(["Archive", "Split view", "Toggle sidebar"])(
    "uses sidebar active colors for %s",
    (label) => {
      const button = buttons().find((item) =>
        item.includes(`aria-label="${label}"`),
      );
      expect(button).toContain('data-active="true"');
      expect(button).toContain("bg-primary/10");
      expect(button).toContain("text-primary");
      expect(button).not.toContain("bg-professional-secondary");
    },
  );

  it("highlights Settings for its subpages and leaves other pages inactive", () => {
    const markup = buttons({ ...webTab, internalPage: "settings/appearance" });
    expect(
      markup.find((item) => item.includes('aria-label="Settings"')),
    ).toContain('data-active="true"');
    expect(
      markup.find((item) => item.includes('aria-label="History"')),
    ).not.toContain("data-active");
  });
});
