import { and, eq } from "drizzle-orm"
import { settingTable } from "@/database/schema"
import { type DownloadPreferences } from "@/lib/browser/downloads"
import { PROFILE_ID, getDatabase, parseJson } from "@/services/database"

export function rawReadShortcutOverrides(): Record<string, string> {
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

export function rawWriteShortcutOverrides(value: Record<string, string>) {
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

export function rawReadBrowserSetting<Value>(key: string, fallback: Value): Value {
  const row = getDatabase()
    .database.select()
    .from(settingTable)
    .where(
      and(eq(settingTable.profileId, PROFILE_ID), eq(settingTable.key, key)),
    )
    .get();
  return parseJson<Value>(row?.value, fallback);
}

export function rawWriteBrowserSetting(key: string, value: unknown) {
  getDatabase()
    .database.insert(settingTable)
    .values({ profileId: PROFILE_ID, key, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: [settingTable.profileId, settingTable.key],
      set: { value: JSON.stringify(value) },
    })
    .run();
}

export function rawLoadDownloadPreferences(directory: string): DownloadPreferences {
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

export function rawSaveDownloadPreferences(value: DownloadPreferences) {
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
