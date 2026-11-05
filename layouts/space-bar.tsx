import { Layers } from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";

export function SpaceBar() {
  return (
    <aside
      aria-label="Workspace sidebar"
      className="[-webkit-app-region:no-drag] flex w-14 shrink-0 flex-col items-center gap-2 border-r bg-muted/50 p-2.5"
    >
      <Button
        aria-label="Workspaces coming soon"
        className="size-9"
        disabled
        size="icon"
        variant="ghost"
      >
        <Layers className="size-4" />
      </Button>
    </aside>
  );
}
