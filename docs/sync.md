# Browser cloud sync

Open Settings → Sync after signing in. Sync is opt-in for each account and device;
only bookmarks are selected initially. Tabs are required for groups, and groups
and tabs are required for workspaces. Workspaces received from cloud/backups are
preserved; this desktop version does not yet include a workspace editor.

Main exchanges updates with the Browser Website every 30 seconds, or with Sync
now. The website must be deployed with `/sync/state` before enabling this version
of the desktop client. The existing Better Auth Electron client supplies its
native session cookie; credentials never cross the preload bridge.

Item IDs, timestamps and operation IDs determine conflict order. Keep device
clocks synchronized. Deletions remain tombstones so offline devices cannot
resurrect older versions. Pending edits and account-specific preferences survive
restarts in local SQLite settings. A failed request retains local data; the next
interval retries. Switching accounts does not enable sync for the new account.

Cloud backups are separate from automatic sync. Restore merges selected categories
and first uploads a safety backup. At the 50-backup limit, remove an unneeded
backup before restoring. Deletion and restore require confirmation. Cookies,
passwords, OAuth credentials, navigation history and local flags are excluded.

Current bounds: 2 MiB / 20,000 records per account, including tombstones. No
automatic tombstone pruning is performed, since an offline device may return.
Imported tabs use native restore/lifecycle policies, with no remote navigation stack.
Automatic sync targets the first open Browser window; persistence captures changes
from all windows, and missing items in a different window do not count as deletion.

Tests: `deno task test tests/vitest/sync.test.ts tests/vitest/sync-service.test.ts`.
The native window suite is `deno task test:window` and requires desktop GUI access.
