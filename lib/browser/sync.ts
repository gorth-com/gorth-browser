import { z } from "@gorth-com/structure/cores/zod";

export const syncKinds = [
  "bookmarks",
  "tabs",
  "groups",
  "workspaces",
  "preferences",
] as const;
export const syncOptionsSchema = z.object({
  enabled: z.boolean(),
  kinds: z
    .array(z.enum(syncKinds))
    .max(5)
    .refine((items) => new Set(items).size === items.length),
});
export type SyncOptions = z.infer<typeof syncOptionsSchema>;
const safeUrl = z
  .string()
  .max(32768)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "http:", "gorth:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !["auth", "account"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  });
const key = z.string().min(1).max(128);
const tab = z.object({
  id: key,
  title: z.string().max(8192),
  url: safeUrl,
  faviconUrl: z.string().max(32768).default(""),
  isMuted: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  internalPage: z.string().nullable().default(null),
  isSleeping: z.boolean().default(true),
});
const values = {
  bookmarks: z.object({ id: key, title: z.string().max(8192), url: safeUrl }),
  tabs: tab,
  groups: z.object({
    id: key,
    name: z.string().min(1).max(80),
    mode: z.enum(["normal", "split", "glance"]),
    tabIds: z.array(key).min(1).max(500),
  }),
  workspaces: z.object({
    id: key,
    name: z.string().min(1).max(80),
    tabIds: z.array(key).max(500),
    groupIds: z.array(key).max(500).default([]),
    activeTabId: key.nullable().default(null),
  }),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    tabLayout: z.enum(["separate", "compact"]).optional(),
    verticalTabs: z.boolean().optional(),
    sidebarSide: z.enum(["left", "right"]).optional(),
    enableWorkspace: z.boolean().optional(),
  }),
};
export const syncRecordSchema = z
  .object({
    kind: z.enum(syncKinds),
    id: key,
    changedAt: z.number().int().nonnegative(),
    operationId: z.uuid(),
    value: z.unknown().transform((value) => value ?? null),
  })
  .transform((record) => {
    if (record.value === null) return record;
    const value = values[record.kind].parse(record.value);
    if (
      record.kind !== "preferences" &&
      "id" in value &&
      value.id !== record.id
    )
      throw new Error("Invalid sync ID");
    return { ...record, value };
  });
export type SyncRecord = z.infer<typeof syncRecordSchema>;
export const syncResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
  records: z.array(syncRecordSchema).max(20000),
});
export const syncJournalSchema = z.object({
  options: syncOptionsSchema,
  records: z.array(syncRecordSchema).max(20000),
  baselines: z.record(z.string(), z.record(z.string(), z.string())),
});
export type SyncJournal = z.infer<typeof syncJournalSchema>;
export function mergeRecords(current: SyncRecord[], incoming: SyncRecord[]) {
  const map = new Map(
    current.map((record) => [`${record.kind}:${record.id}`, record]),
  );
  for (const record of incoming) {
    const k = `${record.kind}:${record.id}`,
      old = map.get(k);
    if (
      !old ||
      record.changedAt > old.changedAt ||
      (record.changedAt === old.changedAt &&
        record.operationId > old.operationId)
    )
      map.set(k, record);
  }
  return [...map.values()];
}
export function projectSyncData(snapshot: Record<string, unknown>) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const kind of syncKinds) {
    const rows =
      kind === "preferences" ? [snapshot.preferences] : (snapshot[kind] ?? []);
    data[kind] = (Array.isArray(rows) ? rows : []).flatMap((value) => {
      const parsed = values[kind].safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
  }
  return data;
}
// Compare only items observed in this window; another window's absence is not a deletion.
export function observeSyncData(
  journal: SyncJournal,
  windowId: string,
  snapshot: Record<string, unknown>,
  now = Date.now(),
) {
  const next: Record<string, string> = {},
    changes: SyncRecord[] = [];
  const data = projectSyncData(snapshot);
  const before = journal.baselines[windowId] ?? {};
  for (const kind of journal.options.kinds)
    for (const value of data[kind]) {
      const id =
        kind === "preferences" ? "appearance" : (value as { id: string }).id;
      const k = `${kind}:${id}`,
        serialized = JSON.stringify(value);
      next[k] = serialized;
      if (before[k] !== serialized)
        changes.push({
          kind,
          id,
          value,
          changedAt: now,
          operationId: crypto.randomUUID(),
        });
    }
  for (const k of Object.keys(before))
    if (!(k in next)) {
      const [kind, ...rest] = k.split(":");
      if (journal.options.kinds.includes(kind as SyncRecord["kind"]))
        changes.push({
          kind: kind as SyncRecord["kind"],
          id: rest.join(":"),
          value: null,
          changedAt: now,
          operationId: crypto.randomUUID(),
        });
    }
  return {
    ...journal,
    records: mergeRecords(journal.records, changes),
    baselines: { ...journal.baselines, [windowId]: next },
  };
}
