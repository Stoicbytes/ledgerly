# 0003. Load once, save changes as one atomic batch

- Status: Accepted
- Date: 2026-10-08

## Context

Screens were built first on in-memory stores. Saving had to be added without rewriting them, work
offline for short periods, and never leave half a change saved (an expense without its splits, a
redemption without the purchase it relies on).

## Decision

After sign-in, `load_ledger()` returns everything the user owns. `cloudSync` watches the stores,
diffs them by id against the last saved copy, and sends one `sync_ledger(changes)` batch shortly
after each burst of changes. The batch is one transaction; deferred constraint triggers check
cross-row rules at the end. A refused batch is rolled back in the app by reloading.

## Consequences

- Screens keep calling the same store actions in preview and signed-in modes.
- The load grows with history. Watch: when it passes ~1 MB or ~1 s, move to incremental sync
  (`updated_at` cursors and tombstones) and per-area loading.
- Two devices editing the same row at once: last write wins per row. Acceptable for one owner;
  revisit if sharing is ever added.
