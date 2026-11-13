import { app, BrowserWindow } from "electron";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-browser-setup-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const result: Record<string, unknown> = {};
const timer = setTimeout(() => {
  errors.push("UI timed out");
  app.quit();
}, 18000);
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_SETUP=" + JSON.stringify({ errors, result }));
});
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      show: false,
      width: 1050,
      height: 1100,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const portals: BrowserWindow[] = [];
    window.webContents.setWindowOpenHandler(({ url }) =>
      url === "about:blank"
        ? {
            action: "allow",
            overrideBrowserWindowOptions: {
              show: false,
              webPreferences: {
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
              },
            },
          }
        : { action: "deny" },
    );
    window.webContents.on("did-create-window", (child) => portals.push(child));
    let phase = "mount";
    window.webContents.on("console-message", (details) => {
      if (details.level === "error")
        errors.push(phase + ": " + details.message);
    });
    await window.loadFile(path.join(directory, "renderer/index.html"));
    const run = (script: string) =>
      window.webContents.executeJavaScript(script);
    const wait = async (script: string) => {
      const until = Date.now() + 5000;
      while (!(await run(script))) {
        if (Date.now() > until) throw new Error("UI did not settle: " + script);
        await delay(25);
      }
    };
    const click = (label: string) =>
      run(
        `Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === ${JSON.stringify(label)})?.click()`,
      );
    await wait(
      "Array.from(document.querySelectorAll('button')).some(el => el.textContent.trim() === 'Personal' && !el.disabled)",
    );
    result.guest = await run(
      "document.body.textContent.includes('Log in or create a Gorth account')",
    );
    result.container = await run(
      "!!document.querySelector('.container.mx-auto.p-6')",
    );
    result.heading = await run(
      "getComputedStyle(document.querySelector('header [data-slot=card-title]')).fontSize",
    );
    phase = "profile";
    await click("Personal");
    await wait("document.body.textContent.includes('Save profile')");
    result.profile = true;
    phase = "login";
    await click("Get started");
    await wait("document.body.textContent.includes('fixture@example.test')");
    result.signedIn = true;
    phase = "default-browser";
    await click("Open system settings");
    await wait("window.setupFixture.calls.includes('default-browser')");
    await delay(300);
    result.portalToast = false;
    for (const child of portals) {
      if (
        !child.isDestroyed() &&
        (await child.webContents.executeJavaScript(
          "document.body.textContent.includes('Choose Gorth Browser in system settings')",
        ))
      )
        result.portalToast = true;
    }
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Open the New Tab page')?.click()",
    );
    await wait("window.setupFixture.preferences().startup === 'new-tab'");
    result.startup = true;
    phase = "select";
    await run("document.querySelector('[role=combobox]')?.click()");
    await wait(
      "Array.from(document.querySelectorAll('[role=option]')).some(el => el.textContent.includes('Blank page'))",
    );
    await run(
      "Array.from(document.querySelectorAll('[role=option]')).find(el => el.textContent.includes('Blank page'))?.click()",
    );
    await wait("window.setupFixture.preferences().newTab === 'blank'");
    result.newTab = true;
    phase = "dock";
    await click("Show app in Finder");
    await delay(300);
    result.errorToast = false;
    for (const child of portals) {
      if (
        !child.isDestroyed() &&
        (await child.webContents.executeJavaScript(
          "document.body.textContent.includes('Packaged application required')",
        ))
      )
        result.errorToast = true;
    }
    result.inlineError = await run(
      "document.querySelectorAll('[role=alert]').length === 0",
    );
    await click("Preview");
    await wait("!!document.querySelector('[aria-label=\"New tab\"]')");
    result.blankPreview = await run(
      "!document.body.textContent.includes('What do you want to explore?')",
    );
    phase = "appearance";
    await run("window.showAppearance()");
    await wait("!!document.getElementById('toast-position-label')");
    const select = async (id: string, text: string) => {
      await run(`document.querySelector('[aria-labelledby="${id}"]')?.click()`);
      await wait(
        `Array.from(document.querySelectorAll('[role=option]')).some(el => el.textContent.trim() === ${JSON.stringify(text)})`,
      );
      await run(
        `Array.from(document.querySelectorAll('[role=option]')).find(el => el.textContent.trim() === ${JSON.stringify(text)})?.click()`,
      );
    };
    await select("toast-position-label", "Top left");
    await wait(
      "document.querySelector('[aria-labelledby=toast-position-label]')?.textContent.includes('Top left')",
    );
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Hide completely')?.click()",
    );
    await wait("window.appearanceState.collapseMode === 'none'");
    await run(
      "document.querySelector('[aria-labelledby=sidebar-collapse-switch-label]')?.click()",
    );
    await wait(
      "window.appearanceState.collapsible && window.appearanceState.collapseMode === 'none'",
    );
    await run(
      "document.querySelector('[aria-labelledby=vertical-tabs-label]')?.click()",
    );
    await wait(
      "window.appearanceState.vertical && window.appearanceState.tabLayout === 'compact'",
    );
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Separate')?.click()",
    );
    await wait(
      "!window.appearanceState.vertical && window.appearanceState.tabLayout === 'separate'",
    );
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Show on the right')?.click()",
    );
    await wait("window.appearanceState.side === 'right'");
    await run(
      "document.querySelector('[aria-labelledby=sidebar-visibility-label]')?.click()",
    );
    await wait(
      "document.querySelector('[aria-labelledby=sidebar-visibility-label]')?.getAttribute('aria-checked') === 'true'",
    );
    result.appearance = true;
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
