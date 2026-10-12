# 0007. Import the old app's data inside the database, checked before it is kept

- Status: Superseded by [0008](0008-start-from-scratch.md) (withdrawn before it was ever run)
- Date: 2026-10-10

## Context

The old app kept each user's finances as JSON arrays in one `user_workspaces` row (rupees as
decimals, card balances as amounts owed, card payments that did not reduce the paying account).
The new app has typed tables with constraints and triggers. The owner needs to see that nothing
is lost or changed before trusting the move, and the import must be safe to repeat.

## Decision

- One `security invoker` function, `import_legacy_workspace(p_commit)`, reads only the caller's
  row and writes through the same RLS, two-step sign-in check, constraints and triggers as the
  app. No Edge Function and no service role.
- A **check** runs the real import inside a savepoint, builds the report from the rows it wrote,
  and rolls back; an **import** runs the same code and keeps the rows. What the check shows is
  what the import does.
- Each new row's id is derived from the user and the old id (`md5(user:kind:old id)`), and inserts
  skip existing ids, so a repeat adds only what is missing. No `legacy_id` columns are added to
  the app's tables. Accounts, categories and funds are matched by name to what is already there.
- The report compares the old app's numbers (by the old app's own rules) with the new rows, and
  states the known differences separately (card payments, rows that cannot come over), so the
  remaining difference should be zero.

## Consequences

- No new schema on the app's tables and no second copy of the import logic in the client.
- Right after thousands of inserts the planner's row estimates are stale; the report function
  turns off nested loops and JIT for itself so it stays fast.
- Very large histories could hit the API's statement timeout; the same function can be run from
  the SQL Editor as the user (documented in `SUPABASE_SETUP.md`).
- `user_workspaces` stays untouched until it is retired by a later migration after a backup.
