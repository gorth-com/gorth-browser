import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";
it("renders System and persists settings through real IPC/SQLite, with cancellable native close and Quit dialogs", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "gorth-system-native-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    const fixture = path.join(root, "tests/fixtures/system");
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: fixture,
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: {
        outDir: path.join(directory, "renderer"),
        emptyOutDir: false,
        rolldownOptions: { input: path.join(fixture, "public/index.html") },
      },
    });
    for (const entry of ["main", "preload"])
      await bundle({
        absWorkingDir: root,
        entryPoints: [`tests/fixtures/system/${entry}.ts`],
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: path.join(directory, `${entry}.cjs`),
        define: {
          "import.meta.env": "{}",
          MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(
            pathToFileURL(path.join(directory, "renderer") + path.sep).href,
          ),
          MAIN_WINDOW_VITE_NAME: '"main"',
        },
        plugins: [
          {
            name: "native-sqlite",
            setup(build) {
              build.onResolve({ filter: /^better-sqlite3$/ }, () => ({
                path: require.resolve("better-sqlite3"),
                external: true,
              }));
            },
          },
        ],
      });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 30000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((item) => item.startsWith("GORTH_SYSTEM="));
    expect(line, stdout).toBeDefined();
    const value = JSON.parse(line!.slice("GORTH_SYSTEM=".length));
    expect(value.errors, JSON.stringify(value.result)).toEqual([]);
    expect(value.result).toEqual({
      headings: ["System", "Memory", "Power"],
      gap: "16px",
      restartRequired: true,
      siteAdded: true,
      siteRemoved: true,
      shortcuts: true,
      persisted: true,
      closeDialog: true,
      cancelKeepsWindow: true,
      quitDialog: true,
      cancelKeepsApp: true,
      lastTabClosesWindow: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
});
