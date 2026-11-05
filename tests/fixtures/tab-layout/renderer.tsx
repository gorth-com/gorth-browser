import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Titlebar } from "@/layouts/title-bar";
import { AddressBar } from "@/layouts/address-bar";
import { VerticalTabs } from "@/layouts/vertical-tabs";
import { PanelBar } from "@/layouts/panel-bar";
import type { FeatureBlockProps } from "@/layouts/feature-block";
import type { BrowserTabItem } from "@/components/element/browser-tabs";
import type { PersistedTabGroup } from "@/lib/browser/persistence";
import { TooltipProvider } from "@/providers/tooltip";
import "@/styles/globals.css";

// Renderer-only test doubles: no production accounts, database or network.
const actions: string[] = [];
Object.assign(window, {
  electronAPI: {
    windowState: {
      isMacOS: true,
      getIsFullScreen: async () => false,
      onFullScreenChanged: () => () => {},
    },
    browserMenu: { open: async () => "settings" },
    tabs: { openListMenu: async () => null, openContextMenu: async () => null },
    addressBarMenu: { open: async () => null },
    siteInfo: { open: async () => null },
  },
});
const initialTabs: BrowserTabItem[] = ["Google", "YouTube", "Example"].map(
  (title, index) => ({
    id: String(index),
    title,
    url: `https://www.${title.toLowerCase()}.com/watch?v=test`,
    isPinned: false,
    faviconUrl: "",
    canGoBack: true,
    canGoForward: true,
    isLoading: false,
    isMuted: false,
    isHome: false,
    internalPage: null,
  }),
);
function Fixture() {
  const [compact, setCompact] = useState(false);
  const [vertical, setVertical] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState("0");
  const [groups, setGroups] = useState<PersistedTabGroup[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSide, setSidebarSide] = useState<"left" | "right">("left");
  const activeTab = tabs.find((tab) => tab.id === activeTabId)!;
  const features: FeatureBlockProps = {
    activeTab,
    verticalTabs: vertical,
    verticalCollapsed: collapsed,
    canSplit: true,
    isBookmarked: false,
    isSidebarOpen: sidebarOpen,
    isSplit: false,
    onToggleVerticalSidebar: () => {},
    onBack: () => actions.push("back"),
    onForward: () => actions.push("forward"),
    onHome: () => actions.push("home"),
    onReload: () => actions.push("reload"),
    onStop: () => actions.push("stop"),
    onBookmark: () => actions.push("bookmark"),
    onCreateTab: () => actions.push("new-tab"),
    onNavigate: (url) => actions.push("navigate:" + url),
    onOpenInternal: (page) => actions.push("internal:" + page),
    onToggleSidebar: () => {
      actions.push("sidebar");
      setSidebarOpen((open) => !open);
    },
    onToggleSplit: () => actions.push("split"),
  };
  const closeTab = (id: string) =>
    setTabs((current) => current.filter((tab) => tab.id !== id));
  Object.assign(window, {
    tabLayoutFixture: {
      setCompact: (value: boolean) => flushSync(() => setCompact(value)),
      setVertical: (value: boolean, collapse = false) =>
        flushSync(() => {
          setVertical(value);
          setCollapsed(collapse);
          if (value) setCompact(true);
        }),
      setSidebarSide: (side: "left" | "right") =>
        flushSync(() => setSidebarSide(side)),
      setActive: (id: string) => flushSync(() => setActiveTabId(id)),
      setGrouped: () =>
        flushSync(() =>
          setGroups([
            {
              id: "group",
              name: "My group",
              mode: "normal",
              tabIds: ["0", "1"],
            },
          ]),
        ),
      setPinned: () =>
        flushSync(() =>
          setTabs((current) =>
            current.map((tab) => ({ ...tab, isPinned: tab.id === "2" })),
          ),
        ),
      setLoading: () =>
        flushSync(() =>
          setTabs((current) =>
            current.map((tab) => ({
              ...tab,
              isLoading: tab.id === activeTabId,
            })),
          ),
        ),
      actions,
    },
  });
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        {!vertical && (
          <Titlebar
            groups={groups}
            activeTabId={activeTabId}
            showLogo={false}
            tabs={tabs}
            compactFeatures={compact ? features : undefined}
            onActivateTab={setActiveTabId}
            onCloseTab={closeTab}
            onCloseOtherTabs={() => {}}
            onCreateTab={features.onCreateTab}
            onReloadTab={features.onReload}
            onToggleMuteTab={(id) => actions.push("mute:" + id)}
            onTogglePinTab={() => {}}
          />
        )}
        {(!compact || vertical) && <AddressBar {...features} />}
        <div className="relative flex min-h-0 flex-1">
          {vertical && (
            <VerticalTabs
              groups={groups}
              tabs={tabs}
              activeTabId={activeTabId}
              collapsed={collapsed}
              onCreateTab={features.onCreateTab}
              onActivate={setActiveTabId}
              onClose={closeTab}
              onCloseOtherTabs={() => {}}
              onReload={features.onReload}
              onToggleMute={() => {}}
              onTogglePin={() => {}}
            />
          )}
          {sidebarOpen && sidebarSide === "left" && (
            <PanelBar
              side={sidebarSide}
              onClose={() => setSidebarOpen(false)}
            />
          )}
          <main className="min-w-0 flex-1" />
          {sidebarOpen && sidebarSide === "right" && (
            <PanelBar
              side={sidebarSide}
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
