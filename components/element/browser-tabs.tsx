import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Volume2,
  VolumeX,
  X,
} from "@gorth-io/primitive/cores/lucide";
import type { PersistedTabGroup } from "@/lib/browser/persistence";
import { getCompactTabWidth } from "@/lib/browser/tab-layout";

import { Button } from "@gorth-io/primitive/custom/button";
import { TabIcon } from "@/components/element/tab-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { cn } from "@gorth-io/primitive/cores/cn";
import { toast } from "@/providers/toaster";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";
import {
  getPortalMenuTheme,
  type PortalMenuAnchor,
  type TabContextMenuCommand,
} from "@/lib/browser/browser-menu";

interface BrowserTabItem {
  isSleeping?: boolean;
  lastActiveAt?: number;
  navigation?: import("@/lib/browser/persistence").PersistedTab["navigation"];
  errorCode?: number;
  errorDescription?: string;
  errorUrl?: string;
  isPinned: boolean;
  id: string;
  title: string;
  url: string;
  faviconUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isHome: boolean;
  internalPage: BrowserInternalPage | null;
}

interface BrowserTabsProps {
  compact?: boolean;
  activeTabEditor?: ReactNode;
  onEditActiveTab?: () => void;
  groups?: PersistedTabGroup[];
  vertical?: boolean;
  collapsed?: boolean;
  activeTabId: string;
  tabs: BrowserTabItem[];
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onReload: (tabId: string) => void;
  onToggleMute: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
}

function BrowserTabs({
  compact = false,
  activeTabEditor,
  onEditActiveTab,
  groups = [],
  vertical = false,
  collapsed = false,
  activeTabId,
  tabs,
  onActivate,
  onClose,
  onCloseOtherTabs,
  onReload,
  onToggleMute,
  onTogglePin,
}: BrowserTabsProps) {
  const emitted = new Set<string>();
  const orderedTabs = tabs.flatMap((tab) => {
    if (emitted.has(tab.id)) return [];
    const group = groups.find((item) => item.tabIds.includes(tab.id));
    const members = group
      ? group.tabIds
          .map((id) => tabs.find((item) => item.id === id))
          .filter((item): item is BrowserTabItem => Boolean(item))
      : [tab];
    members.forEach((item) => emitted.add(item.id));
    return members;
  });
  const tabListRef = useRef<HTMLDivElement>(null);
  const [compactWidth, setCompactWidth] = useState(180);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    isOverflowing: false,
  });

  const updateScrollState = useCallback(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    setScrollState((currentState) => {
      const controlsWidth = currentState.isOverflowing ? 88 : 0;
      const isOverflowing =
        tabList.scrollWidth - tabList.clientWidth - controlsWidth > 1;
      const maximumScrollLeft = tabList.scrollWidth - tabList.clientWidth;

      return {
        canScrollLeft: isOverflowing && tabList.scrollLeft > 1,
        canScrollRight:
          isOverflowing && tabList.scrollLeft < maximumScrollLeft - 1,
        isOverflowing,
      };
    });
  }, []);

  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!compact || !list) return;
    const measure = () => {
      const groupButtons = [
        ...list.querySelectorAll<HTMLElement>("[data-tab-group]"),
      ];
      const groupWidth = groupButtons.reduce(
        (sum, button) => sum + button.getBoundingClientRect().width,
        0,
      );
      const pinnedCount = tabs.filter(
        (tab) => tab.isPinned && tab.id !== activeTabId,
      ).length;
      const gapWidth = Math.max(0, tabs.length + groupButtons.length - 1) * 8;
      setCompactWidth(
        getCompactTabWidth(
          list.clientWidth - groupWidth - pinnedCount * 36 - gapWidth,
          tabs.length - pinnedCount - 1,
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list
      .querySelectorAll<HTMLElement>("[data-tab-group]")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [compact, activeTabId, tabs, groups]);

  useEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(tabList);
    tabList.addEventListener("scroll", updateScrollState, { passive: true });
    const frame = requestAnimationFrame(updateScrollState);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      tabList.removeEventListener("scroll", updateScrollState);
    };
  }, [tabs, updateScrollState]);

  useEffect(() => {
    const activeTab = tabListRef.current?.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeTabId)}"]`,
    );
    activeTab?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeTabId, vertical, collapsed, compactWidth, compact]);

  const scrollTabs = (direction: -1 | 1) => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    tabList.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(160, tabList.clientWidth * 0.7),
    });
  };

  const openTabContextMenu = async (
    tab: BrowserTabItem,
    anchor: PortalMenuAnchor,
  ) => {
    const command = (await window.electronAPI.tabs.openContextMenu(
      tab.title,
      tab.isMuted,
      tab.isPinned,
      tab.internalPage === null,
      true,
      anchor,
      getPortalMenuTheme(),
      tab.id !== activeTabId && !tab.isPinned,
    )) as TabContextMenuCommand | null;

    if (!command) return;

    const runLifecycle = (action: "sleep" | "archive") => {
      void window.electronAPI.lifecycle[action](tab.id)
        .then((changed) => {
          if (!changed)
            toast.add({
              title: "Tab is protected",
              description:
                "Active, pinned, grouped, loading, media, download and edited-form tabs stay open.",
              type: "info",
            });
        })
        .catch(() =>
          toast.add({
            title: "Unable to update tab",
            description: "The tab was kept open. Please try again.",
            type: "error",
          }),
        );
    };

    const actions: Record<TabContextMenuCommand, () => void> = {
      "sleep-tab": () => runLifecycle("sleep"),
      "archive-tab": () => runLifecycle("archive"),
      "reload-tab": () => onReload(tab.id),
      "toggle-mute-tab": () => onToggleMute(tab.id),
      "toggle-pin-tab": () => onTogglePin(tab.id),
      "close-tab": () => onClose(tab.id),
      "close-other-tabs": () => onCloseOtherTabs(tab.id),
    };

    actions[command]();
  };

  return (
    <div
      className={cn(
        "[-webkit-app-region:drag] select-none flex min-h-0 min-w-0 flex-1 items-center gap-2",
        vertical && "w-full flex-col",
      )}
    >
      <div
        aria-label="Open tabs"
        className={cn(
          "[-webkit-app-region:drag] select-none flex min-h-0 min-w-0 flex-1 items-center gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          vertical
            ? "w-full flex-col items-start overflow-x-hidden overflow-y-auto"
            : "overflow-x-auto",
        )}
        ref={tabListRef}
        role="tablist"
        aria-orientation={vertical ? "vertical" : "horizontal"}
      >
        {orderedTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const iconOnly =
            collapsed || (tab.isPinned && !(compact && isActive));
          const group = groups.find((item) => item.tabIds.includes(tab.id));
          const firstMember =
            group &&
            group.tabIds.find((id) => tabs.some((item) => item.id === id)) ===
              tab.id;

          return (
            <Fragment key={tab.id}>
              {firstMember && (
                <Button
                  data-tab-group={group.id}
                  className={cn(
                    "[-webkit-app-region:no-drag] h-9 shrink-0 bg-foreground text-background hover:bg-foreground/90",
                    vertical && !collapsed && "w-full min-w-0 justify-start",
                    collapsed && "size-9 p-0",
                  )}
                  title={`${group.name} (${group.mode})`}
                  aria-label={`Open group ${group.name}`}
                  onClick={() => onActivate(tab.id)}
                >
                  <Folder className="size-4" />
                  {!collapsed && (
                    <span className="max-w-[144px] truncate">{group.name}</span>
                  )}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger
                  closeOnClick={false}
                  render={
                    <div
                      className={cn(
                        "[-webkit-app-region:no-drag] group relative box-border flex h-9 cursor-pointer select-none items-center gap-1 overflow-hidden rounded-md border-0 bg-clip-padding p-1 shadow-none outline-none transition-colors hover:bg-muted has-[:focus-visible]:bg-accent",
                        iconOnly
                          ? "size-9 shrink-0"
                          : compact
                            ? "shrink-0"
                            : vertical
                              ? "w-full min-w-0 shrink-0"
                              : "min-w-24 basis-[180px] max-w-[180px] flex-1",
                        isActive
                          ? "bg-background/90 text-foreground"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground",
                        compact && "rounded-lg",
                        tab.isSleeping && "opacity-60",
                      )}
                      data-tab-id={tab.id}
                      style={
                        compact && !iconOnly
                          ? { width: compactWidth * (isActive ? 2 : 1) }
                          : undefined
                      }
                      key={tab.id}
                      onMouseDown={(event) => {
                        if (event.button === 1) event.preventDefault();
                      }}
                      onAuxClick={(event) => {
                        if (event.button !== 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        onClose(tab.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void openTabContextMenu(tab, {
                          height: 0,
                          width: 0,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                    />
                  }
                >
                  {compact && isActive && activeTabEditor ? (
                    <div className="absolute inset-y-0 right-16 left-0 flex min-w-0 items-center">
                      {activeTabEditor}
                    </div>
                  ) : (
                    <div
                      aria-selected={isActive}
                      aria-label={tab.title}
                      className={cn(
                        "absolute inset-0 flex cursor-pointer select-none items-center justify-start gap-2 overflow-hidden rounded-md px-2 text-xs font-normal whitespace-nowrap outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
                        iconOnly ? "justify-center p-0" : "pr-16",
                      )}
                      onClick={() =>
                        compact && isActive
                          ? onEditActiveTab?.()
                          : onActivate(tab.id)
                      }
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (compact && isActive) onEditActiveTab?.();
                          else onActivate(tab.id);
                        }
                      }}
                      role="tab"
                      tabIndex={0}
                    >
                      <TabIcon {...tab} />
                      {!iconOnly && (
                        <span className="min-w-0 truncate">{tab.title}</span>
                      )}
                    </div>
                  )}

                  {!iconOnly && (
                    <>
                      <Button
                        aria-label={
                          tab.isMuted
                            ? `Unmute ${tab.title}`
                            : `Mute ${tab.title}`
                        }
                        className={cn(
                          "relative z-10 ml-auto size-6 active:translate-x-0! active:translate-y-0!",
                          !isActive && "invisible group-hover:visible",
                        )}
                        onClick={() => onToggleMute(tab.id)}
                        size="icon-xs"
                        variant="ghost"
                      >
                        {tab.isMuted ? <VolumeX /> : <Volume2 />}
                      </Button>

                      <Button
                        aria-label={`Close ${tab.title}`}
                        className={cn(
                          "relative z-10 size-6 active:translate-x-0! active:translate-y-0!",
                          !isActive && "invisible group-hover:visible",
                        )}
                        onClick={() => onClose(tab.id)}
                        size="icon-xs"
                        variant="ghost"
                      >
                        <X />
                      </Button>
                    </>
                  )}
                </TooltipTrigger>
                {!(compact && isActive && activeTabEditor) && (
                  <TooltipContent
                    className="w-[180px]"
                    align="center"
                    side={vertical ? "right" : "bottom"}
                  >
                    <span className="line-clamp-2 min-w-0 break-words">
                      {tab.title}
                    </span>
                  </TooltipContent>
                )}
              </Tooltip>
            </Fragment>
          );
        })}
      </div>

      {!vertical && scrollState.isOverflowing && (
        <div className="[-webkit-app-region:no-drag] flex shrink-0 items-center gap-2">
          <Button
            aria-label="Scroll tabs left"
            disabled={!scrollState.canScrollLeft}
            onClick={() => scrollTabs(-1)}
            size="icon"
            title="Previous tabs"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Scroll tabs right"
            disabled={!scrollState.canScrollRight}
            onClick={() => scrollTabs(1)}
            size="icon"
            title="Next tabs"
            variant="ghost"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export { BrowserTabs };
export type { BrowserTabItem };
