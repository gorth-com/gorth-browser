import { app, BrowserWindow } from "electron";
import { hostname } from "node:os";
import { authClient } from "@/lib/auth/client/index";
import {
  gorthSnapshot,
  getGorthUserId,
  restoreGorthSession,
} from "@/lib/auth/gorth";
import { authUrl } from "@/utils/environment";
import { desktopFetch } from "@/lib/http/transport";
import { rawLoadBrowserSnapshot, rawSaveBrowserSnapshot } from "@/models/tab"
import { rawReadBrowserSetting, rawWriteBrowserSetting } from "@/models/setting"
import { getBrowserState, getWindowFromSender } from "@/main/windows/capital";
import {
  syncJournalSchema,
  syncOptionsSchema,
  syncResponseSchema,
  observeSyncData,
  mergeRecords,
  projectSyncData,
  type SyncJournal,
  type SyncOptions,
} from "@/lib/browser/sync";
import { browserSnapshotSchema } from "@/lib/browser/session-schema";
import { parseInternalPage } from "@/lib/browser/internal-pages";
import type { BrowserSnapshot } from "@/lib/browser/persistence";
import { requestConfirmation } from "@/main/services/confirmation";
import { restoreTabSession } from "@/main/services/tab-lifecycle";
import { destroyWebview } from "@/main/windows/webview";

let busy = false;
let lastSync: string | null = null;
let lastError: string | null = null;
const settingKey = (account: string) => `cloud-sync:v1:${account}`;
function journal(account: string): SyncJournal {
  return syncJournalSchema.parse(
    rawReadBrowserSetting(settingKey(account), {
      options: { enabled: false, kinds: ["bookmarks"] },
      records: [],
      baselines: {},
    }),
  );
}
function persist(account: string, value: SyncJournal) {
  if (
    JSON.stringify(rawReadBrowserSetting(settingKey(account), null)) !==
    JSON.stringify(value)
  )
    rawWriteBrowserSetting(settingKey(account), value);
}
export function captureSyncSnapshot(
  snapshot: BrowserSnapshot,
  windowId: string,
) {
  const account = getGorthUserId();
  if (!account) return;
  const state = journal(account);
  if (!state.options.enabled) return;
  persist(
    account,
    observeSyncData(state, windowId, {
      ...snapshot,
      workspaces: rawReadBrowserSetting(`sync-workspaces:${windowId}`, []),
    }),
  );
}
async function request(
  account: string,
  pathname: string,
  method = "GET",
  body?: unknown,
) {
  if (getGorthUserId() !== account)
    throw new Error("Sign in again before syncing.");
  const target = new URL(pathname, authUrl);
  if (
    target.origin !== new URL(authUrl).origin ||
    !target.pathname.startsWith("/sync")
  )
    throw new Error("Invalid sync endpoint.");
  const response = await desktopFetch(target, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Cookie: authClient.getCookie(),
      Origin: target.origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (getGorthUserId() !== account)
    throw new Error("Account changed. Sync was cancelled.");
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sign in again before syncing."
        : `Cloud sync failed (${response.status}). Your local data is retained.`,
    );
  const text = await response.text();
  if (getGorthUserId() !== account)
    throw new Error("Account changed. Sync was cancelled.");
  if (Buffer.byteLength(text) > 3 * 1024 * 1024)
    throw new Error("Sync response is too large.");
  return text ? JSON.parse(text) : null;
}
function apply(window: BrowserWindow, state: SyncJournal) {
  const windowId = getBrowserState(window).sessionId;
  const local = rawLoadBrowserSnapshot(windowId);
  const document: Record<string, unknown> = { ...local };
  for (const kind of state.options.kinds) {
    const rows = state.records
      .filter((record) => record.kind === kind && record.value !== null)
      .map((record) => record.value);
    document[kind] =
      kind === "preferences"
        ? { ...local.preferences, ...((rows[0] as object) ?? {}) }
        : rows;
  }
  if (state.options.kinds.includes("tabs")) {
    const incomingTabs = document.tabs as BrowserSnapshot["tabs"];
    document.tabs = [
      ...incomingTabs,
      ...local.tabs.filter(
        (tab) =>
          tab.internalPage === "auth" &&
          !incomingTabs.some((item) => item.id === tab.id),
      ),
    ];
  }
  const previousTabs = new Map(local.tabs.map((tab) => [tab.id, tab]));
  const tabs = state.options.kinds.includes("tabs")
    ? (document.tabs as BrowserSnapshot["tabs"]).map((tab) => ({
        ...tab,
        navigation:
          previousTabs.get(tab.id)?.url === tab.url
            ? previousTabs.get(tab.id)?.navigation
            : undefined,
        internalPage: tab.internalPage
          ? parseInternalPage(`gorth://${tab.internalPage}`)
          : null,
        isSleeping: previousTabs.get(tab.id)?.isSleeping ?? true,
      }))
    : local.tabs;
  const ids = new Set(tabs.map((tab) => tab.id));
  document.tabs = tabs;
  document.groups = (document.groups as BrowserSnapshot["groups"])
    .map((group) => ({
      ...group,
      tabIds: group.tabIds.filter((id) => ids.has(id)),
    }))
    .filter(
      (group) =>
        group.tabIds.length &&
        (group.mode === "normal" || group.tabIds.length === 2),
    );
  document.activeTabId = ids.has(local.activeTabId ?? "")
    ? local.activeTabId
    : (tabs[0]?.id ?? null);
  document.splitTabId = ids.has(local.splitTabId ?? "")
    ? local.splitTabId
    : null;
  const snapshot = browserSnapshotSchema.parse(document);
  if (state.options.kinds.includes("workspaces"))
    rawWriteBrowserSetting(`sync-workspaces:${windowId}`, document.workspaces);
  const next = observeSyncData(state, windowId, {
    ...snapshot,
    workspaces:
      document.workspaces ??
      rawReadBrowserSetting(`sync-workspaces:${windowId}`, []),
  });
  // Applying received data updates the baseline, not the version of the remote records.
  const account = getGorthUserId();
  if (account) persist(account, { ...state, baselines: next.baselines });
  if (
    JSON.stringify(snapshot) ===
    JSON.stringify(browserSnapshotSchema.parse(local))
  )
    return;
  if (state.options.kinds.includes("tabs")) {
    const runtime = getBrowserState(window);
    for (const tab of local.tabs) {
      if (
        !ids.has(tab.id) ||
        tabs.find((next) => next.id === tab.id)?.url !== tab.url
      ) {
        const view = runtime.views.get(tab.id);
        if (view) destroyWebview(window, view);
        runtime.views.delete(tab.id);
        runtime.tabMetadata.delete(tab.id);
        runtime.internalPages.delete(tab.id);
      }
    }
    restoreTabSession(window, snapshot);
  }
  rawSaveBrowserSnapshot(snapshot, windowId);
  window.webContents.send("sync:applied", snapshot);
}
export function syncStatus() {
  const account = getGorthUserId();
  return {
    authenticated: !!account,
    busy,
    lastSync,
    error: lastError,
    options: account
      ? journal(account).options
      : ({ enabled: false, kinds: ["bookmarks"] } as SyncOptions),
  };
}
export function configureSync(window: BrowserWindow, value: unknown) {
  if (busy) throw new Error("Wait for the current sync to finish.");
  const account = getGorthUserId();
  if (!account) throw new Error("Sign in before enabling sync.");
  const options = syncOptionsSchema.parse(value);
  const old = journal(account);
  // Group/workspace references require synced tabs, and workspaces require groups.
  if (
    (options.kinds.includes("groups") ||
      options.kinds.includes("workspaces")) &&
    !options.kinds.includes("tabs")
  )
    throw new Error("Enable tabs before syncing groups or workspaces.");
  if (options.kinds.includes("workspaces") && !options.kinds.includes("groups"))
    throw new Error("Enable groups before syncing workspaces.");
  const state = { ...old, options };
  persist(account, state);
  if (options.enabled)
    captureSyncSnapshot(
      rawLoadBrowserSnapshot(getBrowserState(window).sessionId),
      getBrowserState(window).sessionId,
    );
  return syncStatus();
}
export async function runSync(window: BrowserWindow) {
  if (busy) return syncStatus();
  busy = true;
  try {
    const savedUser = gorthSnapshot().user;
    if (!savedUser || !journal(savedUser.id).options.enabled)
      return syncStatus();
    if (!getGorthUserId() && gorthSnapshot().user && !gorthSnapshot().locked)
      await restoreGorthSession();
    const account = getGorthUserId();
    if (!account || !journal(account).options.enabled) return syncStatus();
    const windowId = getBrowserState(window).sessionId;
    const snapshot = rawLoadBrowserSnapshot(windowId);
    const state = observeSyncData(journal(account), windowId, {
      ...snapshot,
      workspaces: rawReadBrowserSetting(`sync-workspaces:${windowId}`, []),
    });
    persist(account, state);
    const response = syncResponseSchema.parse(
      await request(account, "/sync/state", "POST", {
        records: state.records.filter((record) =>
          state.options.kinds.includes(record.kind),
        ),
      }),
    );
    if (window.isDestroyed() || getGorthUserId() !== account)
      return syncStatus();
    // Preserve edits made while the request was in flight.
    const latest = journal(account);
    const merged = {
      ...latest,
      records: mergeRecords(latest.records, response.records),
    };
    persist(account, merged);
    apply(window, merged);
    lastSync = new Date().toISOString();
    lastError = null;
  } catch (error) {
    lastError =
      error instanceof Error
        ? error.message
        : "Cloud sync failed. Local data is retained.";
    throw new Error(lastError);
  } finally {
    busy = false;
  }
  return syncStatus();
}
export async function syncBackups(
  window: BrowserWindow,
  action: "list" | "save" | "restore" | "delete",
  id?: string,
) {
  if (busy) throw new Error("Wait for the current sync to finish.");
  if (
    (action === "restore" || action === "delete") &&
    !(await requestConfirmation(window, {
      title:
        action === "restore" ? "Restore cloud backup?" : "Delete cloud backup?",
      description:
        action === "restore"
          ? "Merge selected categories into this device after creating a safety backup."
          : "Permanently delete this cloud backup.",
      destructive: action === "delete",
    }))
  )
    return null;
  if (busy) throw new Error("Wait for the current sync to finish.");
  busy = true;
  try {
    if (!getGorthUserId() && gorthSnapshot().user && !gorthSnapshot().locked)
      await restoreGorthSession();
    const account = getGorthUserId();
    if (!account) throw new Error("Sign in before using cloud backups.");
    const windowId = getBrowserState(window).sessionId;
    if (action === "list") return request(account, "/sync");
    if (action === "delete")
      return request(account, `/sync?id=${encodeURIComponent(id!)}`, "DELETE");
    const data = projectSyncData(
      rawLoadBrowserSnapshot(windowId) as unknown as Record<string, unknown>,
    );
    const tabIds = new Set(data.tabs.map((tab) => tab.id));
    const groups = data.groups
      .map((group) => ({
        ...group,
        mode: group.mode,
        tabIds: (group.tabIds as string[]).filter((id) => tabIds.has(id)),
      }))
      .filter(
        (group) =>
          group.tabIds.length > 0 &&
          (group.mode === "normal" || group.tabIds.length === 2),
      );
    const save = () =>
      request(account, "/sync", "POST", {
        version: 1,
        name: `Browser backup ${new Date().toISOString()}`,
        deviceName: hostname().slice(0, 80),
        data: {
          tabs: data.tabs,
          bookmarks: data.bookmarks,
          groups,
          workspaces: rawReadBrowserSetting(`sync-workspaces:${windowId}`, []),
          preferences: data.preferences[0],
        },
      });
    if (action === "save") return save();
    const backup = await request(
      account,
      `/sync/file?id=${encodeURIComponent(id!)}`,
    );
    if (backup.version !== 1 || !backup.data)
      throw new Error("Unsupported backup format.");
    await save(); // A failed safety backup must prevent restore.
    if (getGorthUserId() !== account) throw new Error("Account changed.");
    const state = observeSyncData(journal(account), windowId, {
        ...rawLoadBrowserSnapshot(windowId),
        workspaces: rawReadBrowserSetting(`sync-workspaces:${windowId}`, []),
      }),
      projected = projectSyncData(backup.data);
    // A manual restore is an explicit new edit; merge by item rather than deleting unrelated items.
    const changes = state.options.kinds.flatMap((kind) =>
      projected[kind].map((value) => ({
        kind,
        id:
          kind === "preferences" ? "appearance" : (value as { id: string }).id,
        value,
        changedAt: Date.now(),
        operationId: crypto.randomUUID(),
      })),
    );
    const merged = { ...state, records: mergeRecords(state.records, changes) };
    persist(account, merged);
    apply(window, merged);
    return syncStatus();
  } finally {
    busy = false;
  }
}
export function startSyncScheduler() {
  const timer = setInterval(() => {
    const window = BrowserWindow.getAllWindows().find(
      (value) =>
        !value.isDestroyed() &&
        getWindowFromSender(value.webContents) === value,
    );
    if (window && gorthSnapshot().user)
      void runSync(window).catch(() => {
        /* Error is exposed in sync status; retry on the next interval. */
      });
  }, 30_000);
  timer.unref();
  app.once("before-quit", () => clearInterval(timer));
}
