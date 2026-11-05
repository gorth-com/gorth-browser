import { app } from "electron";
import { createWindow, getBrowserWindows } from "@/main/windows/capital";
import type { BrowserWindow } from "electron";

const pending: string[] = [];
const readyWindows = new WeakSet<BrowserWindow>();
export function markBrowserLinksReady(window: BrowserWindow) {
  readyWindows.add(window);
  for (const value of pending.splice(0))
    window.webContents.send("tabs:open-requested", value);
}

// Only navigation is customized here; authentication deep links keep their
// existing Better Auth handler and PKCE validation.
export function installBrowserLinks() {
  function accept(value: string) {
    try {
      const url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return;
      const window = getBrowserWindows()[0];
      if (window && readyWindows.has(window)) {
        window.webContents.send("tabs:open-requested", url.href);
        window.show();
        window.focus();
      } else pending.push(url.href);
    } catch {
      /* Other command-line arguments are not browser URLs. */
    }
  }
  for (const argument of process.argv.slice(1)) accept(argument);
  app.on("open-url", (event, value) => {
    if (!/^https?:\/\//i.test(value)) return;
    event.preventDefault();
    accept(value);
    if (app.isReady() && !getBrowserWindows().length) createWindow();
  });
  app.on("second-instance", (_event, argv) => {
    for (const argument of argv.slice(1)) accept(argument);
    if (app.isReady() && pending.length && !getBrowserWindows().length)
      createWindow();
  });
}
