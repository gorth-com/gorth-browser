import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IpcMainEvent, WebContents } from "electron";
const f = vi.hoisted(() => ({
  on: vi.fn(),
  send: vi.fn(),
  external: vi.fn(async (_url: string) => {}),
  origin: "https://launcher.example.test/auth/desktop/complete",
  window: undefined as unknown,
  callback: vi.fn(async (_url: string) => true),
}));
vi.mock("electron", () => ({
  app: { isReady: () => true, emit: vi.fn() },
  ipcMain: { on: f.on },
  shell: { openExternal: f.external },
  BrowserWindow: { fromWebContents: () => f.window },
}));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => "https://internal.example.test",
  isRpcRendererUrl: (url: string) => url === "https://internal.example.test",
}));
function link(client = "gorth-launcher") {
  const url = new URL("com.gorth.browser://auth/open");
  url.searchParams.set("url", "https://launcher.example.test/auth/desktop");
  url.searchParams.set("client_id", client);
  url.searchParams.set("state", "a".repeat(16));
  url.searchParams.set("code_challenge", "b".repeat(43));
  return url.href;
}
function contents() {
  return { getURL: () => f.origin } as WebContents;
}
function ready(trusted = true) {
  const frame = {
    url: trusted ? "https://internal.example.test" : "https://evil.test",
  };
  const sender = { mainFrame: frame, isDestroyed: () => false, send: f.send };
  f.window = {
    webContents: sender,
    isDestroyed: () => false,
    isMinimized: () => false,
    show() {},
    focus() {},
    restore() {},
  };
  const handler = f.on.mock.calls.find(
    ([name]) => name === "auth:navigation-ready",
  )![1] as (event: IpcMainEvent) => void;
  handler({ sender, senderFrame: frame } as unknown as IpcMainEvent);
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  f.origin = "https://launcher.example.test/auth/desktop/complete";
});
afterEach(() => vi.useRealTimers());
it("queues login until a trusted renderer is hydrated and forwards only public navigation metadata", async () => {
  const m = await import("@/main/services/login-navigation");
  m.registerLoginNavigation(f.callback);
  expect(m.receiveLoginNavigation(link())).toBe(true);
  expect(f.send).not.toHaveBeenCalled();
  ready(false);
  expect(f.send).not.toHaveBeenCalled();
  ready();
  expect(f.send).toHaveBeenCalledOnce();
  expect(f.send.mock.calls[0][0]).toBe("auth:navigation-requested");
  expect(new URL(f.send.mock.calls[0][1]).searchParams.get("state")).toBe(
    "a".repeat(16),
  );
});
it("returns Launcher callbacks to its OS handler, not to Browser's SDK session", async () => {
  const m = await import("@/main/services/login-navigation");
  m.registerLoginNavigation(f.callback);
  m.receiveLoginNavigation(link());
  expect(
    m.routeLoginCallback(
      contents(),
      "com.gorth.launcher://auth/callback#token=fixture",
    ),
  ).toBe(true);
  expect(f.external).toHaveBeenCalledExactlyOnceWith(
    "com.gorth.launcher://auth/callback#token=fixture",
  );
  expect(f.callback).not.toHaveBeenCalled();
});
it("delivers Browser callbacks to its existing SDK pending attempt", async () => {
  const m = await import("@/main/services/login-navigation");
  m.registerLoginNavigation(f.callback);
  m.receiveLoginNavigation(link("gorth-browser"));
  m.routeLoginCallback(
    contents(),
    "com.gorth.browser://auth/callback#token=fixture",
  );
  expect(f.callback).toHaveBeenCalledExactlyOnceWith(
    "com.gorth.browser://auth/callback#token=fixture",
  );
  expect(f.external).not.toHaveBeenCalled();
});
it("blocks foreign origins, wrong app callbacks and expired requests without opening native URLs", async () => {
  const m = await import("@/main/services/login-navigation");
  m.registerLoginNavigation(f.callback);
  m.receiveLoginNavigation(link());
  f.origin = "https://evil.test";
  expect(
    m.routeLoginCallback(
      contents(),
      "com.gorth.launcher://auth/callback#token=fixture",
    ),
  ).toBe(true);
  f.origin = "https://launcher.example.test";
  m.routeLoginCallback(
    contents(),
    "com.gorth.browser://auth/callback#token=fixture",
  );
  m.routeLoginCallback(
    contents(),
    "com.gorth.launcher://different/path#token=fixture",
  );
  m.routeLoginCallback(
    contents(),
    "com.gorth.launcher://auth/callback#token=fixture",
    "https://evil.test/iframe",
  );
  m.routeLoginCallback(
    contents(),
    "com.gorth.launcher://auth/callback#token=fixture",
    "",
  );
  await vi.advanceTimersByTimeAsync(120_001);
  m.routeLoginCallback(
    contents(),
    "com.gorth.launcher://auth/callback#token=fixture",
  );
  ready();
  expect(f.send).not.toHaveBeenCalled();
  expect(f.external).not.toHaveBeenCalled();
  expect(f.callback).not.toHaveBeenCalled();
});
