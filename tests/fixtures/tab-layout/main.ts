import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, BrowserWindow } from "electron";

const directory = process.argv.at(-1);
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-tab-layout-vitest-")
)
  throw new Error("An isolated tab-layout fixture directory is required.");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const results: Record<string, unknown> = {};
const timeout = setTimeout(() => {
  errors.push("UI test timed out");
  app.quit();
}, 25_000);
app.once("will-quit", () => clearTimeout(timeout));
app.once("quit", () =>
  console.log("GORTH_TAB_LAYOUT=" + JSON.stringify({ results, errors })),
);

void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      width: 1920,
      height: 720,
      titleBarStyle: "hidden",
      show: false,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    window.webContents.on("render-process-gone", (_event, details) =>
      errors.push(details.reason),
    );
    window.webContents.on("console-message", (details) => {
      if (details.level === "error") errors.push(details.message);
    });
    await window.loadFile(path.join(directory, "renderer/index.html"));
    window.show();
    const acquireFocus = async () => {
      // macOS delivers focus/resize events asynchronously. Retrying from main
      // avoids testing selection while the native resize is still finishing.
      for (let attempt = 0; attempt < 30; attempt++) {
        app.focus({ steal: true });
        window.focus();
        window.webContents.focus();
        await delay(100);
        if (await window.webContents.executeJavaScript("document.hasFocus()"))
          return;
      }
      throw new Error("The native fixture could not acquire input focus.");
    };
    await acquireFocus();
    const evaluate = async (script: string) =>
      window.webContents.executeJavaScript(`(async () => {
      const settle = () => new Promise(resolve => setTimeout(resolve, 150));
      const fixture = window.tabLayoutFixture;
      const button = (label) => document.querySelector('button[aria-label="' + label + '"]');
      const widths = () => [...document.querySelectorAll('[data-tab-id]')].map(el => ({
        id: el.dataset.tabId, width: el.getBoundingClientRect().width
      }));
      const inactiveColors = async () => {
        const tab = document.querySelector('[data-tab-id="1"]');
        document.documentElement.classList.remove("dark");
        await settle(); await settle();
        const light = getComputedStyle(tab).backgroundColor;
        document.documentElement.classList.add("dark");
        await settle(); await settle();
        const dark = getComputedStyle(tab).backgroundColor;
        document.documentElement.classList.remove("dark");
        await settle(); await settle();
        return { light, dark };
      };
      ${script}
    })()`);
    results.separate = await evaluate(`
      const deadline = Date.now() + 3000;
      while (!document.hasFocus() && Date.now() < deadline) await settle();
      if (!document.hasFocus()) throw new Error("The native fixture could not acquire input focus.");
      await settle();
      return { toolbar: !!document.querySelector('nav[aria-label="Browser address toolbar"]'), widths: widths(), inactiveColors: await inactiveColors(),
        inputBorder: getComputedStyle(document.querySelector('input[aria-label="Address bar"]')).borderTopWidth };
    `);
    results.compact = await evaluate(`
      fixture.setCompact(true); await settle();
      return { toolbar: !!document.querySelector('nav[aria-label="Browser address toolbar"]'), widths: widths(),
        inactiveColors: await inactiveColors(),
        alignment: [...document.querySelectorAll('[role="tab"]')].map(tab => getComputedStyle(tab).justifyContent),
        titles: [...document.querySelectorAll('[role="tab"]')].map(tab => tab.textContent.trim()),
        height: document.querySelector('header').getBoundingClientRect().height,
        buttons: ["Back","Forward","Reload","Home","Split view","Bookmark this page","Site information",
          "Archive","Shortcuts","Bookmarks","History","Downloads","Extensions","Experiments","Settings",
          "Toggle sidebar","Open browser menu"].every(label => !!button(label)) };
    `);
    window.setContentSize(1280, 720);
    results.small = await evaluate(
      `await settle(); return { widths: widths(), scrollButtons: !!button("Scroll tabs right") };`,
    );
    // Resizing a native macOS window can move input focus away from Chromium.
    // Reacquire it before testing first-click selection, as a real user would.
    await acquireFocus();
    results.editing = await evaluate(`
      const deadline = Date.now() + 3000;
      while (!document.hasFocus() && Date.now() < deadline) await settle();
      if (!document.hasFocus()) throw new Error("The URL editor fixture could not acquire input focus.");
      document.querySelector('[role="tab"][aria-selected="true"]').click(); await settle();
      let input = document.querySelector('input[aria-label="Address bar"]');
      const selected = input && input.selectionStart === 0 && input.selectionEnd === input.value.length;
      const fullUrl = input?.value;
      const focusRing = getComputedStyle(input).getPropertyValue("--tw-ring-shadow");
      const inputBorder = getComputedStyle(input).borderTopWidth;
      const tabRing = getComputedStyle(document.querySelector('[data-tab-id="0"]')).getPropertyValue("--tw-ring-shadow");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, "example.org/test"); input.dispatchEvent(new Event("input", { bubbles: true }));
      await settle(); input.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await settle();
      const submitted = !document.querySelector('input[aria-label="Address bar"]') && fixture.actions.includes("navigate:example.org/test");
      document.querySelector('[role="tab"][aria-selected="true"]').click(); await settle();
      input = document.querySelector('input[aria-label="Address bar"]');
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await settle();
      const escaped = !document.querySelector('input[aria-label="Address bar"]');
      document.querySelector('[data-tab-id="1"] [role="tab"]').click(); await settle();
      const firstClickActivates = document.querySelector('[data-tab-id="1"] [role="tab"]').getAttribute("aria-selected") === "true"
        && !document.querySelector('input[aria-label="Address bar"]');
      document.querySelector('[data-tab-id="1"] [role="tab"]').click(); await settle();
      const secondClickEdits = !!document.querySelector('input[aria-label="Address bar"]');
      document.querySelector('input[aria-label="Address bar"]').blur(); await settle();
      return { selected, fullUrl, focusRing, inputBorder, tabRing, submitted, escaped, firstClickActivates, secondClickEdits,
        blurred: !document.querySelector('input[aria-label="Address bar"]'),
        titleAfterBlur: document.querySelector('[role="tab"][aria-selected="true"]').textContent.trim() };
    `);
    results.actions = await evaluate(`
      button("Home").click(); button("Settings").click(); button("Open browser menu").click();
      fixture.setLoading(); await settle(); button("Loading").click(); await settle();
      button("Mute YouTube").click();
      fixture.setGrouped(); await settle(); const grouped = widths();
      fixture.setPinned(); await settle(); const pinned = widths();
      fixture.setActive("2"); await settle(); const activePinned = widths();
      fixture.setActive("0"); await settle();
      document.querySelector('[data-tab-id="2"]').dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
      await settle();
      return { actions: fixture.actions, grouped, pinned, activePinned,
        middleClosed: !document.querySelector('[data-tab-id="2"]') };
    `);
    results.restored = await evaluate(`
      fixture.setCompact(false); await settle();
      return { toolbar: !!document.querySelector('nav[aria-label="Browser address toolbar"]'),
        editor: !!document.querySelector('input[aria-label="Address bar"]'),
        inputBorder: getComputedStyle(document.querySelector('input[aria-label="Address bar"]')).borderTopWidth };
    `);
    results.sidebar = await evaluate(`
      button("Toggle sidebar").click(); await settle();
      let rail = document.querySelector('aside[aria-label="Browser sidebar"]');
      const style = getComputedStyle(rail);
      const bounds = rail.getBoundingClientRect();
      const closeButton = button("Close sidebar").getBoundingClientRect();
      const left = { width: bounds.width, x: bounds.x, padding: style.padding, gap: style.gap,
        buttonWidth: closeButton.width, buttonHeight: closeButton.height, text: rail.textContent.trim() };
      button("Close sidebar").click(); await settle();
      const closedViaButton = !document.querySelector('aside[aria-label="Browser sidebar"]');
      fixture.setSidebarSide("right"); button("Toggle sidebar").click(); await settle();
      rail = document.querySelector('aside[aria-label="Browser sidebar"]');
      const right = { width: rail.getBoundingClientRect().width, right: rail.getBoundingClientRect().right };
      button("Toggle sidebar").click(); await settle();
      return { left, right, closedViaButton, closedViaToggle: !document.querySelector('aside[aria-label="Browser sidebar"]'),
        viewportWidth: window.innerWidth };
    `);
    results.vertical = await evaluate(`
      const inspect = async (collapsed) => {
        fixture.setVertical(true, collapsed); await settle();
        const rail = document.querySelector('aside[aria-label="Vertical tabs"]');
        const list = rail.querySelector('[role="tablist"]');
        const box = list.getBoundingClientRect();
        const tabs = [...list.querySelectorAll('[data-tab-id], [data-tab-group]')].map(tab => {
          const rect = tab.getBoundingClientRect();
          return rect.left >= box.left - 0.1 && rect.right <= box.right + 0.1;
        });
        const toolbar = document.querySelector('[aria-label="Browser address toolbar"]');
        return { width: rail.getBoundingClientRect().width, tabsFit: tabs.every(Boolean),
          toolbar: !!toolbar, input: !!toolbar.querySelector('input'), height: toolbar.getBoundingClientRect().height };
      };
      return { expanded: await inspect(false), collapsed: await inspect(true) };
    `);
    window.close();
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
