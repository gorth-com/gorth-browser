import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ user: "user-a", records: new Map<string, unknown>(), fetch: vi.fn(), saved: vi.fn(), sent: vi.fn() }));
vi.mock("electron", () => ({ app: { once: vi.fn() }, BrowserWindow: { getAllWindows: () => [] } }));
vi.mock("@/utils/environment", () => ({ authUrl: "https://browser.example.test" }));
vi.mock("@/lib/http/transport", () => ({ desktopFetch: fixture.fetch }));
vi.mock("@/lib/auth/gorth", () => ({ getGorthUserId: () => fixture.user || null, gorthSnapshot: () => ({ user: fixture.user ? { id: fixture.user } : null, locked: false }), getGorthClient: () => ({ getCookie: () => "fixture-private-cookie" }), restoreGorthSession: vi.fn() }));
vi.mock("@/main/windows/capital", () => ({ getBrowserState: () => ({ sessionId: "window" }) }));
vi.mock("@/main/services/confirmation", () => ({ requestConfirmation: async () => true }));
vi.mock("@/main/services/tab-lifecycle", () => ({ restoreTabSession: (_window: unknown, snapshot: unknown) => snapshot }));
vi.mock("@/main/windows/webview", () => ({ destroyWebview: vi.fn() }));
vi.mock("@/services/browser-database", () => ({
  readBrowserSetting: (key: string, fallback: unknown) => fixture.records.get(key) ?? fallback,
  writeBrowserSetting: (key: string, value: unknown) => fixture.records.set(key, value),
  loadBrowserSnapshot: () => ({ activeTabId: null, splitTabId: null, tabs: [], groups: [], bookmarks: [{ id: "a", title: "A", url: "https://example.com" }], history: [], preferences: { flags: {}, sidebarSide: "left", showTitlebarLogo: true, theme: "system", verticalCollapsed: false, verticalTabs: false, sleepAfterMinutes: 30, archiveAfterDays: 0 } }),
  saveBrowserSnapshot: fixture.saved,
}));
import { configureSync, runSync, syncStatus } from "@/main/services/sync";
const window = { isDestroyed: () => false, webContents: { send: fixture.sent } } as unknown as Electron.BrowserWindow;
beforeEach(() => { fixture.records.clear(); fixture.user = "user-a"; vi.clearAllMocks(); });
it("does not contact cloud until this account explicitly enables sync", async () => {
  await runSync(window);
  expect(fixture.fetch).not.toHaveBeenCalled();
  expect(syncStatus().options.enabled).toBe(false);
});
it("retains pending data when offline and isolates preferences after account switch", async () => {
  configureSync(window, { enabled: true, kinds: ["bookmarks"] });
  fixture.fetch.mockRejectedValue(new Error("Offline"));
  await expect(runSync(window)).rejects.toThrow("Offline");
  expect((fixture.records.get("cloud-sync:v1:user-a") as { records: unknown[] }).records).toHaveLength(1);
  fixture.user = "user-b";
  expect(syncStatus().options.enabled).toBe(false);
  await runSync(window);
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});
it("fences logout while a cloud request is in flight", async () => {
  configureSync(window, { enabled: true, kinds: ["bookmarks"] });
  fixture.fetch.mockImplementation(async () => { fixture.user = ""; return Response.json({ revision: 1, records: [] }); });
  await expect(runSync(window)).rejects.toThrow("Account changed");
  expect(fixture.saved).not.toHaveBeenCalled();
  expect(fixture.sent).not.toHaveBeenCalled();
});
it("applies a newer bookmark and keeps native credentials in the main request only", async () => {
  configureSync(window, { enabled: true, kinds: ["bookmarks"] });
  fixture.fetch.mockResolvedValue(Response.json({ revision: 2, records: [{ kind: "bookmarks", id: "a", changedAt: Date.now() + 1000, operationId: "20000000-0000-4000-a000-000000000001", value: { id: "a", title: "Remote", url: "https://example.com" } }] }));
  await runSync(window);
  expect(fixture.saved).toHaveBeenCalledWith(expect.objectContaining({ bookmarks: [expect.objectContaining({ title: "Remote" })], history: [] }), "window");
  expect(fixture.sent).toHaveBeenCalledWith("sync:applied", expect.not.objectContaining({ cookie: expect.anything() }));
  expect(fixture.fetch.mock.calls[0][1].headers.Cookie).toBe("fixture-private-cookie");
});
