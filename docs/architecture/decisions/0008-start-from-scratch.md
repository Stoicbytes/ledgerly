# 0008. Start from scratch: retire the old app's data, load investments once

- Status: Accepted
- Date: 2026-10-10

## Context

An import of the old app's data with a check report (ADR 0007) was built and merged, but the owner
decided not to run it: the expense history in the old app is not wanted, and day-to-day spending
will come from the export of the app used today. The owner's mutual funds and shares are held
through Zerodha; a personal Excel tracker also recorded them, with gaps.

## Decision

- Migration 0008 permanently deletes the old app's tables and the functions that wrote them. The
  import migration, its Settings card and its code were removed before they ever ran.
- The ledger starts empty; the existing starter (usual categories and a Cash account) sets it up.
- Fund and share history is loaded once from the owner's Zerodha Console tradebooks with a SQL
  file run in the SQL Editor as the owner (same Row Level Security and checks as the app). It
  replaces only funds and stocks and refuses to commit unless units, invested amounts and shares
  match the owner's Kite holdings. A first load from the Excel tracker was replaced the same day:
  the sheet lacked trades (a later SIP instalment, extra buys and sales) that the tradebooks have.
  The file held personal data; after it was run it was removed from the repository (October
  2026). Later loads use the in-app tradebook import ([ADR 0009](0009-tradebook-import-on-device.md)).
- The next importer is built around the export file of the app used today, together with export.

## Consequences

- No code path in the app for one-off migrations; the repository holds only reusable features.
- Funds sold in February 2025 are left out: their purchases predate the tradebooks provided.
- The tradebooks carry no stamp duty or charges, so invested amounts follow Kite's units × price.
- Digital gold, PF history and salary rows from the Excel wait for their own modules.
- A reusable tradebook importer in the app (upload each month, only new trades added) is the next
  step for investments.
