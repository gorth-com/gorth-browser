import { app, BrowserWindow, ipcMain, shell, type WebContents } from "electron";
import { parseLoginNavigation } from "@/lib/auth/login-navigation";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";

const queue: Array<{ url: string; expiresAt: number }> = [];
const origins = new Map<string, number>();
let owner: BrowserWindow | undefined;
let callback: (url: string) => Promise<boolean> = async () => false;
function flush() {
  if (!owner || owner.isDestroyed() || owner.webContents.isDestroyed()) return;
  for (const entry of queue.splice(0)) {
    if (entry.expiresAt > Date.now())
      owner.webContents.send("auth:navigation-requested", entry.url);
  }
  if (owner.isMinimized()) owner.restore();
  owner.show();
  owner.focus();
}
export function receiveLoginNavigation(value: string) {
  const target = parseLoginNavigation(value);
  if (!target) return false;
  for (const [key, deadline] of origins)
    if (deadline <= Date.now()) origins.delete(key);
  // This is an origin routing allowlist, not an OAuth session/state store.
  if (origins.size >= 16) origins.delete(origins.keys().next().value!);
  origins.set(
    target.origin + "|" + target.callbackScheme,
    Date.now() + 120_000,
  );
  if (queue.length >= 4) queue.shift();
  queue.push({ url: target.url, expiresAt: Date.now() + 120_000 });
  if (!owner || owner.isDestroyed()) {
    if (app.isReady()) app.emit("activate");
  } else flush();
  return true;
}
export function registerLoginNavigation(
  authenticate: (url: string) => Promise<boolean>,
) {
  callback = authenticate;
  ipcMain.on("auth:navigation-ready", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      return;
    owner = window;
    flush();
  });
}
// Intercept only known auth schemes. Normal websites never get a native bridge.
export function routeLoginCallback(
  contents: WebContents,
  value: string,
  initiator?: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!["com.gorth.browser:", "com.gorth.launcher:"].includes(url.protocol))
    return false;
  try {
    const origin = new URL(initiator ?? contents.getURL()).origin;
    const deadline = origins.get(origin + "|" + url.protocol) ?? 0;
    if (
      deadline <= Date.now() ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      !url.hash.startsWith("#token=") ||
      url.hash.length > 4096
    )
      return true;
    async function dispatch() {
      try {
        if (url.protocol === "com.gorth.browser:") await callback(url.href);
        else await shell.openExternal(url.href);
      } catch {
        console.warn("Could not deliver the desktop login callback.");
      }
    }
    void dispatch();
  } catch {
    return true;
  }
  return true;
}
