import { eq } from "drizzle-orm"
import { windowTable } from "@/database/schema"
import { type PersistedWindowState } from "@/lib/browser/persistence"
import { WINDOW_ID, getDatabase } from "@/services/database"

export function rawGetRestoredWindowIds() {
  const ids = getDatabase()
    .database.select({ id: windowTable.id })
    .from(windowTable)
    .where(eq(windowTable.isOpen, true))
    .all()
    .map((row) => row.id);
  return ids.length ? ids : [WINDOW_ID];
}

export function rawSetWindowOpen(windowId: string, isOpen: boolean) {
  getDatabase()
    .database.update(windowTable)
    .set({ isOpen })
    .where(eq(windowTable.id, windowId))
    .run();
}

export function rawLoadWindowState(windowId = WINDOW_ID): PersistedWindowState | null {
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

export function rawSaveWindowState(state: PersistedWindowState, windowId = WINDOW_ID) {
  const { database } = getDatabase();
  database
    .insert(windowTable)
    .values({ id: windowId, ...state })
    .onConflictDoUpdate({ target: windowTable.id, set: state })
    .run();
}
