import { expect, it, vi } from "vitest";
it("stores browser choice through trusted IPC without unlocking Keychain", async () => {
  registerAuthIpc();
  calls.available = false;
  const event = { sender, senderFrame: frame };
  const before = calls.decrypt;
  const choose = handlers.get("auth:login-browser")!;
  const selected = (await choose(
    event,
    "gorth",
  )) as import("@/lib/auth/types").AuthResult;
  expect(selected.snapshot.loginBrowser).toBe("gorth");
  expect(
    ((await choose(event, "invalid")) as import("@/lib/auth/types").AuthResult)
      .error,
  ).toBeTruthy();
  await expect(async () =>
    choose({ sender: {}, senderFrame: frame }, "default"),
  ).rejects.toThrow("Untrusted");
  expect(calls.decrypt).toBe(before);
  expect(
    ((await choose(event, "default")) as import("@/lib/auth/types").AuthResult)
      .snapshot.loginBrowser,
  ).toBe("default");
});
import { calls, frame, handlers, sender } from "./electron-auth-mock";
import { registerAuthIpc } from "@/lib/auth/service";
vi.mock("@/main/rpc/sender", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/main/rpc/sender")>()),
  getRpcRendererUrl: () => "http://localhost:5501/public/index.html",
}));
vi.mock("electron", () => import("./electron-auth-mock"));
vi.mock("@/models/user-profile", () => ({ rawUpsertUserProfile: vi.fn() }));
const native = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    name: string;
    expiresAt: number;
    needsLogin: boolean;
    verifiedAt: number;
    canRefresh: boolean;
  },
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/gorth", () => ({
  gorthSnapshot: () => ({
    user: native.user,
    locked: !native.user,
    configured: true,
  }),
  getGorthUserId: () => native.user?.id ?? null,
  onGorthChanged: () => () => {},
  restoreGorthSession: async () => {
    native.user = {
      id: "sso-sub",
      name: "Fixture",
      expiresAt: Date.now() + 120000,
      verifiedAt: Date.now(),
      canRefresh: true,
      needsLogin: false,
    };
  },
  signOutGorth: async () => {
    native.user = null;
    native.signOut();
  },
  loginGorth: vi.fn(),
}));

it("uses native public session snapshots, rejects foreign IPC and never exposes credentials", async () => {
  calls.available = true;
  registerAuthIpc();
  const event = { sender, senderFrame: frame };
  const command = async (action: string) =>
    (await handlers.get("auth:command")!(
      event,
      action,
    )) as import("@/lib/auth/types").AuthResult;
  expect((await command("unlock")).snapshot.user?.id).toBe("sso-sub");
  expect(JSON.stringify(calls.snapshots)).not.toMatch(
    /accessToken|refreshToken|session_token/,
  );
  await expect(async () =>
    handlers.get("auth:command")!({ sender: {}, senderFrame: frame }, "unlock"),
  ).rejects.toThrow("Untrusted");
  await expect(async () =>
    handlers.get("auth:snapshot")!({ sender, senderFrame: {} }),
  ).rejects.toThrow("Untrusted");
  expect((await command("logout")).snapshot.user).toBeNull();
  expect(native.signOut).toHaveBeenCalledTimes(1);
});
