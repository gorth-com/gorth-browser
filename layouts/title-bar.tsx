import { useEffect, useRef, useState, type MouseEvent } from "react";
import { BrowserToolbar } from "@/layouts/address-bar";
import { ChevronDown, Plus, Zap } from "@gorth-com/primitive/cores/lucide";

import {
  BrowserTabs,
  type BrowserTabItem,
} from "@/components/element/browser-tabs";
import { Button } from "@gorth-com/primitive/custom/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import {
  AddressBarInput,
  FeatureLeftBlock,
  FeatureRightBlock,
  type FeatureBlockProps,
} from "@/layouts/feature-block";
import type { PersistedTabGroup } from "@/lib/browser/persistence";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
  type TitlebarContextMenuCommand,
} from "@/lib/browser/browser-menu";

interface TitlebarProps {
  compactFeatures?: FeatureBlockProps;
  groups: PersistedTabGroup[];
  activeTabId: string;
  showLogo: boolean;
  tabs: BrowserTabItem[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCreateTab: () => void;
  onReloadTab: (tabId: string) => void;
  onToggleMuteTab: (tabId: string) => void;
  onTogglePinTab: (tabId: string) => void;
}

function Titlebar({
  compactFeatures,
  groups,
  activeTabId,
  showLogo,
  tabs,
  onActivateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCreateTab,
  onReloadTab,
  onToggleMuteTab,
  onTogglePinTab,
}: TitlebarProps) {
  const tabMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  useEffect(
    () => setEditingTabId(null),
    [activeTabId, Boolean(compactFeatures)],
  );

  const openTabListMenu = async () => {
    if (!tabMenuButtonRef.current) return;

    const selectedTabId = await window.electronAPI.tabs.openListMenu(
      activeTabId,
      tabs.map(
        ({ faviconUrl, id, isLoading, isMuted, title, internalPage }) => ({
          internalPage,
          faviconUrl,
          id,
          isLoading,
          isMuted,
          title,
        }),
      ),
      getPortalMenuAnchor(tabMenuButtonRef.current),
      getPortalMenuTheme(),
    );

    if (selectedTabId) onActivateTab(selectedTabId);
  };

  const openTitlebarContextMenu = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activeTab) return;

    const command = await window.electronAPI.titlebarMenu.open(
      {
        canClose: tabs.length > 1,
        canReload: activeTab.internalPage === null,
        isMuted: activeTab.isMuted,
      },
      {
        height: 0,
        width: 0,
        x: event.clientX,
        y: event.clientY,
      },
      getPortalMenuTheme(),
    );

    if (!command) return;

    const actions: Record<TitlebarContextMenuCommand, () => void> = {
      "new-tab": onCreateTab,
      "reload-tab": () => onReloadTab(activeTab.id),
      "toggle-mute-tab": () => onToggleMuteTab(activeTab.id),
      "close-tab": () => onCloseTab(activeTab.id),
    };

    actions[command]();
  };

  return (
    <BrowserToolbar
      data-tab-layout={compactFeatures ? "compact" : "separate"}
      contentClassName="gap-2"
      onContextMenu={(event) => void openTitlebarContextMenu(event)}
    >
      {showLogo && (
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center p-2.5 text-foreground"
        >
          <Zap className="size-4 shrink-0" />
        </span>
      )}

      {compactFeatures && (
        <div>
          <FeatureLeftBlock {...compactFeatures} />
        </div>
      )}
      <BrowserTabs
        compact={Boolean(compactFeatures)}
        onEditActiveTab={() => setEditingTabId(activeTabId)}
        activeTabEditor={
          compactFeatures && editingTabId === activeTabId ? (
            <AddressBarInput
              key={activeTabId}
              activeTab={compactFeatures.activeTab}
              onNavigate={compactFeatures.onNavigate}
              autoFocus
              compact
              onFinishEditing={() => setEditingTabId(null)}
            />
          ) : undefined
        }
        groups={groups}
        activeTabId={activeTabId}
        tabs={tabs}
        onActivate={onActivateTab}
        onClose={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onReload={onReloadTab}
        onToggleMute={onToggleMuteTab}
        onTogglePin={onTogglePinTab}
      />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Open new tab"
              className="[-webkit-app-region:no-drag]"
              onClick={onCreateTab}
              size="icon"
              variant="ghost"
            >
              <Plus className="size-4" />
            </Button>
          }
        />
        <TooltipContent
          side="bottom"
          align="end"
          className="w-[90px] min-w-[90px] max-w-[90px] whitespace-normal break-words justify-end text-right"
        >
          New tab
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Show all tabs"
              className="[-webkit-app-region:no-drag]"
              onClick={() => void openTabListMenu()}
              ref={tabMenuButtonRef}
              size="icon"
              variant="ghost"
            >
              <ChevronDown className="size-4" />
            </Button>
          }
        />
        <TooltipContent
          side="bottom"
          align="end"
          className="w-[90px] min-w-[90px] max-w-[90px] whitespace-normal break-words justify-end text-right"
        >
          All tabs
        </TooltipContent>
      </Tooltip>
      {compactFeatures && (
        <div>
          <FeatureRightBlock {...compactFeatures} />
        </div>
      )}
    </BrowserToolbar>
  );
}

export { Titlebar };
