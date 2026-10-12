# 0009. Tradebooks read on the device, reviewed and approved before anything is saved

- Status: Accepted
- Date: 2026-10-11

## Context

Funds and shares were loaded once from the Zerodha tradebooks with a SQL file (ADR 0008). From now
on the owner downloads a new tradebook from Zerodha Console now and then and wants only the new
trades added, and only after checking them: "before adding, display the values, review them, and
approve them". A tradebook is a file the owner already holds. Reading it involves no third party
and no secret, and Zerodha's own files are `.xlsx` (CSV is also offered).

## Decision

- **Read on the device.** Mutual funds or Stocks → **Import** reads one or more tradebooks in the
  browser: `.xlsx` with a small zip and sheet reader (the browser's built-in `DecompressionStream`
  does the unzipping; no new library) or `.csv`. The file is not uploaded or kept.
- **Review, then approve.** For each fund or share the app shows the trades it would add (date,
  type, units or shares, NAV or price, amount), what is already in the app, and units and invested
  amount before → after. Each holding can be switched off. Nothing changes until **Approve and
  add**; then the approved trades are saved as one batch through `sync_ledger`.
- **The server still decides.** Saved rows go through the same Row Level Security, two-step
  sign-in, constraints and holding checks as rows typed by hand (a sale of units not held is
  refused). The device only proposes rows.
- **Matching.** Holdings match by ISIN, falling back to the fund name (Direct/Regular and
  punctuation ignored) or the share symbol. Migration 0009 gives funds an `isin` column, filled
  from the AMFI list or the ISIN the Zerodha load left in the fund's note. A trade already in the
  app (same date, type, units/shares and NAV/price) is not added twice; the same trade in two files
  is counted once by its trade ID.
- **Amounts as Kite shows them.** Amount = units × NAV (shares × price), rounded to the paisa;
  tradebooks have no stamp duty or charges.
- **Earlier sales left out.** If a file starts with sales of units bought before the file, the
  fewest such trades are left out (and listed) so that units never go below zero.

## Consequences

- Files never leave the device; nothing new runs on the server and no new dependency is added.
- Only Zerodha's tradebook layout is read today. Other brokers' files and CAMS/KFintech statements
  (PDF, password-protected) need their own readers; the CAS reader may run on the server.
- Choosing files works in the web app; the phone apps show a clearly marked "not yet" message.
- A new fund created by an import has no AMFI scheme yet (no automatic NAV) until it is edited and
  linked to its scheme.
- Trade and order IDs and the client ID in the file are not stored.
