import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import { rawUpsertUserProfile } from "@/models/user-profile";
import { BrowserWindow, ipcMain } from "electron";
import {
  openAuthView,
  closeAuthView,
  registerAuthViewIpc,
} from "@/main/services/auth-view";
import {
  gorthSnapshot,
  getGorthUserId,
  loginGorth,
  restoreGorthSession,
  signOutGorth,
  onGorthChanged,
} from "@/lib/auth/gorth";
import type { AuthResult, AuthSnapshot } from "@/lib/auth/types";
import { getLoginBrowser, setLoginBrowser } from "@/lib/auth/login-browser";

let operation: AbortController | null = null;
function snapshot(): AuthSnapshot {
  return {
    ...gorthSnapshot(),
    busy: !!operation,
    loginBrowser: getLoginBrowser(),
  };
}
function changed() {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("auth:changed", snapshot());
}
export function cancelAuth() {
  operation?.abort();
}
export function registerAuthIpc() {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      throw new Error("Untrusted auth sender");
    return window;
  };
  onGorthChanged(changed);
  registerAuthViewIpc(trusted);
  ipcMain.handle("auth:login-browser", (event, value: unknown): AuthResult => {
    trusted(event);
    try {
      if (operation)
        throw new Error("An account operation is already running.");
      setLoginBrowser(value);
      changed();
      return { snapshot: snapshot() };
    } catch {
      return {
        snapshot: snapshot(),
        error: "Không thể lưu trình duyệt đăng nhập.",
      };
    }
  });
  ipcMain.handle("auth:snapshot", (event): AuthResult => {
    trusted(event);
    return { snapshot: snapshot() };
  });
  ipcMain.handle(
    "auth:command",
    async (event, action: unknown): Promise<AuthResult> => {
      const owner = trusted(event);
      if (action === "cancel") {
        cancelAuth();
        return { snapshot: snapshot() };
      }
      if (
        typeof action !== "string" ||
        !["login", "register", "unlock", "logout", "refresh"].includes(action)
      )
        return { snapshot: snapshot(), error: "Invalid account action." };
      if (operation)
        return {
          snapshot: snapshot(),
          error: "An account operation is already running.",
        };
      const controller = new AbortController();
      operation = controller;
      let completed = false;
      changed();
      try {
        if (action === "login" || action === "register") {
          openAuthView(owner, controller, action);
          await loginGorth(controller.signal);
          completed = true;
        } else if (action === "logout") await signOutGorth();
        else await restoreGorthSession(controller.signal);
        const user = gorthSnapshot().user;
        if (user) rawUpsertUserProfile(user);
        return { snapshot: { ...snapshot(), busy: false } };
      } catch (error) {
        return {
          snapshot: { ...snapshot(), busy: false },
          error: controller.signal.aborted
            ? "Sign-in cancelled."
            : error instanceof Error
              ? error.message
              : "Account operation failed.",
        };
      } finally {
        closeAuthView(owner, completed);
        if (operation === controller) operation = null;
        changed();
      }
    },
  );
}
export function getAuthenticatedUserId() {
  return getGorthUserId();
}
