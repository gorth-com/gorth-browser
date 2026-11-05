import { defaultBrowserPreferences } from "@/utils/constant";
import Database from "better-sqlite3";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { userProfileMigration } from "@/database/migrations/user-profile";
import { migrateSingularTables } from "@/database/migrations/singular-table";

import {
  bookmarkTable,
  history,
  profileTable,
  recentlyClosed,
  settingTable,
  tabGroupMemberTable,
  tabGroupTable,
  tabTable,
  windowTable,
  downloadTable,
  archivedTabTable,
} from "@/database/schema";

import {
  type BrowserPreferences,
  type BrowserSnapshot,
  type PersistedTab,
  type PersistedTabGroup,
  type PersistedWindowState,
} from "@/lib/browser/persistence";
import { parseInternalPage } from "@/lib/browser/internal-pages";
import type {
  DownloadRecord,
  DownloadPreferences,
} from "@/lib/browser/downloads";

const PROFILE_ID = "default";
const WINDOW_ID = "main";
const sharedBaselines = new Map<
  string,
  Pick<BrowserSnapshot, "bookmarks" | "history">
>();
export function readShortcutOverrides(): Record<string, string> {
  const row = getDatabase()
    .database.select()
    .from(settingTable)
    .where(
      and(
        eq(settingTable.profileId, PROFILE_ID),
        eq(settingTable.key, "shortcuts"),
      ),
    )
    .get();
  return parseJson<Record<string, string>>(row?.value, {});
}
export function writeShortcutOverrides(value: Record<string, string>) {
  getDatabase()
    .database.insert(settingTable)
    .values({
      profileId: PROFILE_ID,
      key: "shortcuts",
      value: JSON.stringify(value),
    })
    .onConflictDoUpdate({
      target: [settingTable.profileId, settingTable.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}
let sqlite: Database.Database | null = null;
let database: ReturnType<typeof drizzle> | null = null;

function initializeDatabase(userDataPath: string) {
  sqlite = new Database(path.join(userDataPath, "gorth-browser.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  try {
    migrateSingularTables(sqlite);
  } catch (error) {
    sqlite.close();
    sqlite = null;
    throw error;
  }
  sqlite.exec(userProfileMigration);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profile (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS setting (profile_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(profile_id, key));
    CREATE TABLE IF NOT EXISTS tab (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, position INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, favicon_url TEXT NOT NULL, is_muted INTEGER NOT NULL, is_pinned INTEGER NOT NULL, internal_page TEXT, is_active INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_group (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Tab group', profile_id TEXT NOT NULL, mode TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tab_group_member (group_id TEXT NOT NULL, tab_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(group_id, tab_id));
    CREATE TABLE IF NOT EXISTS bookmark (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, visited_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS history_visited_at_idx ON history(visited_at DESC);
    CREATE TABLE IF NOT EXISTS recently_closed (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, tab_json TEXT NOT NULL, closed_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS recently_closed_at_idx ON recently_closed(closed_at DESC);
    CREATE TABLE IF NOT EXISTS "window" (id TEXT PRIMARY KEY, x INTEGER, y INTEGER, width INTEGER NOT NULL, height INTEGER NOT NULL, is_maximized INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS download (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, filename TEXT NOT NULL, url TEXT NOT NULL, save_path TEXT NOT NULL, mime_type TEXT NOT NULL, received_bytes INTEGER NOT NULL, total_bytes INTEGER NOT NULL, state TEXT NOT NULL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS download_started_at_idx ON download(started_at DESC);
  `);
  const groupColumns = sqlite.prepare("PRAGMA table_info(tab_group)").all() as {
    name: string;
  }[];
  if (!groupColumns.some((column) => column.name === "name")) {
    sqlite.exec(
      "ALTER TABLE tab_group ADD COLUMN name TEXT NOT NULL DEFAULT 'Tab group'",
    );
  }
  for (const [table, column, definition] of [
    ["tab", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["tab", "lifecycle", "TEXT NOT NULL DEFAULT '{}'"],
    ["tab_group", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["recently_closed", "window_id", "TEXT NOT NULL DEFAULT 'main'"],
    ["window", "is_open", "INTEGER NOT NULL DEFAULT 1"],
  ]) {
    const columns = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
      name: string;
    }[];
    if (!columns.some((item) => item.name === column))
      sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition}`);
  }
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS archived_tab (id TEXT PRIMARY KEY, window_id TEXT NOT NULL, tab_json TEXT NOT NULL, archived_at INTEGER NOT NULL)",
  );
  database = drizzle({ client: sqlite });
  // DownloadItems cannot survive an application restart. Retain their history for retry.
  sqlite
    .prepare(
      "UPDATE download SET state = 'interrupted' WHERE state IN ('progressing', 'paused')",
    )
    .run();
  database
    .insert(profileTable)
    .values({ id: PROFILE_ID, name: "Default", createdAt: Date.now() })
    .onConflictDoNothing()
    .run();
}

function getDatabase() {
  if (!database || !sqlite)
    throw new Error("Browser database is not initialized.");
  return { database, sqlite };
}

export function getRestoredWindowIds() {
  const ids = getDatabase()
    .database.select({ id: windowTable.id })
    .from(windowTable)
    .where(eq(windowTable.isOpen, true))
    .all()
    .map((row) => row.id);
  return ids.length ? ids : [WINDOW_ID];
}

export function setWindowOpen(windowId: string, isOpen: boolean) {
  getDatabase()
    .database.update(windowTable)
    .set({ isOpen })
    .where(eq(windowTable.id, windowId))
    .run();
}

export function readBrowserSetting<Value>(key: string, fallback: Value): Value {
  const row = getDatabase()
    .database.select()
    .from(settingTable)
    .where(
      and(eq(settingTable.profileId, PROFILE_ID), eq(settingTable.key, key)),
    )
    .get();
  return parseJson<Value>(row?.value, fallback);
}

export function writeBrowserSetting(key: string, value: unknown) {
  getDatabase()
    .database.insert(settingTable)
    .values({ profileId: PROFILE_ID, key, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: [settingTable.profileId, settingTable.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}

export function listArchivedTabs() {
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

export function archiveTab(tab: PersistedTab, windowId: string) {
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

export function takeArchivedTab(id: string, removeOnly = false) {
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

export function restoreArchivedTab(id: string, windowId: string) {
  const { database, sqlite } = getDatabase();
  return sqlite.transaction(() => {
    const archived = takeArchivedTab(id);
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

function parseJson<Value>(value: string | undefined, fallback: Value): Value {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
}

function loadBrowserSnapshot(windowId = WINDOW_ID): BrowserSnapshot {
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
  preferences.flags.smoothScrolling = readBrowserSetting(
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
    groups: loadTabGroups(windowId),
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

function saveBrowserSnapshot(snapshot: BrowserSnapshot, windowId = WINDOW_ID) {
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

function loadTabGroups(windowId = WINDOW_ID): PersistedTabGroup[] {
  const { database } = getDatabase();
  return database
    .select()
    .from(tabGroupTable)
    .where(
      and(
        eq(tabGroupTable.profileId, PROFILE_ID),
        eq(tabGroupTable.windowId, windowId),
      ),
    )
    .orderBy(asc(tabGroupTable.position))
    .all()
    .map((group) => ({
      id: group.id,
      name: group.name,
      mode: group.mode as PersistedTabGroup["mode"],
      tabIds: database
        .select()
        .from(tabGroupMemberTable)
        .where(eq(tabGroupMemberTable.groupId, group.id))
        .orderBy(asc(tabGroupMemberTable.position))
        .all()
        .map((member) => member.tabId),
    }));
}

function saveTabGroup(group: PersistedTabGroup, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  const owner = database
    .select({ windowId: tabGroupTable.windowId })
    .from(tabGroupTable)
    .where(eq(tabGroupTable.id, group.id))
    .get();
  if (owner && owner.windowId !== windowId)
    throw new Error("This group belongs to another window.");
  const existing = loadTabGroups(windowId);
  const savedTabs = database
    .select()
    .from(tabTable)
    .where(
      and(eq(tabTable.profileId, PROFILE_ID), eq(tabTable.windowId, windowId)),
    )
    .all();
  if (group.tabIds.some((id) => !savedTabs.some((tab) => tab.id === id))) {
    throw new Error("One of the selected tabs is no longer open.");
  }
  if (
    group.mode !== "normal" &&
    group.tabIds.some(
      (id) => savedTabs.find((tab) => tab.id === id)?.internalPage !== null,
    )
  ) {
    throw new Error("Split and glance groups require website tabs.");
  }
  if (
    existing.some(
      (item) =>
        item.id !== group.id &&
        item.tabIds.some((id) => group.tabIds.includes(id)),
    )
  ) {
    throw new Error(
      "A tab can only belong to one group. Remove it from its current group first.",
    );
  }
  sqlite.transaction(() => {
    database
      .insert(tabGroupTable)
      .values({
        id: group.id,
        windowId,
        name: group.name,
        mode: group.mode,
        profileId: PROFILE_ID,
        position:
          existing.findIndex((item) => item.id === group.id) < 0
            ? existing.length
            : existing.findIndex((item) => item.id === group.id),
      })
      .onConflictDoUpdate({
        target: tabGroupTable.id,
        set: { name: group.name, mode: group.mode },
      })
      .run();
    database
      .delete(tabGroupMemberTable)
      .where(eq(tabGroupMemberTable.groupId, group.id))
      .run();
    database
      .insert(tabGroupMemberTable)
      .values(
        group.tabIds.map((tabId, position) => ({
          groupId: group.id,
          tabId,
          position,
        })),
      )
      .run();
  })();
  return loadTabGroups(windowId);
}

function deleteTabGroup(id: string, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  if (!loadTabGroups(windowId).some((group) => group.id === id))
    return loadTabGroups(windowId);
  sqlite.transaction(() => {
    database
      .delete(tabGroupMemberTable)
      .where(eq(tabGroupMemberTable.groupId, id))
      .run();
    database
      .delete(tabGroupTable)
      .where(
        and(eq(tabGroupTable.id, id), eq(tabGroupTable.profileId, PROFILE_ID)),
      )
      .run();
  })();
  return loadTabGroups(windowId);
}

function removeTabFromGroups(tabId: string, windowId = WINDOW_ID) {
  for (const group of loadTabGroups(windowId).filter((item) =>
    item.tabIds.includes(tabId),
  )) {
    const tabIds = group.tabIds.filter((id) => id !== tabId);
    if (!tabIds.length || (group.mode !== "normal" && tabIds.length < 2))
      deleteTabGroup(group.id, windowId);
    else saveTabGroup({ ...group, tabIds }, windowId);
  }
}

function addRecentlyClosedTab(tab: PersistedTab, windowId = WINDOW_ID) {
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

function popRecentlyClosedTab(windowId = WINDOW_ID) {
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

function loadWindowState(windowId = WINDOW_ID): PersistedWindowState | null {
  const { database } = getDatabase();
  const row = database
    .select()
    .from(windowTable)
    .where(eq(windowTable.id, windowId))
    .get();
  return row
    ? {
        height: row.height,
        isMaximized: row.isMaximized,
        width: row.width,
        x: row.x,
        y: row.y,
      }
    : null;
}

function saveWindowState(state: PersistedWindowState, windowId = WINDOW_ID) {
  const { database } = getDatabase();
  database
    .insert(windowTable)
    .values({ id: windowId, ...state })
    .onConflictDoUpdate({ target: windowTable.id, set: state })
    .run();
}

function closeDatabase() {
  sharedBaselines.clear();
  sqlite?.close();
  sqlite = null;
  database = null;
}

function loadDownloads(): DownloadRecord[] {
  return getDatabase()
    .database.select()
    .from(downloadTable)
    .where(eq(downloadTable.profileId, PROFILE_ID))
    .orderBy(desc(downloadTable.startedAt))
    .all();
}

function saveDownload(record: DownloadRecord) {
  getDatabase()
    .database.insert(downloadTable)
    .values({ ...record, profileId: PROFILE_ID })
    .onConflictDoUpdate({ target: downloadTable.id, set: record })
    .run();
}

function deleteDownload(id: string) {
  getDatabase()
    .database.delete(downloadTable)
    .where(
      and(eq(downloadTable.id, id), eq(downloadTable.profileId, PROFILE_ID)),
    )
    .run();
}

function loadDownloadPreferences(directory: string): DownloadPreferences {
  const row = getDatabase()
    .database.select()
    .from(settingTable)
    .where(
      and(
        eq(settingTable.profileId, PROFILE_ID),
        eq(settingTable.key, "downloads"),
      ),
    )
    .get();
  const saved = parseJson<Partial<DownloadPreferences>>(row?.value, {});
  return {
    directory:
      typeof saved.directory === "string" && saved.directory
        ? saved.directory
        : directory,
    askWhereToSave:
      typeof saved.askWhereToSave === "boolean" ? saved.askWhereToSave : true,
  };
}

function saveDownloadPreferences(value: DownloadPreferences) {
  getDatabase()
    .database.insert(settingTable)
    .values({
      profileId: PROFILE_ID,
      key: "downloads",
      value: JSON.stringify(value),
    })
    .onConflictDoUpdate({
      target: [settingTable.profileId, settingTable.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}

export {
  loadDownloads,
  saveDownload,
  deleteDownload,
  loadDownloadPreferences,
  saveDownloadPreferences,
  loadTabGroups,
  saveTabGroup,
  deleteTabGroup,
  addRecentlyClosedTab,
  closeDatabase,
  initializeDatabase,
  loadBrowserSnapshot,
  loadWindowState,
  popRecentlyClosedTab,
  saveBrowserSnapshot,
  saveWindowState,
};
