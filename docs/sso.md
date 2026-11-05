# Browser: Better Auth Electron

Identity belongs to Gorth SSO. The desktop app has its own native Better Auth session on the corresponding website backend; it does not share the browser's cookie or the central SSO session.

```text
Electron main.requestAuth()
  → Browser Website /auth/desktop
  → Generic OAuth gorth (prompt=select_account) → Gorth SSO
  → website /auth/callback/gorth → /auth/desktop/complete
  → electronProxyClient.ensureElectronRedirect()
  → com.gorth.browser://auth/callback#token=…
  → Electron SDK authenticate() → native app session
```

## Environment

| Context | Variable | Local value |
| --- | --- | --- |
| Desktop renderer/main | VITE_PUBLIC_APP_URL | http://localhost:5501 |
| Desktop auth backend | VITE_PUBLIC_AUTH_URL | http://localhost:5503 |
| Native SDK client ID | VITE_PUBLIC_OAUTH_CLIENT_ID | gorth-browser |
| Website SSO origin | NEXT_PUBLIC_AUTH_URL | http://localhost:3000 |
| Website OAuth client ID | NEXT_PUBLIC_OAUTH_CLIENT_ID | gorth-browser-website |
| Website app origin | NEXT_PUBLIC_APP_URL | http://localhost:5503 |
| Website private secret | NEXT_SESSION_SECRET | Existing secret value; never expose it |

There are no old SSO_* or VITE_APP_URL aliases. Keep the existing website secret when renaming NEXT_AUTH_SECRET to NEXT_SESSION_SECRET, because OAuth account tokens were encrypted with it. Configure production origins with HTTPS. The website must be running when signing in or verifying a native session.

## Boundaries

- Main owns the official SDK, OS protocol registration and SDK safeStorage-encrypted credentials.
- Preload exposes only the existing narrow account commands and public profile snapshots. Main checks the owned window, main frame and exact application renderer URL.
- SDK broad IPC bridges/CSP overrides are disabled so external web contents cannot invoke privileged SDK actions and existing browser content-blocker/CSP handlers remain intact.
- Login and account switching always start a new Generic OAuth request with account selection. A saved website session is not silently transferred.
- Callback codes, cookies, OAuth tokens and PKCE verifiers never cross the application's renderer IPC bridge.
- Local API identity uses verified SSO externalUserId/sub, not the website-local user UUID.
- Native pending login expires at 120 seconds. Cancellation fences late callbacks. Background app-session verification does not show the whole-app loading screen.
- Logout uses the official native signOut endpoint, removes the saved native credential, and never calls SSO end-session. The website's independent browser session remains valid.

## Migration

The previous custom OAuth browser vault is not imported into a native SDK session. Sign in once after upgrading. Existing SQLite tabs, groups, bookmarks and public profile cache are untouched. Launcher offline game profiles keep their separate encrypted vault.

No cloud schema change or SSO OAuth callback update is required for this integration. The Electron plugin uses the website's existing verification and session tables. Existing website Generic OAuth callbacks remain /auth/callback/gorth.

## SDK 1.7.7 compatibility

The package's declarations advertise kElectron, but its JavaScript client does not export it. Cancellation currently clears the SDK-owned PKCE map through its shared symbol; no application code generates or verifies PKCE. Recheck this small compatibility boundary when upgrading the paired Better Auth/Electron SDK versions. Native tests cover cancellation, timeout, account switching and server-side session deletion.

## Verification

- pnpm test (Vitest, including isolated real Electron windows)
- pnpm test:auth
- pnpm test:auth:ui
- pnpm test:server
- pnpm exec tsc --noEmit

Reference: [official Electron integration](https://better-auth.com/docs/integrations/electron).
