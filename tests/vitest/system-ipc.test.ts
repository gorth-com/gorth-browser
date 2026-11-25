import { EventEmitter } from "node:events";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { defaultSystemPreferences } from "@/lib/browser/system";
const fixture = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  storage: new Map<string, unknown>(),
  owner: null as unknown,
  app: null as unknown,
  confirm: vi.fn(async () => false),
  gpu: vi.fn(),
  quit: vi.fn(),
  external: vi.fn(),
}));
vi.mock("electron", () => ({
  app: {
    on: (name: string, fn: (...args: unknown[]) => void) =>
      (fixture.app as EventEmitter).on(name, fn),
    disableHardwareAcceleration: fixture.gpu,
    quit: fixture.quit,
  },
  BrowserWindow: {
    fromWebContents: (sender: unknown) => {
      const owner = fixture.owner as { webContents: unknown };
      return sender === owner.webContents ? owner : null;
    },
  },
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) =>
      fixture.handlers.set(name, fn),
  },
  shell: { openExternal: fixture.external },
  powerMonitor: {},
}));
vi.mock("@/models/setting", () => ({
  rawReadBrowserSetting: (key: string, fallback: unknown) =>
    fixture.storage.get(key) ?? fallback,
  rawWriteBrowserSetting: (key: string, value: unknown) =>
    fixture.storage.set(key, value),
}));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => "https://fixture.test/public/index.html",
  isRpcRendererUrl: (actual: string, expected: string) => actual === expected,
}));
vi.mock("@/main/services/confirmation", () => ({
  requestConfirmation: fixture.confirm,
}));
import {
  initializeSystemStartup,
  installSystemWindow,
  isSystemQuitting,
  registerSystemIpc,
} from "@/main/services/system";
import {
  getSystemPreferences,
  saveSystemPreferences,
} from "@/main/services/system-preferences";
let window: EventEmitter & {
  webContents: { mainFrame: { url: string }; send: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
  isDestroyed: () => boolean;
};
let count = 3;
function event() {
  return {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  };
}
function invoke(name: string, ...args: unknown[]) {
  return fixture.handlers.get(name)!(...args);
}
beforeEach(() => {
  fixture.storage.clear();
  fixture.handlers.clear();
  fixture.confirm.mockReset();
  fixture.confirm.mockResolvedValue(false);
  fixture.gpu.mockClear();
  fixture.quit.mockClear();
  fixture.app = new EventEmitter();
  count = 3;
  window = Object.assign(new EventEmitter(), {
    webContents: {
      mainFrame: { url: "https://fixture.test/public/index.html" },
      send: vi.fn(),
    },
    close: vi.fn(),
    isDestroyed: () => false,
    isFocused: () => true,
    isMinimized: () => false,
    show: vi.fn(),
    focus: vi.fn(),
  });
  fixture.owner = window;
  installSystemWindow(window as unknown as BrowserWindow, () => count);
  registerSystemIpc();
});
afterEach(() => window.emit("closed"));
it("persists validated preferences, deduplicates exceptions and broadcasts to chrome", () => {
  const result = invoke("system:update", event(), {
    ...defaultSystemPreferences,
    activeSites: ["EXAMPLE.com", "example.com"],
  });
  expect(result).toMatchObject({
    preferences: { activeSites: ["example.com"] },
  });
  expect(getSystemPreferences().activeSites).toEqual(["example.com"]);
  expect(window.webContents.send).toHaveBeenCalledWith(
    "system:changed",
    result,
  );
  expect(() =>
    invoke("system:update", event(), {
      ...defaultSystemPreferences,
      warnQuit: "true",
    }),
  ).toThrow();
  expect(() =>
    invoke("system:update", event(), {
      ...defaultSystemPreferences,
      activeSites: ["file:///etc"],
    }),
  ).toThrow();
});
it("rejects foreign senders, child frames and navigated chrome on every native endpoint", () => {
  for (const channel of fixture.handlers.keys()) {
    expect(() =>
      invoke(channel, {
        sender: {},
        senderFrame: window.webContents.mainFrame,
      }),
    ).toThrow("Untrusted");
    expect(() =>
      invoke(channel, {
        sender: window.webContents,
        senderFrame: { ...window.webContents.mainFrame },
      }),
    ).toThrow("Untrusted");
    const saved = window.webContents.mainFrame.url;
    window.webContents.mainFrame.url = "https://untrusted.test/";
    expect(() => invoke(channel, event())).toThrow("Untrusted");
    window.webContents.mainFrame.url = saved;
  }
});
it("closes the last tab's window only when enabled and native tab count permits", () => {
  invoke("system:close-last-tab", event());
  expect(window.close).not.toHaveBeenCalled();
  count = 1;
  saveSystemPreferences({ ...defaultSystemPreferences, closeLastTab: false });
  invoke("system:close-last-tab", event());
  expect(window.close).not.toHaveBeenCalled();
  saveSystemPreferences(defaultSystemPreferences);
  invoke("system:close-last-tab", event());
  expect(window.close).toHaveBeenCalledTimes(1);
});
it("coalesces close requests, keeps Cancel open and allows one confirmed close", async () => {
  const preventDefault = vi.fn();
  window.emit("close", { preventDefault });
  window.emit("close", { preventDefault });
  expect(fixture.confirm).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  expect(window.close).not.toHaveBeenCalled();
  fixture.confirm.mockResolvedValue(true);
  window.emit("close", { preventDefault });
  await Promise.resolve();
  expect(window.close).toHaveBeenCalledTimes(1);
  const permit = vi.fn();
  window.emit("close", { preventDefault: permit });
  expect(permit).not.toHaveBeenCalled();
});
it("reads GPU preference before ready and cancels Quit without setting the quitting flag", async () => {
  saveSystemPreferences({
    ...defaultSystemPreferences,
    hardwareAcceleration: false,
    warnQuit: true,
  });
  initializeSystemStartup();
  expect(fixture.gpu).toHaveBeenCalledTimes(1);
  const preventDefault = vi.fn();
  (fixture.app as EventEmitter).emit("before-quit", { preventDefault });
  await Promise.resolve();
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(isSystemQuitting()).toBe(false);
  expect(fixture.quit).not.toHaveBeenCalled();
});
it("honors the full-screen reminder preference", () => {
  window.emit("enter-full-screen");
  expect(window.webContents.send).toHaveBeenCalledWith(
    "system:fullscreen-reminder",
  );
  window.webContents.send.mockClear();
  saveSystemPreferences({
    ...defaultSystemPreferences,
    fullscreenReminder: false,
  });
  window.emit("enter-full-screen");
  expect(window.webContents.send).not.toHaveBeenCalled();
});
