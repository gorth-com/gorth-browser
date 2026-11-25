import { Bookmark } from "@gorth-com/primitive/cores/lucide";
import type { NavMainItem } from "@gorth-com/primitive/utils/interface";
export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
}
export type BrowserSidebarSide = "left" | "right";
export function bookmarkNavigation(
  bookmarks: BrowserBookmark[],
): NavMainItem[] {
  return bookmarks.map((bookmark) => ({
    title: bookmark.title,
    url: bookmark.url,
    icon: Bookmark,
  }));
}
