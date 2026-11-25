import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "node:path"
import { userProfileMigration } from "@/database/migrations/user-profile"
import { migrateSingularTables } from "@/database/migrations/singular-table"
import { profileTable } from "@/database/schema"
import { type BrowserSnapshot } from "@/lib/browser/persistence"

export const PROFILE_ID = "default";

export const WINDOW_ID = "main";

export const sharedBaselines = new Map<
  string,
  Pick<BrowserSnapshot, "bookmarks" | "history">
>();

let sqlite: Database.Database | null = null;

let database: ReturnType<typeof drizzle> | null = null;

export function rawInitializeDatabase(userDataPath: string) {
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

export function getDatabase() {
  if (!database || !sqlite)
    throw new Error("Browser database is not initialized.");
  return { database, sqlite };
}

export function rawCloseDatabase() {
  sharedBaselines.clear();
  sqlite?.close();
  sqlite = null;
  database = null;
}

export function parseJson<Value>(value: string | undefined, fallback: Value): Value {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as Value;
  } catch {
    return fallback;
  }
}
