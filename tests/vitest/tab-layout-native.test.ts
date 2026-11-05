import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
let directory: string | undefined;
let executable: string;
interface TabWidth {
  id: string;
  width: number;
}
interface Result {
  errors: string[];
  results: {
    vertical: {
      expanded: {
        width: number;
        tabsFit: boolean;
        toolbar: boolean;
        input: boolean;
        height: number;
      };
      collapsed: {
        width: number;
        tabsFit: boolean;
        toolbar: boolean;
        input: boolean;
        height: number;
      };
    };
    separate: {
      toolbar: boolean;
      widths: TabWidth[];
      inactiveColors: { light: string; dark: string };
      inputBorder: string;
    };
    compact: {
      toolbar: boolean;
      widths: TabWidth[];
      height: number;
      buttons: boolean;
      inactiveColors: { light: string; dark: string };
      alignment: string[];
      titles: string[];
    };
    small: { widths: TabWidth[]; scrollButtons: boolean };
    editing: Record<string, boolean | string>;
    actions: {
      actions: string[];
      grouped: TabWidth[];
      pinned: TabWidth[];
      activePinned: TabWidth[];
      middleClosed: boolean;
    };
    restored: { toolbar: boolean; editor: boolean; inputBorder: string };
    sidebar: {
      left: {
        width: number;
        x: number;
        padding: string;
        gap: string;
        buttonWidth: number;
        buttonHeight: number;
        text: string;
      };
      right: { width: number; right: number };
      closedViaButton: boolean;
      closedViaToggle: boolean;
      viewportWidth: number;
    };
  };
}
beforeAll(async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native Electron UI tests require GUI permission outside the Codex sandbox.",
    );
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const pathFile = path.join(electronRoot, "path.txt");
  if (!existsSync(pathFile))
    throw new Error("The installed Electron binary is missing.");
  executable = path.join(
    electronRoot,
    "dist",
    (await readFile(pathFile, "utf8")).trim(),
  );
  directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-tab-layout-vitest-")),
  );
  await mkdir(path.join(directory, "profile"));
  await build({
    configFile: false,
    envDir: false,
    base: "./",
    logLevel: "error",
    root: path.join(root, "tests/fixtures/tab-layout"),
    plugins: [react(), tailwind()],
    resolve: { alias: { "@": root } },
    build: {
      outDir: path.join(directory, "renderer"),
      emptyOutDir: false,
      minify: false,
    },
  });
  await bundle({
    absWorkingDir: root,
    entryPoints: ["tests/fixtures/tab-layout/main.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    outfile: path.join(directory, "main.cjs"),
  });
}, 45_000);
afterAll(async () => {
  if (directory)
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
});

describe("real Chromium tab layout UI", () => {
  it("reuses controls, preserves the 2:1 ratio and edits the active tab URL", async () => {
    if (!directory) throw new Error("The renderer fixture was not built.");
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      {
        cwd: root,
        env,
        timeout: 30_000,
        maxBuffer: 512_000,
      },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_TAB_LAYOUT="));
    expect(line, stdout).toBeDefined();
    const report = JSON.parse(
      line!.slice("GORTH_TAB_LAYOUT=".length),
    ) as Result;
    expect(report.errors).toEqual([]);
    const { separate, compact, small, editing, actions, restored } =
      report.results;
    expect(separate.toolbar).toBe(true);
    expect(separate.inputBorder).toBe("1px");
    separate.widths.forEach((tab) => expect(tab.width).toBe(180));
    expect(compact).toMatchObject({
      toolbar: false,
      height: 56,
      buttons: true,
    });
    expect(compact.widths[0].width).toBe(360);
    expect(compact.widths[1].width).toBe(180);
    expect(compact.titles).toEqual(["Google", "YouTube", "Example"]);
    expect(compact.alignment).toEqual([
      "flex-start",
      "flex-start",
      "flex-start",
    ]);
    expect(separate.inactiveColors).toEqual(compact.inactiveColors);
    expect(separate.inactiveColors.light).not.toBe(
      separate.inactiveColors.dark,
    );
    expect(separate.inactiveColors.light).not.toBe("rgba(0, 0, 0, 0)");
    expect(small.widths[1].width).toBeLessThan(180);
    expect(small.widths[0].width).toBeCloseTo(small.widths[1].width * 2, 1);
    expect(small.widths[1].width).toBeCloseTo(small.widths[2].width, 1);
    expect(small.scrollButtons).toBe(true);
    expect(editing).toMatchObject({
      selected: true,
      fullUrl: "https://www.google.com/watch?v=test",
      submitted: true,
      escaped: true,
      firstClickActivates: true,
      secondClickEdits: true,
      blurred: true,
      titleAfterBlur: "YouTube",
      inputBorder: "0px",
    });
    expect(editing.focusRing).toMatch(/\b0(?:px)?\b/);
    expect(editing.focusRing).not.toContain("3px");
    expect(editing.tabRing).not.toContain("2px");
    expect(actions.actions).toEqual(
      expect.arrayContaining([
        "home",
        "internal:settings",
        "stop",
        "mute:1",
        "navigate:example.org/test",
      ]),
    );
    expect(actions.grouped[1].width).toBeCloseTo(
      actions.grouped[0].width * 2,
      1,
    );
    expect(actions.pinned[2].width).toBe(36);
    expect(actions.activePinned[2].width).toBeCloseTo(
      actions.activePinned[0].width * 2,
      1,
    );
    expect(actions.middleClosed).toBe(true);
    expect(restored).toEqual({
      toolbar: true,
      editor: true,
      inputBorder: "1px",
    });
    const { sidebar } = report.results;
    expect(sidebar.left).toEqual({
      width: 56,
      x: 0,
      padding: "10px",
      gap: "8px",
      buttonWidth: 36,
      buttonHeight: 36,
      text: "",
    });
    expect(sidebar.right).toEqual({ width: 56, right: sidebar.viewportWidth });
    expect(sidebar.closedViaButton).toBe(true);
    expect(sidebar.closedViaToggle).toBe(true);
    expect(report.results.vertical.expanded).toMatchObject({
      width: 200,
      tabsFit: true,
      toolbar: true,
      input: true,
      height: 56,
    });
    expect(report.results.vertical.collapsed).toMatchObject({
      width: 56,
      tabsFit: true,
      toolbar: true,
      input: true,
      height: 56,
    });
  });
});
