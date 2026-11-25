import { and, desc, eq } from "drizzle-orm"
import { downloadTable } from "@/database/schema"
import { type DownloadRecord } from "@/lib/browser/downloads"
import { PROFILE_ID, getDatabase } from "@/services/database"

export function rawLoadDownloads(): DownloadRecord[] {
  return getDatabase()
    .database.select()
    .from(downloadTable)
    .where(eq(downloadTable.profileId, PROFILE_ID))
    .orderBy(desc(downloadTable.startedAt))
    .all();
}

export function rawSaveDownload(record: DownloadRecord) {
  getDatabase()
    .database.insert(downloadTable)
    .values({ ...record, profileId: PROFILE_ID })
    .onConflictDoUpdate({ target: downloadTable.id, set: record })
    .run();
}

export function rawDeleteDownload(id: string) {
  getDatabase()
    .database.delete(downloadTable)
    .where(
      and(eq(downloadTable.id, id), eq(downloadTable.profileId, PROFILE_ID)),
    )
    .run();
}
