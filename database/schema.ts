import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { DownloadState } from "@/lib/browser/downloads";

const profileTable = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

const settingTable = sqliteTable(
  "setting",
  {
    profileId: text("profile_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.key] })],
);

const tabTable = sqliteTable("tab", {
  windowId: text("window_id").notNull().default("main"),
  lifecycle: text("lifecycle").notNull().default("{}"),
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  faviconUrl: text("favicon_url").notNull(),
  isMuted: integer("is_muted", { mode: "boolean" }).notNull(),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull(),
  internalPage: text("internal_page"),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
});

const tabGroupTable = sqliteTable("tab_group", {
  windowId: text("window_id").notNull().default("main"),
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Tab group"),
  profileId: text("profile_id").notNull(),
  mode: text("mode").notNull(),
  position: integer("position").notNull(),
});

const tabGroupMemberTable = sqliteTable(
  "tab_group_member",
  {
    groupId: text("group_id").notNull(),
    tabId: text("tab_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.tabId] })],
);

const bookmarkTable = sqliteTable("bookmark", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull(),
});

const history = sqliteTable(
  "history",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    tabId: text("tab_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    visitedAt: integer("visited_at").notNull(),
  },
  (table) => [index("history_visited_at_idx").on(sql`${table.visitedAt} DESC`)],
);

const recentlyClosed = sqliteTable(
  "recently_closed",
  {
    windowId: text("window_id").notNull().default("main"),
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    tabJson: text("tab_json").notNull(),
    closedAt: integer("closed_at").notNull(),
  },
  (table) => [index("recently_closed_at_idx").on(sql`${table.closedAt} DESC`)],
);

const windowTable = sqliteTable("window", {
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
  id: text("id").primaryKey(),
  x: integer("x"),
  y: integer("y"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  isMaximized: integer("is_maximized", { mode: "boolean" }).notNull(),
});

export const archivedTabTable = sqliteTable("archived_tab", {
  id: text("id").primaryKey(),
  windowId: text("window_id").notNull(),
  tabJson: text("tab_json").notNull(),
  archivedAt: integer("archived_at").notNull(),
});

const downloadTable = sqliteTable(
  "download",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    savePath: text("save_path").notNull(),
    mimeType: text("mime_type").notNull(),
    receivedBytes: integer("received_bytes").notNull(),
    totalBytes: integer("total_bytes").notNull(),
    state: text("state").$type<DownloadState>().notNull(),
    startedAt: integer("started_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("download_started_at_idx").on(table.startedAt)],
);

export {
  downloadTable,
  bookmarkTable,
  history,
  profileTable,
  recentlyClosed,
  settingTable,
  tabGroupMemberTable,
  tabGroupTable,
  tabTable,
  windowTable,
};

/** Public SSO identity cache, separate from browser profiles/game accounts. */
export const userProfileTable = sqliteTable("user_profile", {
  ssoUserId: text("sso_user_id").primaryKey().notNull(),
  name: text("name").notNull(),
  username: text("username"),
  email: text("email"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "boolean" }),
  createdAt: integer("created_at").notNull(),
  syncedAt: integer("synced_at").notNull(),
});
