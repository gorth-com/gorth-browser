import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const window = {
    webContents: { send: vi.fn() },
    show: vi.fn(),
    focus: vi.fn(),
  };
  return { handlers, window, windows: [window], create: vi.fn() };
});
vi.mock("electron", () => ({
  app: {
    on: (name: string, listener: (...args: unknown[]) => unknown) =>
      fixture.handlers.set(name, listener),
    isReady: () => true,
  },
}));
vi.mock("@/main/windows/capital", () => ({
  createWindow: fixture.create,
  getBrowserWindows: () => fixture.windows,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fixture.windows = [fixture.window];
});
it("queues cold-start URLs until the renderer has restored its session", async () => {
  const links = await import("@/main/services/browser-links");
  links.installBrowserLinks();
  fixture.handlers.get("open-url")!(
    { preventDefault: vi.fn() },
    "https://example.com/path",
  );
  expect(fixture.window.webContents.send).not.toHaveBeenCalled();
  links.markBrowserLinksReady(fixture.window as never);
  expect(fixture.window.webContents.send).toHaveBeenCalledExactlyOnceWith(
    "tabs:open-requested",
    "https://example.com/path",
  );
  links.markBrowserLinksReady(fixture.window as never);
  expect(fixture.window.webContents.send).toHaveBeenCalledTimes(1);
});
it("rejects executable URLs and credential-bearing links while preserving auth deep links", async () => {
  const links = await import("@/main/services/browser-links");
  links.installBrowserLinks();
  links.markBrowserLinksReady(fixture.window as never);
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:password@example.com",
    "com.gorth.browser://auth/callback#token=fixture",
  ]) {
    fixture.handlers.get("open-url")!({ preventDefault: vi.fn() }, value);
    fixture.handlers.get("second-instance")!({}, ["electron", value]);
  }
  expect(fixture.window.webContents.send).not.toHaveBeenCalled();
});
