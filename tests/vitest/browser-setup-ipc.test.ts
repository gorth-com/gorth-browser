import { beforeEach, expect, it, vi } from "vitest";
import { registerSetupIpc } from "@/main/ipc/setup";
const fixture = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const sender = {
    mainFrame: {},
    getURL: () => "http://localhost:5501/public/index.html",
    send: vi.fn(),
  };
  return {
    handlers,
    sender,
    load: vi.fn(),
    save: vi.fn(),
    import: vi.fn(() => []),
    ready: vi.fn(),
    defaultBrowser: vi.fn(),
    dock: vi.fn(),
  };
});
vi.mock("electron", () => ({
  ipcMain: {
    handle: (key: string, handler: (...args: unknown[]) => unknown) =>
      fixture.handlers.set(key, handler),
  },
}));
vi.mock("@/main/windows/capital", () => ({
  getWindowFromSender: (sender: unknown) =>
    sender === fixture.sender ? { webContents: fixture.sender } : null,
  getBrowserState: () => ({ sessionId: "main" }),
  getBrowserWindows: () => [],
}));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => "http://localhost:5501/public/index.html",
  isRpcRendererUrl: (actual: string, expected: string) => actual === expected,
}));
vi.mock("@/main/services/browser-links", () => ({
  markBrowserLinksReady: fixture.ready,
}));
vi.mock("@/main/services/browser-setup", () => ({
  isDefaultBrowser: () => false,
  getSetupPreferences: fixture.load,
  saveSetupPreferences: fixture.save,
  importBookmarks: fixture.import,
  openDefaultBrowserSettings: fixture.defaultBrowser,
  revealDockApplication: fixture.dock,
}));
beforeEach(() => {
  vi.clearAllMocks();
  registerSetupIpc();
});
it("rejects foreign senders and subframes for every setup operation", () => {
  for (const handler of fixture.handlers.values()) {
    expect(() => handler({ sender: {}, senderFrame: {} })).toThrow("Untrusted");
    expect(() => handler({ sender: fixture.sender, senderFrame: {} })).toThrow(
      "Untrusted",
    );
  }
  expect(fixture.save).not.toHaveBeenCalled();
  expect(fixture.defaultBrowser).not.toHaveBeenCalled();
});
it("dispatches only semantic operations from a trusted main frame", () => {
  const event = {
    sender: fixture.sender,
    senderFrame: fixture.sender.mainFrame,
  };
  fixture.handlers.get("setup:load")!(event);
  fixture.handlers.get("setup:default-browser")!(event);
  fixture.handlers.get("setup:import")!(event, []);
  expect(fixture.load).toHaveBeenCalledOnce();
  expect(fixture.defaultBrowser).toHaveBeenCalledOnce();
  expect(fixture.import).toHaveBeenCalledWith([], "main");
});
