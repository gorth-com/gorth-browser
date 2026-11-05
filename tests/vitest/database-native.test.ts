import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";

it("preserves legacy data and restores tabs, groups, bookmarks and settings with Electron's real SQLite driver", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native Electron verification requires GUI permission outside the sandbox",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-browser-database-")),
  );
  try {
    await symlink(
      path.join(root, "node_modules"),
      path.join(directory, "node_modules"),
    );
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/database/main.ts"],
      tsconfig: path.join(root, "tsconfig.json"),
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron", "better-sqlite3"],
      outfile: path.join(directory, "main.cjs"),
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 20000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_DATABASE="));
    expect(line, stdout).toBeDefined();
    const result = JSON.parse(line!.slice("GORTH_DATABASE=".length));
    expect(result).toMatchObject({
      settings: "retained",
      updated: "updated",
      tab: "Saved tab",
      bookmark: "Saved bookmark",
      group: "Saved group",
      profile: "Retained",
    });
    expect(result.tables.sort()).toEqual([
      "archived_tab",
      "bookmark",
      "download",
      "history",
      "profile",
      "recently_closed",
      "setting",
      "tab",
      "tab_group",
      "tab_group_member",
      "user_profile",
      "window",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
});
