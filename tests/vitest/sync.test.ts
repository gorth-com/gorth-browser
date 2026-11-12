import { expect, it } from "vitest";
import { observeSyncData, mergeRecords, projectSyncData, type SyncJournal } from "@/lib/browser/sync";
const initial = (): SyncJournal => ({ options: { enabled: true, kinds: ["bookmarks"] }, records: [], baselines: {} });
const snapshot = { bookmarks: [{ id: "a", title: "A", url: "https://example.com" }] };
it("records deletions durably and prevents resurrection from old devices", () => {
  const first = observeSyncData(initial(), "window", snapshot, 1);
  const deleted = observeSyncData(first, "window", { bookmarks: [] }, 2);
  expect(mergeRecords(deleted.records, first.records)[0].value).toBeNull();
});
it("does not interpret another window's absence as deletion", () => {
  const first = observeSyncData(initial(), "one", snapshot, 1);
  expect(observeSyncData(first, "two", { bookmarks: [] }, 2).records).toEqual(first.records);
});
it("never sends browsing history, navigation entries or credentials", () => {
  const data = projectSyncData({ history: ["secret"], tabs: [{ id: "auth", title: "Login", url: "https://user:secret@example.com", navigation: { entries: ["secret"] } }], bookmarks: snapshot.bookmarks });
  expect(data.tabs).toEqual([]);
  expect(data).not.toHaveProperty("history");
});
