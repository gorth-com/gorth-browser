import { internalIcons } from "@/utils/constant";
import {
  Globe2,
  LoaderCircle,
  Settings,
} from "@gorth-com/primitive/cores/lucide";
import type { BrowserInternalPage } from "@/lib/browser/internal-pages";

function TabIcon({
  internalPage,
  faviconUrl,
  isLoading,
}: {
  internalPage: BrowserInternalPage | null;
  faviconUrl: string;
  isLoading: boolean;
}) {
  if (internalPage) {
    const Icon = internalPage.startsWith("settings/")
      ? Settings
      : (internalIcons[internalPage as keyof typeof internalIcons] ?? Globe2);
    return <Icon className="size-4 shrink-0" />;
  }
  if (isLoading)
    return <LoaderCircle className="size-4 shrink-0 animate-spin" />;
  if (faviconUrl)
    return (
      <img alt="" className="size-4 shrink-0 rounded-sm" src={faviconUrl} />
    );
  return <Globe2 className="size-4 shrink-0" />;
}

export { TabIcon };
