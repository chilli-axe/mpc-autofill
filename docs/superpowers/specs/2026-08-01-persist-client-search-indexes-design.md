# Persist Client-Side Search Indexes — Design

**Date:** 2026-08-01
**Status:** Approved
**Fixes:** chilli-axe/mpc-autofill#418 (discussion in #282, follows PR #358)

## Problem

Local-files and Google Drive client-side search indexes live only in memory.
Every page load, the user must re-pick their folder / re-run the Drive picker
and wait for a full re-index. For large libraries this takes long enough that
the feature is painful to use.

## Approach: persist documents + handles in IndexedDB, rebuild Orama on load

The expensive step is walking the folder / hitting the Drive API — not
building the Orama database (insertMultiple of a few thousand documents is
~100ms). So we persist the raw `OramaCardDocument` arrays and rebuild the
index on load.

`FileSystemFileHandle` / `FileSystemDirectoryHandle` objects are
structured-cloneable and can be stored in IndexedDB natively, so local-file
documents (whose `params` embed live file handles) persist as-is.

Rejected alternatives:
- `@orama/plugin-data-persistence` — serializes to JSON/binary, which would
  destroy the embedded file handles.
- Persisting only the directory handle and silently re-indexing on load —
  re-walking the folder every load is exactly the slowness complained about.

## Components

### `frontend/src/features/clientSearch/persistence.ts`

Small typed wrapper over raw IndexedDB (no new dependency): `save`, `load`,
`clear` for two entries plus a schema version:

- `localFiles: { directoryHandle, documents, indexedAt }`
- `googleDrive: { documents, indexedAt }`
- On schema-version mismatch or corrupt/unreadable data: treat as empty and
  clear the store.

Saves run after each successful index build, fire-and-forget (quota or other
errors are logged, never surfaced as failures).

### Restore flow

On client search service init, load both entries and rebuild the Orama
indexes through the existing document-insertion path. Search works
immediately; no permission prompt. Restore failure of any kind degrades to
today's empty state.

### Permission re-grant (local files)

Reading image *files* (thumbnails, export) needs handle permission again.
After restore, if `queryPermission({mode: "read"}) !== "granted"`, the
source-config UI shows a banner ("Re-grant access to show images") whose
click calls `requestPermission()` — satisfying the browser's user-gesture
requirement. Search never blocks on this.

### Re-sync + staleness

The source-config UI shows restored state ("<folder name> — N cards, indexed
<relative time>") with a **Re-sync** button that re-walks the folder /
re-fetches from Drive (Drive re-sync triggers re-auth as today) and
overwrites the stored entry. No automatic background re-sync.

## Error handling

Every persistence/restore operation is best-effort: failures log to console
and fall back to the un-persisted behavior. A fresh session can never be
broken by this feature.

## Testing

- Jest with `fake-indexeddb`: persistence module round-trip, restore rebuilds
  a searchable index, corrupt/old-version entries restore to empty and clear.
- Guard test: with nothing persisted, service behaves exactly as today.
- E2E cannot drive `showDirectoryPicker`, so local-folder flows are covered at
  the unit level; the Drive restore path gets a Playwright test if the
  existing MSW mocks support it, otherwise unit-level too.
