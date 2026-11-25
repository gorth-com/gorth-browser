import { and, desc, eq } from "drizzle-orm"
import { tabTable, archivedTabTable } from "@/database/schema"
import { type PersistedTab } from "@/lib/browser/persistence"
import { PROFILE_ID, getDatabase, parseJson } from "@/services/database"
import { removeTabFromGroups } from "@/models/tab-group"

export function rawListArchivedTabs() {
  return getDatabase()
    .database.select()
    .from(archivedTabTable)
    .orderBy(desc(archivedTabTable.archivedAt))
    .all()
    .map((row) => ({
      id: row.id,
      windowId: row.windowId,
      archivedAt: row.archivedAt,
      tab: parseJson<PersistedTab>(row.tabJson, {} as PersistedTab),
    }));
}

export function rawArchiveTab(tab: PersistedTab, windowId: string) {
  const { database, sqlite } = getDatabase();
  sqlite.transaction(() => {
    removeTabFromGroups(tab.id, windowId);
    database
      .insert(archivedTabTable)
      .values({
        id: tab.id,
        windowId,
        tabJson: JSON.stringify(tab),
        archivedAt: Date.now(),
      })
      .onConflictDoNothing()
      .run();
    database
      .delete(tabTable)
      .where(and(eq(tabTable.id, tab.id), eq(tabTable.windowId, windowId)))
      .run();
  })();
}

export function rawTakeArchivedTab(id: string, removeOnly = false) {
  const { database, sqlite } = getDatabase();
  return sqlite.transaction(() => {
    const row = database
      .select()
      .from(archivedTabTable)
      .where(eq(archivedTabTable.id, id))
      .get();
    if (!row) return null;
    database.delete(archivedTabTable).where(eq(archivedTabTable.id, id)).run();
    return removeOnly
      ? null
      : parseJson<PersistedTab | null>(row.tabJson, null);
  })();
}

export function rawRestoreArchivedTab(id: string, windowId: string) {
  const { database, sqlite } = getDatabase();
  return sqlite.transaction(() => {
    const archived = rawTakeArchivedTab(id);
    if (!archived) return null;
    const tab: PersistedTab = {
      ...archived,
      id: crypto.randomUUID(),
      isSleeping: false,
      lastActiveAt: Date.now(),
    };
    database
      .insert(tabTable)
      .values({
        id: tab.id,
        windowId,
        profileId: PROFILE_ID,
        position: database
          .select()
          .from(tabTable)
          .where(eq(tabTable.windowId, windowId))
          .all().length,
        title: tab.title,
        url: tab.url,
        faviconUrl: tab.faviconUrl,
        isMuted: tab.isMuted,
        isPinned: tab.isPinned,
        internalPage: tab.internalPage,
        isActive: false,
        lifecycle: JSON.stringify({
          navigation: tab.navigation,
          lastActiveAt: tab.lastActiveAt,
          isSleeping: false,
        }),
      })
      .run();
    return tab;
  })();
}
