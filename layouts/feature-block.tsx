import { systemPageButtons } from "@/utils/constant";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ComponentProps,
  type MouseEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Columns2,
  Home,
  Menu,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from "@gorth-com/primitive/cores/lucide";

import type { BrowserTabItem } from "@/components/element/browser-tabs";
import { RecentDownloads } from "@/components/element/recent-downloads";
import { PortalPanel } from "@/providers/portal";
import { AddressBarForm } from "@/components/form/address-bar-form";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { cn } from "@gorth-com/primitive/cores/cn";
import { formatAddress, formatAddressInput } from "@/utils/formatter";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
  type BrowserMenuCommand,
} from "@/lib/browser/browser-menu";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

export interface FeatureBlockProps {
  verticalTabs: boolean;
  verticalCollapsed: boolean;
  onToggleVerticalSidebar: () => void;
  activeTab: BrowserTabItem;
  isBookmarked: boolean;
  isSidebarOpen: boolean;
  isSplit: boolean;
  canSplit: boolean;
  onBack: () => void;
  onBookmark: () => void;
  onCreateTab: () => void;
  onForward: () => void;
  onHome: () => void;
  onNavigate: (value: string) => void;
  onReload: () => void;
  onStop: () => void;
  onOpenInternal: (page: Exclude<BrowserInternalPage, "new-tab">) => void;
  onToggleSidebar: () => void;
  onToggleSplit: () => void;
}

export function openAddressBarContextMenu(
  event: MouseEvent<HTMLElement>,
  input: HTMLInputElement | null,
) {
  event.preventDefault();
  event.stopPropagation();
  const hasSelection = Boolean(
    input && input.selectionStart !== input.selectionEnd,
  );
  void window.electronAPI.addressBarMenu.open(
    {
      canCopy: hasSelection,
      canCut: hasSelection,
      canSelectAll: Boolean(input?.value.length),
    },
    { height: 0, width: 0, x: event.clientX, y: event.clientY },
    getPortalMenuTheme(),
  );
}

function AddressBarButton({
  title,
  tooltipAlign = "start",
  isActive = false,
  className,
  ...props
}: ComponentProps<typeof Button> & {
  title: string;
  tooltipAlign?: "start" | "end";
  isActive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            {...props}
            data-active={isActive || undefined}
            className={cn(
              className,
              isActive &&
                "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary dark:hover:bg-primary/10",
            )}
          />
        }
      />
      <TooltipContent
        side="bottom"
        align={tooltipAlign}
        className={cn(
          "w-[90px] min-w-[90px] max-w-[90px] whitespace-normal break-words",
          tooltipAlign === "end"
            ? "justify-end text-right"
            : "justify-start text-left",
        )}
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

export function FeatureLeftBlock({
  verticalTabs,
  verticalCollapsed,
  onToggleVerticalSidebar,
  activeTab,
  isBookmarked,
  canSplit,
  isSplit,
  onBack,
  onForward,
  onReload,
  onStop,
  onHome,
  onBookmark,
  onToggleSplit,
  onOpenInternal,
}: FeatureBlockProps) {
  const siteButtonRef = useRef<HTMLButtonElement>(null);
  const openSiteInfo = async () => {
    if (!siteButtonRef.current) return;
    const command = await window.electronAPI.siteInfo.open(
      activeTab.id,
      getPortalMenuAnchor(siteButtonRef.current),
      getPortalMenuTheme(),
    );
    if (command === "settings") onOpenInternal("settings");
  };

  return (
    <div className="[-webkit-app-region:drag] select-none flex shrink-0 items-center gap-2 [&_button]:[-webkit-app-region:no-drag]">
      {verticalTabs && (
        <AddressBarButton
          aria-label={
            verticalCollapsed
              ? "Expand vertical tabs"
              : "Collapse vertical tabs"
          }
          aria-expanded={!verticalCollapsed}
          title={
            verticalCollapsed
              ? "Expand vertical tabs"
              : "Collapse vertical tabs"
          }
          onClick={onToggleVerticalSidebar}
          size="icon"
          variant="ghost"
        >
          {verticalCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </AddressBarButton>
      )}
      <AddressBarButton
        aria-label="Back"
        disabled={!activeTab.canGoBack}
        onClick={onBack}
        size="icon"
        title="Back"
        variant="ghost"
      >
        <ArrowLeft />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Forward"
        disabled={!activeTab.canGoForward}
        onClick={onForward}
        size="icon"
        title="Forward"
        variant="ghost"
      >
        <ArrowRight />
      </AddressBarButton>
      <AddressBarButton
        aria-label={activeTab.isLoading ? "Loading" : "Reload"}
        disabled={activeTab.internalPage !== null}
        onClick={activeTab.isLoading ? onStop : onReload}
        size="icon"
        title={activeTab.isLoading ? "Loading" : "Reload"}
        variant="ghost"
      >
        {activeTab.isLoading ? <X /> : <RotateCw />}
      </AddressBarButton>
      <AddressBarButton
        aria-label="Home"
        onClick={onHome}
        size="icon"
        title="Home"
        variant="ghost"
      >
        <Home />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Split view"
        disabled={!canSplit}
        onClick={onToggleSplit}
        size="icon"
        title="Split view"
        isActive={isSplit}
        variant="ghost"
      >
        <Columns2 />
      </AddressBarButton>
      <AddressBarButton
        aria-label="Bookmark this page"
        disabled={activeTab.internalPage !== null}
        onClick={onBookmark}
        size="icon"
        title="Bookmark"
        variant="ghost"
      >
        <Bookmark className={isBookmarked ? "fill-current" : undefined} />
      </AddressBarButton>

      <AddressBarButton
        aria-label="Site information"
        disabled={
          activeTab.internalPage !== null ||
          !/^https?:\/\//i.test(activeTab.url)
        }
        onClick={() => void openSiteInfo()}
        ref={siteButtonRef}
        size="icon"
        title="Information"
        variant="ghost"
      >
        <SlidersHorizontal />
      </AddressBarButton>
    </div>
  );
}

export function FeatureRightBlock({
  activeTab,
  canSplit,
  isSidebarOpen,
  isSplit,
  onCreateTab,
  onHome,
  onBookmark,
  onOpenInternal,
  onToggleSidebar,
  onToggleSplit,
}: FeatureBlockProps) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const handleMenuCommand = (command: BrowserMenuCommand) => {
    const actions: Record<BrowserMenuCommand, () => void> = {
      "new-tab": onCreateTab,
      home: onHome,
      bookmark: onBookmark,
      bookmarks: () => onOpenInternal("bookmarks"),
      history: () => onOpenInternal("history"),
      downloads: () => onOpenInternal("downloads"),
      "toggle-sidebar": onToggleSidebar,
      "toggle-split": onToggleSplit,
      settings: () => onOpenInternal("settings"),
    };

    actions[command]();
  };

  const openBrowserMenu = async () => {
    if (!menuButtonRef.current) return;

    const command = await window.electronAPI.browserMenu.open(
      {
        canBookmark: activeTab.internalPage === null,
        canShowSidebar: true,
        canSplit,
        isSidebarOpen,
        isSplit,
      },
      getPortalMenuAnchor(menuButtonRef.current),
      getPortalMenuTheme(),
    );

    if (command) handleMenuCommand(command);
  };

  return (
    <div className="[-webkit-app-region:no-drag] flex shrink-0 items-center gap-2">
      <div className="[-webkit-app-region:no-drag] flex shrink-0 items-center gap-2">
        {systemPageButtons.map(({ page, label, icon: Icon }) => (
          <AddressBarButton
            aria-label={label}
            className={page === "shortcuts" ? "hidden" : undefined}
            key={page}
            onClick={() =>
              page === "downloads"
                ? setDownloadsOpen(!downloadsOpen)
                : onOpenInternal(page)
            }
            ref={page === "downloads" ? downloadButtonRef : undefined}
            aria-expanded={page === "downloads" ? downloadsOpen : undefined}
            aria-haspopup={page === "downloads" ? "menu" : undefined}
            size="icon"
            title={label}
            tooltipAlign="end"
            isActive={Boolean(
              activeTab.internalPage === page ||
              (page === "settings" &&
                activeTab.internalPage?.startsWith("settings/")),
            )}
            variant="ghost"
          >
            <Icon />
          </AddressBarButton>
        ))}
      </div>

      {downloadsOpen && downloadButtonRef.current && (
        <PortalPanel
          anchor={getPortalMenuAnchor(downloadButtonRef.current)}
          align="end"
          onClose={() => setDownloadsOpen(false)}
        >
          <RecentDownloads
            onClose={() => setDownloadsOpen(false)}
            onShowAll={() => onOpenInternal("downloads")}
          />
        </PortalPanel>
      )}

      <AddressBarButton
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        size="icon"
        title="Sidebar"
        tooltipAlign="end"
        isActive={isSidebarOpen}
        variant="ghost"
      >
        <PanelLeft />
      </AddressBarButton>

      <AddressBarButton
        aria-label="Open browser menu"
        onClick={() => void openBrowserMenu()}
        ref={menuButtonRef}
        size="icon"
        title="Menu"
        tooltipAlign="end"
        variant="ghost"
      >
        <Menu />
      </AddressBarButton>
    </div>
  );
}

export function AddressBarInput({
  activeTab,
  onNavigate,
  autoFocus = false,
  compact = false,
  onFinishEditing,
}: Pick<FeatureBlockProps, "activeTab" | "onNavigate"> & {
  autoFocus?: boolean;
  compact?: boolean;
  onFinishEditing?: () => void;
}) {
  const [value, setValue] = useState(() => formatAddressInput(activeTab.url));
  const [isFocused, setIsFocused] = useState(autoFocus);
  const [scrollLeft, setScrollLeft] = useState(0);
  const selectOnMouseUp = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = isFocused ? value : formatAddress(activeTab.url);
  // Keep the real input for editing/selection; paint the same text above it.
  const urlParts = displayValue.match(
    /^(https?:\/\/|gorth:\/\/)?([^/?#\s]+)(.*)$/i,
  );
  const isAddress = /^(https?:\/\/|gorth:\/\/)/i.test(
    isFocused ? value : activeTab.url,
  );

  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (isFocused) {
      inputRef.current?.select();
      if (inputRef.current) inputRef.current.scrollLeft = 0;
      setScrollLeft(0);
    }
  }, [isFocused]);

  useEffect(
    () => setValue(formatAddressInput(activeTab.url)),
    [activeTab.id, activeTab.url],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim()) {
      onNavigate(value);
      onFinishEditing?.();
    }
  };

  return (
    <div
      className="[-webkit-app-region:no-drag] flex min-w-0 flex-1"
      onContextMenu={(event) =>
        openAddressBarContextMenu(event, inputRef.current)
      }
    >
      <AddressBarForm onSubmit={handleSubmit}>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Address bar"
          className={cn(
            "h-9 select-text rounded-md bg-muted/60 pr-4 pl-9 text-transparent caret-foreground shadow-none transition-none selection:bg-primary/25 selection:text-transparent focus-visible:bg-background focus-visible:ring-0",
            compact &&
              "border-0 bg-transparent focus-visible:bg-transparent dark:bg-transparent",
          )}
          autoFocus={autoFocus}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setValue(formatAddressInput(activeTab.url));
              event.currentTarget.blur();
              onFinishEditing?.();
            }
          }}
          onChange={(event) => setValue(event.target.value)}
          onPointerDown={(event) => {
            selectOnMouseUp.current =
              event.button === 0 &&
              document.activeElement !== event.currentTarget;
          }}
          onMouseUp={(event) => {
            if (!selectOnMouseUp.current) return;
            event.preventDefault();
            event.currentTarget.select();
            selectOnMouseUp.current = false;
          }}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            selectOnMouseUp.current = false;
            setScrollLeft(0);
            setIsFocused(false);
            setValue(formatAddressInput(activeTab.url));
            onFinishEditing?.();
          }}
          placeholder="Search or enter address"
          ref={inputRef}
          value={displayValue}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[17px] left-[37px] flex items-center overflow-hidden text-base md:text-sm"
        >
          <span
            className="whitespace-pre"
            style={{
              transform: `translateX(-${isFocused ? scrollLeft : 0}px)`,
            }}
          >
            {isAddress && urlParts ? (
              <>
                <span className="text-muted-foreground">{urlParts[1]}</span>
                <span className="text-foreground">{urlParts[2]}</span>
                <span className="text-muted-foreground">{urlParts[3]}</span>
              </>
            ) : (
              <span className="text-foreground">{displayValue}</span>
            )}
          </span>
        </div>
      </AddressBarForm>
    </div>
  );
}
