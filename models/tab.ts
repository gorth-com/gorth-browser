import { defaultBrowserPreferences } from "@/utils/constant"
import { and, asc, desc, eq } from "drizzle-orm"
import { bookmarkTable, history, settingTable, tabGroupMemberTable, tabGroupTable, tabTable, archivedTabTable } from "@/database/schema"
import { type BrowserPreferences, type BrowserSnapshot, type PersistedTab } from "@/lib/browser/persistence"
import { parseInternalPage } from "@/lib/browser/internal-pages"
import { rawReadBrowserSetting } from "@/models/setting"
import { PROFILE_ID, WINDOW_ID, sharedBaselines, getDatabase, parseJson } from "@/services/database"
import { rawLoadTabGroups } from "@/models/tab-group"

export function rawLoadBrowserSnapshot(windowId = WINDOW_ID): BrowserSnapshot {
  const { database } = getDatabase();
  const savedSettings = Object.fromEntries(
    database
      .select()
      .from(settingTable)
      .where(eq(settingTable.profileId, PROFILE_ID))
      .all()
      .map((row) => [row.key, row.value]),
  );
  const preferences: BrowserPreferences = {
    ...defaultBrowserPreferences,
    ...parseJson<Partial<BrowserPreferences>>(
      savedSettings[`preferences:${windowId}`] ?? savedSettings.preferences,
      {},
    ),
    flags: {
      ...defaultBrowserPreferences.flags,
      ...parseJson<Partial<BrowserPreferences>>(
        savedSettings[`preferences:${windowId}`] ?? savedSettings.preferences,
        {},
      ).flags,
    },
  };
  preferences.flags.smoothScrolling = rawReadBrowserSetting(
    "smoothScrolling",
    preferences.flags.smoothScrolling,
  );
  const savedTabs = database
    .select()
    .from(tabTable)
    .where(
      and(eq(tabTable.profileId, PROFILE_ID), eq(tabTable.windowId, windowId)),
    )
    .orderBy(asc(tabTable.position))
    .all();
  const splitGroup = database
    .select()
    .from(tabGroupTable)
    .where(
      and(
        eq(tabGroupTable.profileId, PROFILE_ID),
        eq(tabGroupTable.windowId, windowId),
        eq(tabGroupTable.mode, "split"),
      ),
    )
    .get();
  const splitMembers = splitGroup
    ? database
        .select()
        .from(tabGroupMemberTable)
        .where(eq(tabGroupMemberTable.groupId, splitGroup.id))
        .orderBy(asc(tabGroupMemberTable.position))
        .all()
    : [];
  const snapshot: BrowserSnapshot = {
    activeTabId:
      savedTabs.find((tab) => tab.isActive)?.id ?? savedTabs[0]?.id ?? null,
    splitTabId: parseJson<string | null>(
      savedSettings[`splitTabId:${windowId}`] ??
        (windowId === WINDOW_ID ? savedSettings.splitTabId : undefined),
      splitMembers[1]?.tabId ?? null,
    ),
    groups: rawLoadTabGroups(windowId),
    tabs: savedTabs.map((tab) => ({
      ...parseJson<
        Pick<PersistedTab, "isSleeping" | "lastActiveAt" | "navigation">
      >(tab.lifecycle, {}),
      id: tab.id,
      title: tab.title,
      url: tab.url,
      faviconUrl: tab.faviconUrl,
      isMuted: tab.isMuted,
      isPinned: tab.isPinned,
      internalPage: tab.internalPage
        ? parseInternalPage(`gorth://${tab.internalPage}`)
        : null,
    })),
    bookmarks: database
      .select()
      .from(bookmarkTable)
      .where(eq(bookmarkTable.profileId, PROFILE_ID))
      .orderBy(asc(bookmarkTable.position))
      .all()
      .map(({ id, title, url }) => ({ id, title, url })),
    history: database
      .select()
      .from(history)
      .where(eq(history.profileId, PROFILE_ID))
      .orderBy(desc(history.visitedAt))
      .limit(2000)
      .all()
      .map(({ id, tabId, title, url, visitedAt }) => ({
        id,
        tabId,
        title,
        url,
        visitedAt,
      })),
    preferences,
  };
  sharedBaselines.set(
    windowId,
    structuredClone({
      bookmarks: snapshot.bookmarks,
      history: snapshot.history,
    }),
  );
  return snapshot;
}

export function rawSaveBrowserSnapshot(snapshot: BrowserSnapshot, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  sqlite.transaction(() => {
    database
      .delete(tabTable)
      .where(
        and(
          eq(tabTable.profileId, PROFILE_ID),
          eq(tabTable.windowId, windowId),
        ),
      )
      .run();
    // Apply only this window's changes to shared data. A stale window snapshot
    // must never delete or overwrite another window's newly added entries.
    const baseline = sharedBaselines.get(windowId) ?? {
      bookmarks: [],
      history: [],
    };
    for (const row of baseline.bookmarks) {
      if (!snapshot.bookmarks.some((item) => item.id === row.id))
        database
          .delete(bookmarkTable)
          .where(eq(bookmarkTable.id, row.id))
          .run();
    }
    for (const row of baseline.history) {
      if (!snapshot.history.some((item) => item.id === row.id))
        database.delete(history).where(eq(history.id, row.id)).run();
    }
    database
      .insert(settingTable)
      .values({
        profileId: PROFILE_ID,
        key: `preferences:${windowId}`,
        value: JSON.stringify(snapshot.preferences),
      })
      .onConflictDoUpdate({
        target: [settingTable.profileId, settingTable.key],
        set: { value: JSON.stringify(snapshot.preferences) },
      })
      .run();
    database
      .insert(settingTable)
      .values({
        profileId: PROFILE_ID,
        key: `splitTabId:${windowId}`,
        value: JSON.stringify(snapshot.splitTabId),
      })
      .onConflictDoUpdate({
        target: [settingTable.profileId, settingTable.key],
        set: { value: JSON.stringify(snapshot.splitTabId) },
      })
      .run();
    const openTabs = snapshot.tabs.filter(
      (tab) =>
        !database
          .select({ id: archivedTabTable.id })
          .from(archivedTabTable)
          .where(eq(archivedTabTable.id, tab.id))
          .get(),
    );
    if (openTabs.length)
      database
        .insert(tabTable)
        .values(
          openTabs.map((tab, position) => ({
            ...tab,
            windowId,
            lifecycle: JSON.stringify({
              isSleeping: tab.isSleeping,
              lastActiveAt: tab.lastActiveAt,
              navigation: tab.navigation,
            }),
            profileId: PROFILE_ID,
            position,
            internalPage: tab.internalPage,
            isActive: tab.id === snapshot.activeTabId,
          })),
        )
        .run();
    snapshot.bookmarks.forEach((item, position) => {
      if (
        JSON.stringify(baseline.bookmarks.find((row) => row.id === item.id)) ===
        JSON.stringify(item)
      )
        return;
      database
        .insert(bookmarkTable)
        .values({ ...item, profileId: PROFILE_ID, position })
        .onConflictDoUpdate({
          target: bookmarkTable.id,
          set: { ...item, position },
        })
        .run();
    });
    snapshot.history.slice(0, 2000).forEach((item) => {
      if (
        JSON.stringify(baseline.history.find((row) => row.id === item.id)) ===
        JSON.stringify(item)
      )
        return;
      database
        .insert(history)
        .values({ ...item, profileId: PROFILE_ID })
        .onConflictDoUpdate({ target: history.id, set: item })
        .run();
    });
  })();
  sharedBaselines.set(
    windowId,
    structuredClone({
      bookmarks: snapshot.bookmarks,
      history: snapshot.history,
    }),
  );
}
