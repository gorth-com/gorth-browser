import { PanelLeftClose, PanelRightClose } from "@gorth-io/primitive/cores/lucide";
import type { BrowserSidebarSide } from "@/components/dashboard/bookmarks";
import { Button } from "@gorth-io/primitive/custom/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { cn } from "@gorth-io/primitive/cores/cn";

interface PanelBarProps {
  side: BrowserSidebarSide;
  onClose: () => void;
}

export function PanelBar({ side, onClose }: PanelBarProps) {
  const Icon = side === "left" ? PanelLeftClose : PanelRightClose;
  return (
    <aside
      aria-label="Browser sidebar"
      data-side={side}
      className={cn(
        "[-webkit-app-region:no-drag] flex w-14 shrink-0 flex-col items-center gap-2 bg-muted/50 p-2.5 group-data-[side=left]:border-r group-data-[side=right]:border-l data-[side=left]:border-r data-[side=right]:border-l",
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Close sidebar"
              className="size-9"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <Icon className="size-4" />
            </Button>
          }
        />
        <TooltipContent
          className="w-[90px]"
          side={side === "left" ? "right" : "left"}
        >
          Close
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
