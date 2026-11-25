import { useFullScreen } from "@/hooks/use-full-screen";
import type { ComponentProps } from "react";
import { cn } from "@gorth-com/primitive/cores/cn";
import {
  AddressBarInput,
  FeatureLeftBlock,
  FeatureRightBlock,
  openAddressBarContextMenu,
  type FeatureBlockProps,
} from "@/layouts/feature-block";

export function BrowserToolbar({
  as: Tag = "header",
  reserveWindowControls = true,
  contentClassName,
  children,
  className,
  ...props
}: ComponentProps<"header"> & {
  as?: "header" | "nav";
  reserveWindowControls?: boolean;
  contentClassName?: string;
}) {
  const isFullScreen = useFullScreen();
  return (
    <Tag
      {...props}
      className={cn(
        "[-webkit-app-region:drag] select-none relative z-50 flex h-14 shrink-0 items-center border-b bg-sidebar backdrop-blur-xl",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full shrink-0 transition-[width] duration-200",
          reserveWindowControls &&
            window.electronAPI.windowState.isMacOS &&
            !isFullScreen
            ? "w-24 border-r"
            : "w-0",
        )}
      />
      <div
        className={cn(
          "[-webkit-app-region:drag] select-none flex h-full min-w-0 flex-1 items-center gap-2 p-2.5 [&_button]:[-webkit-app-region:no-drag]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </Tag>
  );
}

export function AddressBar(props: FeatureBlockProps) {
  return (
    <BrowserToolbar
      as="nav"
      aria-label="Browser address toolbar"
      reserveWindowControls={props.verticalTabs}
      onContextMenu={(event) =>
        openAddressBarContextMenu(
          event,
          event.currentTarget.querySelector("input"),
        )
      }
    >
      <FeatureLeftBlock {...props} />
      <AddressBarInput
        activeTab={props.activeTab}
        onNavigate={props.onNavigate}
      />
      <FeatureRightBlock {...props} />
    </BrowserToolbar>
  );
}
