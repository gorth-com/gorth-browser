import { useRef, type ComponentProps } from "react";
import { ChevronDown, Plus } from "@gorth-io/primitive/cores/lucide";
import { BrowserTabs } from "@/components/element/browser-tabs";
import { Button } from "@gorth-io/primitive/custom/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import {
  getPortalMenuAnchor,
  getPortalMenuTheme,
} from "@/lib/browser/browser-menu";
import { cn } from "@gorth-io/primitive/cores/cn";

interface VerticalTabsProps extends ComponentProps<typeof BrowserTabs> {
  onCreateTab: () => void;
}

function VerticalTabs({ onCreateTab, ...props }: VerticalTabsProps) {
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const openTabList = async () => {
    if (!listButtonRef.current) return;
    const id = await window.electronAPI.tabs.openListMenu(
      props.activeTabId,
      props.tabs,
      getPortalMenuAnchor(listButtonRef.current),
      getPortalMenuTheme(),
    );
    if (id) props.onActivate(id);
  };
  return (
    <aside
      aria-label="Vertical tabs"
      data-side="left"
      className={cn(
        "[-webkit-app-region:drag] select-none flex shrink-0 flex-col items-center gap-2 bg-muted/50 p-2.5 group-data-[side=left]:border-r group-data-[side=right]:border-l data-[side=left]:border-r data-[side=right]:border-l",
        props.collapsed ? "w-14 px-2" : "w-[200px]",
      )}
    >
      <BrowserTabs {...props} vertical />
      <div
        className={cn(
          "[-webkit-app-region:no-drag] flex w-full shrink-0 items-center gap-2",
          props.collapsed && "flex-col",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Open new tab"
                size="icon"
                variant="ghost"
                onClick={onCreateTab}
              >
                <Plus />
              </Button>
            }
          />
          <TooltipContent
            side="right"
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
                size="icon"
                variant="ghost"
                ref={listButtonRef}
                onClick={() => void openTabList()}
              >
                <ChevronDown />
              </Button>
            }
          />
          <TooltipContent
            side="right"
            align="end"
            className="w-[90px] min-w-[90px] max-w-[90px] whitespace-normal break-words justify-end text-right"
          >
            All tabs
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

export { VerticalTabs };
