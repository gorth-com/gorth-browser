import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "vite";
import { expect, it } from "vitest";
import { getElectronExecutable } from "../helpers/electron";

it("uses real React Query for Browser auth restore and IPC", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(path.join(tmpdir(), "gorth-query-state-"));
  try {
    await build({
      root,
      configFile: false,
      envDir: false,
      publicDir: false,
      logLevel: "error",
      cacheDir: path.join(directory, "cache"),
      define: { "process.env.NODE_ENV": '"development"' },
      resolve: {
        alias: [
          { find: "@/lib/auth/client", replacement: "\0mock-auth" },
          { find: "@", replacement: root },
        ],
      },
      plugins: [
        {
          name: "mock-auth-transport",
          load: (id) =>
            id === "\0mock-auth"
              ? "export function resetCallerAuthentication() {}"
              : undefined,
        },
      ],
      build: {
        outDir: directory,
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: path.join(root, "tests/fixtures/query-state/renderer.tsx"),
          name: "QueryFixture",
          formats: ["iife"],
          fileName: () => "renderer.js",
        },
      },
    });
    await build({
      root,
      configFile: false,
      envDir: false,
      publicDir: false,
      logLevel: "error",
      build: {
        ssr: path.join(root, "tests/fixtures/query-state/main.ts"),
        outDir: directory,
        emptyOutDir: false,
        rolldownOptions: {
          external: ["electron"],
          output: { entryFileNames: "main.mjs" },
        },
      },
    });
    await writeFile(
      path.join(directory, "index.html"),
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'"><body><script src="./renderer.js"></script></body>',
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      getElectronExecutable(),
      [path.join(directory, "main.mjs"), "--use-mock-keychain", directory],
      { env, timeout: 25000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_QUERY_STATE="));
    expect(line, stdout).toBeDefined();
    expect(JSON.parse(line!.slice("GORTH_QUERY_STATE=".length))).toEqual({
      browserAuth: true,
    });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 40000);
