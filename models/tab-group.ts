import { and, asc, eq } from "drizzle-orm"
import { tabGroupMemberTable, tabGroupTable, tabTable } from "@/database/schema"
import { type PersistedTabGroup } from "@/lib/browser/persistence"
import { PROFILE_ID, WINDOW_ID, getDatabase } from "@/services/database"

export function rawLoadTabGroups(windowId = WINDOW_ID): PersistedTabGroup[] {
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

export function rawSaveTabGroup(group: PersistedTabGroup, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  const owner = database
    .select({ windowId: tabGroupTable.windowId })
    .from(tabGroupTable)
    .where(eq(tabGroupTable.id, group.id))
    .get();
  if (owner && owner.windowId !== windowId)
    throw new Error("This group belongs to another window.");
  const existing = rawLoadTabGroups(windowId);
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
  return rawLoadTabGroups(windowId);
}

export function rawDeleteTabGroup(id: string, windowId = WINDOW_ID) {
  const { database, sqlite } = getDatabase();
  if (!rawLoadTabGroups(windowId).some((group) => group.id === id))
    return rawLoadTabGroups(windowId);
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
  return rawLoadTabGroups(windowId);
}

export function removeTabFromGroups(tabId: string, windowId = WINDOW_ID) {
  for (const group of rawLoadTabGroups(windowId).filter((item) =>
    item.tabIds.includes(tabId),
  )) {
    const tabIds = group.tabIds.filter((id) => id !== tabId);
    if (!tabIds.length || (group.mode !== "normal" && tabIds.length < 2))
      rawDeleteTabGroup(group.id, windowId);
    else rawSaveTabGroup({ ...group, tabIds }, windowId);
  }
}
