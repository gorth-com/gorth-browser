import { defaultBrowserPreferences } from "@/utils/constant";
import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";
import {
  initializeDatabase,
  closeDatabase,
  loadBrowserSnapshot,
  saveBrowserSnapshot,
  writeBrowserSetting,
  readBrowserSetting,
  saveTabGroup,
  loadTabGroups,
} from "@/services/browser-database";

const directory = process.argv.at(-1);
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-browser-database-")
)
  throw new Error("An isolated database fixture is required");
app.setPath("userData", directory);
app.setPath("sessionData", directory);
const timer = setTimeout(() => app.quit(), 15000);
void app.whenReady().then(() => {
  try {
    const legacy = new Database(path.join(directory, "gorth-browser.db"));
    legacy.exec(
      "CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at INTEGER NOT NULL); INSERT INTO profiles VALUES ('default','Retained',1); CREATE TABLE settings(profile_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile_id,key)); INSERT INTO settings VALUES ('default','fixture','\"retained\"')",
    );
    legacy.close();
    initializeDatabase(directory);
    const settings = readBrowserSetting("fixture", "missing");
    writeBrowserSetting("fixture", "updated");
    saveBrowserSnapshot({
      activeTabId: "existing",
      splitTabId: null,
      groups: [],
      history: [],
      tabs: [
        {
          id: "existing",
          title: "Saved tab",
          url: "https://example.test",
          faviconUrl: "",
          isMuted: false,
          isPinned: false,
          internalPage: null,
        },
      ],
      bookmarks: [
        {
          id: "bookmark",
          title: "Saved bookmark",
          url: "https://example.test",
        },
      ],
      preferences: defaultBrowserPreferences,
    });
    saveTabGroup({
      id: "group",
      name: "Saved group",
      mode: "normal",
      tabIds: ["existing"],
    });
    closeDatabase();
    initializeDatabase(directory);
    const restored = loadBrowserSnapshot();
    const report = {
      settings,
      updated: readBrowserSetting("fixture", "missing"),
      tab: restored.tabs[0]?.title,
      bookmark: restored.bookmarks[0]?.title,
      group: loadTabGroups()[0]?.name,
    };
    closeDatabase();
    const check = new Database(path.join(directory, "gorth-browser.db"), {
      readonly: true,
    });
    const tables = check
      .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name);
    const profile = check
      .prepare("SELECT name FROM profile WHERE id='default'")
      .get() as { name: string };
    check.close();
    console.log(
      "GORTH_DATABASE=" +
        JSON.stringify({ ...report, tables, profile: profile.name }),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    closeDatabase();
    clearTimeout(timer);
    app.quit();
  }
});
