# Vitest

`pnpm test:dashboard` runs `tests/vitest/shared-ui-native.test.ts` against real
Electron windows with both a Vite dev server and a production bundle, including
a separate account-menu portal. The dev cache is temporary, not node_modules.
It uses synthetic
auth/navigation callbacks and temporary userData/sessionData; it is not a live
SSO test. The old standalone dashboard runner has been replaced by this fixture.

Run from this application's root:

```bash
pnpm test
pnpm test:watch
pnpm test:window
pnpm test:unit
pnpm exec tsc --project tests/tsconfig.json --noEmit
```

`vitest.config.ts` uses the Node environment and the application's `@` alias.
New Vitest tests belong in `tests/vitest/**/*.test.ts` or `*.test.tsx`.
Existing scripts and legacy tests outside that folder retain their own commands;
`pnpm test` does not run or migrate those legacy suites.

## Native window smoke test

The macOS auth callback test is separate:

```bash
pnpm exec vitest run --configLoader runner --no-cache --no-fsModuleCache tests/vitest/auth-callback-native.test.ts
```

It starts real Electron with an isolated profile, compiles the production macOS
callback applet, registers a unique test URL scheme, opens a synthetic callback
through LaunchServices, and verifies delivery to the original process. The
generated bundle/profile live in an exact disposable fixture directory because
LaunchServices ignores handlers in the OS temp directory. The test unregisters
its own bundle and removes generated data; it never registers the production
Browser/Launcher scheme or uses a real login. Missing Electron binaries or GUI
permission fail verification instead of being counted as a pass.

The test bundles the production `main/windows/capital.ts` factory and
`app/preload.ts`, then starts a real Electron process with a small HTML fixture.
It checks that the window is visible, has the correct title and nonzero bounds,
loads its renderer, exposes the preload RPC bridge without Node globals, retains
an isolated, sandboxed preload, and closes. A test-only preload wrapper imports
the production preload and reports its security state using public Electron APIs.

Six native cases cover normal window closure, OS `SIGINT`, OS `SIGTERM`,
the development HTTP server stopping while the parent remains alive, a Forge-like
parent exiting on Ctrl+C, and that isolated parent being killed with SIGKILL
(bypassing all parent cleanup). Only the temporary driver is killed; Electron
must still gracefully exit through its lifecycle watcher. All cases
must emit `before-quit` and `will-quit` and exit with code zero. Successful tests
use `app.quit()`, not forced `app.exit()` or `window.destroy()`.

`pnpm test:unit` verifies Forge signal forwarding/cleanup, parent-process loss,
server-probe recovery, and packaged-app exclusions without opening Electron.
Browser replaces database, blocker, tab-lifecycle, and context-menu service dependencies with fixture stubs; those services are not covered by this smoke test.

This is a basic native-window integration test, not an end-to-end test of the full
React application, authentication, restored sessions, or external websites.

Each run creates a temporary `userData`/`sessionData` profile and removes it after
Electron exits. It does not use `.env.local` or the user's live application data.

The test requires a graphical desktop session and an installed Electron binary.
If installation scripts did not download the binary, install it explicitly:

```bash
node node_modules/electron/install.js
```

On headless Linux, run with a virtual display such as
`xvfb-run -a pnpm test:window`. A sandbox that prevents native windows must allow
the Electron child process. Missing binaries or unavailable displays fail the
test instead of silently skipping it.

On macOS, Codex's restricted `seatbelt` environment cannot register a GUI app
with LaunchServices and can abort Electron before its JavaScript runs. Native
tests now fail before spawning in that known environment, with an actionable
permission error instead of generating a macOS crash dialog. Approve the native
test command outside that sandbox or run it in macOS Terminal; never disable
Electron's renderer sandbox to work around host permissions.

## Tab layout

`tests/vitest/tab-layout.test.ts` covers persisted Separate/Compact preferences,
backward compatibility, proportional tab sizing and native webview chrome insets.
`tests/vitest/tab-layout-native.test.ts` bundles the real renderer components
and Tailwind stylesheet into a temporary fixture, then opens real Electron/Chromium.
It verifies the 180px/360px maximums, the 2:1 ratio when resizing, overflow controls,
grouped and pinned tabs, active-tab URL editing/selection/submission/Escape/blur,
middle-click closure, shared navigation controls and returning to Separate.

The renderer bridge is stubbed: this test checks UI behavior, not live websites,
downloads, menu portals or authentication. It uses a disposable profile, does not
load `.env.local`, and requires GUI permission like the window smoke test.

Run just the layout tests with:

```bash
pnpm exec vitest run tests/vitest/tab-layout.test.ts tests/vitest/tab-layout-native.test.ts
```

## Development shutdown

`dev` still runs `electron-forge start`. The Forge `postStart` hook forwards
termination before Vite's immediate SIGINT exit handler and covers parent exit.
The Electron main process gracefully quits on SIGINT/SIGTERM, a missing parent,
or two consecutive failed Vite server probes. A healthy response resets the
failure counter, and watchers detach during shutdown. Packaged apps are excluded.

References: [Forge hooks](https://www.electronforge.io/config/hooks),
[Electron app lifecycle](https://www.electronjs.org/docs/latest/api/app).

Configuration reference: [Vitest documentation](https://vitest.dev/config/).
