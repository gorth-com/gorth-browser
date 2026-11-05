import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";

it("renders Get started, signed-in state, startup selection and portal toasts in real Electron", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native UI verification requires GUI permission outside the sandbox.",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electron = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electron,
    "dist",
    (await readFile(path.join(electron, "path.txt"), "utf8")).trim(),
  );
  const directory = await mkdtemp(path.join(tmpdir(), "gorth-browser-setup-"));
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/browser-setup"),
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    await bundle({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/browser-setup/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "main.cjs"),
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 25000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_SETUP="));
    expect(line, stdout).toBeDefined();
    const { errors, result } = JSON.parse(line!.slice("GORTH_SETUP=".length));
    // Chromium reports deferred ResizeObserver delivery as a console error.
    // Retain and report it; it must not mask a React/renderer exception.
    const resizeWarnings = errors.filter((message: string) =>
      message.endsWith(
        "ResizeObserver loop completed with undelivered notifications.",
      ),
    );
    expect(
      errors.filter((message: string) => !resizeWarnings.includes(message)),
    ).toEqual([]);
    if (resizeWarnings.length)
      console.warn("Electron resize-delivery diagnostics:", resizeWarnings);
    expect(result).toEqual({
      guest: true,
      container: true,
      heading: "30px",
      profile: true,
      signedIn: true,
      portalToast: true,
      startup: true,
      newTab: true,
      errorToast: true,
      inlineError: true,
      blankPreview: true,
      appearance: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 60000);
