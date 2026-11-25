import { and, desc, eq } from "drizzle-orm"
import { recentlyClosed } from "@/database/schema"
import { type PersistedTab } from "@/lib/browser/persistence"
import { PROFILE_ID, WINDOW_ID, getDatabase, parseJson } from "@/services/database"
import { removeTabFromGroups } from "@/models/tab-group"

export function rawAddRecentlyClosedTab(tab: PersistedTab, windowId = WINDOW_ID) {
  removeTabFromGroups(tab.id, windowId);
  const { database } = getDatabase();
  database
    .insert(recentlyClosed)
    .values({
      id: crypto.randomUUID(),
      profileId: PROFILE_ID,
      tabJson: JSON.stringify(tab),
      windowId,
      closedAt: Date.now(),
    })
    .run();
  const overflow = database
    .select({ id: recentlyClosed.id })
    .from(recentlyClosed)
    .where(
      and(
        eq(recentlyClosed.profileId, PROFILE_ID),
        eq(recentlyClosed.windowId, windowId),
      ),
    )
    .orderBy(desc(recentlyClosed.closedAt))
    .all()
    .slice(25);
  for (const row of overflow)
    database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
}

export function rawPopRecentlyClosedTab(windowId = WINDOW_ID) {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(recentlyClosed)
    .where(
      and(
        eq(recentlyClosed.profileId, PROFILE_ID),
        eq(recentlyClosed.windowId, windowId),
      ),
    )
    .orderBy(desc(recentlyClosed.closedAt))
    .get();
  if (!row) return null;
  database.delete(recentlyClosed).where(eq(recentlyClosed.id, row.id)).run();
  return parseJson<PersistedTab | null>(row.tabJson, null);
}
