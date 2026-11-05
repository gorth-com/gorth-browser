import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>,
  command: vi.fn(),
  cleanups: [] as Array<() => void>,
  focus: undefined as undefined | (() => void),
}));

// Exercise the actual scheduler without a DOM or native/live account access.
vi.mock("react", () => ({
  useState: (initial: unknown) => [
    initial == null ? fixture.snapshot : initial,
    vi.fn(),
  ],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) fixture.cleanups.push(cleanup);
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const account = {
    id: "fixture-subject",
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 600_000,
    canRefresh: true,
    needsLogin: false,
  };
  fixture.snapshot = {
    user: account,
    launcher: account,
    locked: false,
    busy: false,
    pending: null,
  };
  fixture.command.mockReset().mockResolvedValue({
    ok: true,
    snapshot: fixture.snapshot,
  });
  vi.stubGlobal("window", {
    electronAPI: {
      auth: {
        onChanged: () => () => {},
        snapshot: async () => ({ ok: true, snapshot: fixture.snapshot }),
        command: fixture.command,
      },
    },
    addEventListener: (_event: string, callback: () => void) => {
      fixture.focus = callback;
    },
    removeEventListener: () => {
      fixture.focus = undefined;
    },
  });
});

afterEach(() => {
  for (const cleanup of fixture.cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("does not refresh on each tick/focus; checks identity at the native 90-second refresh boundary", async () => {
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(89_999);
  expect(fixture.command).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(fixture.command).toHaveBeenCalledTimes(1);
});

it("refreshes expiring credentials according to the shared leeway", async () => {
  const account = fixture.snapshot.user as { expiresAt: number };
  account.expiresAt = Date.now() + 29_000;
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).toHaveBeenCalledTimes(1);
});

it("does not refresh locked vaults or overlap a pending auth operation", async () => {
  fixture.snapshot.locked = true;
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fixture.command).not.toHaveBeenCalled();
  fixture.snapshot.locked = false;
  fixture.snapshot.busy = true;
  fixture.snapshot.pending = "launcher.login";
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).not.toHaveBeenCalled();
});
