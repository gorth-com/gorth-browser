# Database naming

Current table names: `profile`, `setting`, `tab`, `tab_group`, `tab_group_member`, `bookmark`, `history`, `recently_closed`, `window`, `archived_tab`, `download`, `user_profile`.

Drizzle table symbols use singular names with a `Table` suffix. Array payload
fields such as `tabs`, `bookmarks`, and `instances` remain plural collections.
Legacy names in migration maps, old fixture seeds and previously generated
migrations/snapshots are intentional; applied migration history is immutable.

`database/migrations/singular-table.ts` runs before schema initialization and
identity-cache access. It transactionally renames existing tables, preserves
rows/foreign keys, recreates named indexes, and is idempotent. If both old and
new tables exist, it refuses migration without merging or deleting data.

The database stays in the existing OS application-data directory, not cloud
PostgreSQL. A backup was created next to it before the 2026-10-09 migration:

`gorth-browser.before-singular-1791531328822.db`

Vitest verifies row/blob preservation, unique indexes, foreign keys, repeated
migration and rollback. An isolated native Electron fixture also verifies session
restore with the real better-sqlite3 driver.
