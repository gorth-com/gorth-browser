import path from "node:path";
import { app, BrowserWindow } from "electron";
import { setTimeout as delay } from "node:timers/promises";
import { initializeDatabase, closeDatabase } from "@/services/browser-database";
import {
  getSystemPreferences,
  saveSystemPreferences,
} from "@/main/services/system-preferences";
import {
  initializeSystemStartup,
  installSystemWindow,
  registerSystemIpc,
} from "@/main/services/system";
import { installPortal } from "@/main/windows/portal";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-system-native-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
initializeDatabase(app.getPath("userData"));
initializeSystemStartup();
registerSystemIpc();
const errors: string[] = [];
const result: Record<string, unknown> = {};
const timer = setTimeout(() => app.exit(1), 25000);
app.on("window-all-closed", () => {});
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_SYSTEM=" + JSON.stringify({ errors, result }));
});
void (async () => {
  let window: BrowserWindow | undefined;
  try {
    await app.whenReady();
    window = new BrowserWindow({
      width: 1200,
      height: 1000,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(directory, "preload.cjs"),
      },
    });
    const owner = window;
    let tabCount = 3;
    installSystemWindow(owner, () => tabCount);
    installPortal(owner);
    owner.webContents.on("console-message", (details) => {
      if (details.level === "error") errors.push(details.message);
    });
    await owner.loadFile(path.join(directory, "renderer/public/index.html"));
    const run = (code: string) => owner.webContents.executeJavaScript(code);
    async function wait(check: () => Promise<boolean>) {
      const until = Date.now() + 5000;
      while (!(await check())) {
        if (Date.now() > until)
          throw new Error("System fixture did not settle");
        await delay(30);
      }
    }
    await wait(
      async () =>
        !!(await run(
          'document.querySelector("[aria-label=\\"Energy Saver mode\\"]")',
        )),
    );
    await wait(
      async () =>
        !(await run(
          'document.querySelector("[aria-labelledby=system-hardwareAcceleration]").disabled',
        )),
    );
    result.headings = await run(
      '[...document.querySelectorAll("header [data-slot=card-title]")].map(el=>el.textContent)',
    );
    result.gap = await run(
      'getComputedStyle(document.querySelector("[aria-label=\\"Memory Saver mode\\"]")).gap',
    );
    await run(
      'document.querySelector("[aria-labelledby=system-hardwareAcceleration]").click()',
    );
    await wait(async () => !getSystemPreferences().hardwareAcceleration);
    result.restartRequired = await run(
      "window.electronAPI.system.get().then(value => value.restartRequired)",
    );
    await run('document.querySelector("[value=maximum]").click()');
    await wait(
      async () =>
        !!(await run('window.systemFixture.calls.includes("sleep:5")')),
    );
    await run(
      '[...document.querySelectorAll("button")].find(el=>el.textContent.trim()==="Add").click()',
    );
    await run(`(() => { const input=document.querySelector('[aria-label="Website hostname"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'example.com');
      input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await run('document.querySelector("form").requestSubmit()');
    await wait(async () =>
      getSystemPreferences().activeSites.includes("example.com"),
    );
    result.siteAdded = true;
    await run(
      'document.querySelector("[aria-label=\\"Remove example.com\\"]").click()',
    );
    await wait(async () => !getSystemPreferences().activeSites.length);
    result.siteRemoved = true;
    await run(
      'document.querySelector("[aria-label=\\"Open shortcuts\\"]").click()',
    );
    result.shortcuts = await run(
      'window.systemFixture.calls.includes("settings/shortcuts")',
    );
    await run('document.querySelector("[value=unplugged]").click()');
    await wait(async () => getSystemPreferences().energyMode === "unplugged");
    closeDatabase();
    initializeDatabase(app.getPath("userData"));
    result.persisted =
      getSystemPreferences().energyMode === "unplugged" &&
      !getSystemPreferences().hardwareAcceleration;
    const popup = () =>
      owner.contentView.children
        .flatMap((child) =>
          "webContents" in child ? [child as Electron.WebContentsView] : [],
        )
        .find((view) => view.getVisible());
    owner.close();
    await wait(
      async () =>
        !!(
          popup() &&
          (await popup()!.webContents.executeJavaScript(
            '!!document.querySelector("[data-slot=alert-dialog-cancel]")',
          ))
        ),
    );
    result.closeDialog = await popup()!.webContents.executeJavaScript(
      'document.body.textContent.includes("Close window with 3 tabs?")',
    );
    await popup()!.webContents.executeJavaScript(
      'document.querySelector("[data-slot=alert-dialog-cancel]").click()',
    );
    await delay(100);
    result.cancelKeepsWindow = !owner.isDestroyed();
    saveSystemPreferences({ ...getSystemPreferences(), warnQuit: true });
    app.quit();
    await wait(
      async () =>
        !!(
          popup() &&
          (await popup()!.webContents.executeJavaScript(
            'document.body.textContent.includes("Quit Gorth Browser?")',
          ))
        ),
    );
    result.quitDialog = true;
    await popup()!.webContents.executeJavaScript(
      'document.querySelector("[data-slot=alert-dialog-cancel]").click()',
    );
    await delay(100);
    result.cancelKeepsApp = !owner.isDestroyed();
    tabCount = 1;
    await run("void window.electronAPI.system.closeLastTab()");
    await wait(async () => owner.isDestroyed());
    result.lastTabClosesWindow = true;
  } catch (error) {
    errors.push(String(error));
  } finally {
    saveSystemPreferences({ ...getSystemPreferences(), warnQuit: false });
    window?.destroy();
    closeDatabase();
    app.exit(0);
  }
})();
