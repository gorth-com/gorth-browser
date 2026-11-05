# Get started

The settings page keeps the existing `Wrapper` container. Its heading is shared
with Shortcuts through `components/heading.tsx`; cards use the existing Primitive
components and the app's portal-backed toast provider.

- Better Auth login, registration, account switching, unlock and logout retain
  the existing main/preload authentication boundary.
- Profile name/icon are local browser preferences, not an SSO identity change or
  a separate Chromium profile. The account settings link opens the existing page.
- Startup supports a new tab, restoring the last session (the default), or up to
  20 HTTP(S) URLs. Non-restore startup opens one window; the setting applies on the
  next launch/window initialization, not by closing current tabs.
- New tabs can show the existing dashboard or a blank page. Appearance opens the
  existing customization page; changes propagate to open windows.
- Import accepts bookmarks HTML and exported Gorth setup JSON. Only HTTP(S)
  bookmarks are accepted, duplicates are skipped, and existing data is retained.
  Export contains setup preferences only, never auth credentials or cookies.
  Passwords and foreign browser-specific settings are not imported.
- Default-browser status is checked by Electron for packaged apps. macOS and
  Windows buttons open OS settings for user confirmation. Packaged macOS builds
  declare HTTP/HTTPS protocols; external links are validated and queued until the
  renderer has restored its session. Development Electron is not advertised as a
  default browser. Linux currently gives manual system-settings instructions.
- macOS Dock pinning is manual: the button reveals the installed app in Finder.
  The UI does not pretend that Electron can detect or persistently pin a Dock item.

Setup data uses the existing SQLite settings store; no schema migration or new
dependency is required. Every new IPC operation validates the trusted main frame.
Native UI tests use an isolated temporary profile and mocked OS actions, never the
user's live profile or default-browser associations.
