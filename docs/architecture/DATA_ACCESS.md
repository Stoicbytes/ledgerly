# Data access: every call to Supabase

The complete list of what the apps ask Supabase for, what triggers it and why it is needed.
Audited from the code in October 2026 ([audit report](AUDIT_2026-10.md)). Counts and
frequencies are derived from the code paths and unit tests, **not measured against a live
project**.

## Rules the code follows

1. **One door.** In the dashboard only `apps/command-center/src/lib/data/` may talk to Supabase
   (ESLint `no-restricted-imports`). Screens call stores; stores call repositories.
2. **Functions, not tables.** Data goes through Postgres functions (RPCs), never
   `select * from table` from the browser. Each function runs as the signed-in user
   (`security invoker`), so Row Level Security decides what is visible. Only three functions run
   with elevated rights, and all of them are for the public portfolio (Q20–Q22).
3. **Load once, save differences.** After sign-in the whole ledger is loaded in one call (Q1).
   Edits change the in-memory stores immediately; about 0.6 s later the difference from the
   last saved copy goes to the database as one atomic batch (Q2). Nothing re-loads after a
   successful save.
4. **No polling, no realtime.** Nothing refreshes on a timer. Data reloads when you come back
   to the app (Q1); prices change only on **Update prices** or the server's schedule.
5. **Only the publishable key** is sent from browsers, with the user's own access token. Secret
   and service-role keys are refused by the code and exist only in Edge Function secrets.

## Inventory

### Dashboard: money and notes

| ID  | Call (file)                                         | Operation                                       | Trigger                                                                                                                                                                                                        | Data                                                                                                                                                                 | Frequency                                                                  | Verdict                                                                          |
| --- | --------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Q1  | `load_ledger` (`ledgerRepository.loadCloudData`)    | RPC, read                                       | Sign-in (`cloudSync.startCloudSync`); **Try again** after a failed load; after the database refuses a save; **coming back to the app** (`refreshCloudData`: at most once a minute, never with an unsaved edit) | All of the user's accounts, categories, people, transactions (+ splits, repayments), notes, recurring entries (0012), funds, SIPs, fund transactions, stocks, trades | Once per sign-in, plus once per return to the app (a minute apart at most) | Essential. Grows with history (no paging); fine at personal scale, see Remaining |
| Q2  | `sync_ledger` (`ledgerRepository.saveChanges`)      | RPC, write (upserts + deletes, one transaction) | Any store change, debounced 600 ms; retried with back-off (1 s → 30 s) when offline; sent at once when the tab is hidden and before sign-out                                                                   | Only the rows that changed                                                                                                                                           | Once per burst of edits                                                    | Essential. Idempotent (upsert by id), so retries cannot double-write             |
| Q2a | `sync_ledger` (`restoreBatches.saveRestoreBatches`) | RPC, write (upserts only)                       | Settings → Restore from backup, after the review                                                                                                                                                               | Missing records from a backup file, one list per call, ≤ 4,000 rows / ~4 MB                                                                                          | Rarely                                                                     | Same function and checks as Q2; never deletes. Followed by one `load_ledger`     |
| Q2b | `reset_data` (`resetRepository.resetData`)          | RPC, write (deletes, one transaction)           | Settings → Reset data, after typing RESET                                                                                                                                                                      | One part of the ledger                                                                                                                                               | Rarely                                                                     | Destructive by design; locked behind a typed confirmation                        |

### Dashboard: market data

| ID  | Call (file)                                                           | Operation         | Trigger                                                                                                                                               | Data                                                                                                      | Frequency                                                                    | Verdict                                                                               |
| --- | --------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Q3  | `load_market` (`marketRepository.loadMarket`)                         | RPC, read         | After Q1 at sign-in; after **Update prices**; **after a save that adds a fund linked to an AMFI scheme or a share with an ISIN** (added in the audit) | Latest NAV/price and up to 400 days of history (monthly before that) for **held** schemes and shares only | Once per sign-in, plus the cases above                                       | Essential. The new trigger fixed new holdings showing no value until the next sign-in |
| Q4  | `search_funds` (`FundSearch`)                                         | RPC, read         | Typing in "Search AMFI funds": at least 3 characters, 300 ms after the last keystroke; older answers are ignored                                      | Up to 25 matching schemes                                                                                 | Per pause in typing                                                          | Essential                                                                             |
| Q5  | `search_securities` (`StockSearch`)                                   | RPC, read         | Same as Q4, for shares                                                                                                                                | Up to 25 matching NSE/BSE securities                                                                      | Per pause in typing                                                          | Essential                                                                             |
| Q6  | `nav_on` (`NavLookup`)                                                | RPC, read         | The "Use AMFI NAV for this date" button                                                                                                               | One NAV                                                                                                   | On demand                                                                    | Essential                                                                             |
| Q7  | Edge Function `market-refresh` (`refreshMarket`)                      | HTTPS POST        | **Update prices**; also the server's daily schedule (pg_cron), not the app                                                                            | Server downloads AMFI and exchange files and stores them (service role, server only)                      | On demand; the function refuses a user call more often than every 30 minutes | Essential                                                                             |
| Q26 | `load_stock_benchmark`, `set_stock_benchmark` (`benchmarkRepository`) | RPC, read / write | Opening Stocks → **vs Index**; choosing a fund; after **Update prices** in that sheet                                                                 | The chosen fund and its daily NAVs from 10 days before the first share trade (about 250 points a year)    | Per opening of the sheet                                                     | Optional feature; nothing loads until the sheet opens                                 |

### Dashboard: portfolio editor

| ID  | Call (file: `siteRepository` / `storageRepository`) | Operation     | Trigger                                                                             | Frequency        | Verdict                                                     |
| --- | --------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| Q8  | `portfolio_load`                                    | RPC, read     | First visit to the Portfolio tab in a session (the screen stays mounted); **Retry** | Once per session | Essential                                                   |
| Q9  | `portfolio_save`                                    | RPC, write    | Save in an editor sheet; the show/hide (draft) button                               | Per save         | Essential (the database re-checks every field)              |
| Q10 | `portfolio_delete`                                  | RPC, write    | Delete in an editor sheet; deleting a message                                       | Per delete       | Essential                                                   |
| Q11 | `portfolio_reorder`                                 | RPC, write    | Each up/down arrow press                                                            | Per press        | Essential; several moves = several small calls (acceptable) |
| Q12 | `portfolio_mark_message`                            | RPC, write    | Mark as read/new, Reply                                                             | Per action       | Essential                                                   |
| Q13 | `portfolio_publish`                                 | RPC, write    | Publish (after confirming)                                                          | Per publish      | Essential                                                   |
| Q14 | `portfolio_unpublish`                               | RPC, write    | Take the site offline                                                               | Rare             | Essential                                                   |
| Q15 | `portfolio_preview_token`                           | RPC, write    | Preview                                                                             | Per preview      | Essential                                                   |
| Q16 | `portfolio_media_paths` + Storage list + delete     | RPC + Storage | After each publish: removes uploads nothing uses that are over an hour old          | Per publish      | Essential (keeps Storage tidy); failures are ignored        |
| Q17 | Storage upload (`portfolio-media`)                  | Storage write | Choosing an image (full + small copy) or the résumé PDF                             | Per upload       | Essential                                                   |

### Dashboard: receipt photos (`storageRepository`, private bucket `receipts`, migration 0011)

| ID  | Call                                   | Trigger                                                   | Frequency        | Verdict                                          |
| --- | -------------------------------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| Q23 | Storage upload (`uploadReceiptFile`)   | Picking a photo in the entry sheet (signed in)            | Per photo        | Essential                                        |
| Q24 | Signed link (`signedReceiptUrl`, 60 s) | A stored photo is shown (thumbnail in the sheet, viewer)  | Per photo shown  | Essential (the bucket is private)                |
| Q25 | Storage list + delete                  | After the load at sign-in: unused files a day old or more | Once per sign-in | Essential (keeps Storage tidy); failures ignored |

### Sign-in (Supabase Auth, `authRepository` / `mfaRepository`)

| ID  | Call                                                                                                                                                   | Trigger                                                 | Network?                                        | Verdict                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Q18 | `getSession`, `onAuthStateChange`, `getAuthenticatorAssuranceLevel`                                                                                    | App start; every auth event; before each RPC (`rpc.ts`) | No (local), except a token refresh when expired | Essential. At start the two-step check runs twice (explicit check and `INITIAL_SESSION`); both are local reads, so left as is |
| Q19 | `signInWithPassword`, `resetPasswordForEmail`, `updateUser`, `signOut`, `mfa.listFactors` (Settings), `mfa.enroll` / `challengeAndVerify` / `unenroll` | User actions only                                       | Yes                                             | Essential                                                                                                                     |

Token refresh happens automatically about once an hour on the web, and only while the app is in
the foreground on phones.

### Public portfolio (`apps/portfolio`, the site's home page)

| ID  | Call                       | Runs as                                       | Trigger                                                                                           | Frequency                                                                               | Verdict   |
| --- | -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| Q20 | `portfolio_public(handle)` | Anyone (security definer, read-only snapshot) | Server render of `/`, `/projects/…`, `/sitemap.xml`; the browser re-checks a page older than 30 s | Once per page render that misses the 60 s edge cache, plus at most one browser re-check | Essential |
| Q21 | `portfolio_preview(token)` | Anyone with a valid link                      | Opening a preview link                                                                            | Per preview                                                                             | Essential |
| Q22 | `portfolio_contact(…)`     | Anyone (checks and limits in the database)    | Submitting the contact form (button disabled while sending)                                       | Per message; 3 per 10 min and 10 per day per network, 100 per day in total              | Essential |

### Server only (never from browsers)

`market-refresh` (Edge Function, service role) calls `market_run_start`, `market_held_schemes`,
`market_ingest_schemes`, `market_ingest_prices`, `market_ingest_nav_history`,
`market_run_finish`; the daily pg_cron job calls the function. Triggers rebuild portfolio
snapshots (`portfolio_prepare_publication`, `portfolio_prepare_preview`) and write audit
entries.

## Audit result

- **Removed:** none. No call was found to be unnecessary: there is no polling, no duplicate
  fetching across screens (each kind of data has one store that loads it once), no
  `select *` from the browser, and no refetch after a successful save.
- **Added:** one trigger for Q3 (a save that adds a priced holding), because without it new
  holdings had no prices until the next sign-in.
- **Changed timing:** Q2 is now also sent the moment the tab is hidden (so a change made just
  before closing a phone tab is not lost), and the app asks before the page is left or the user
  signs out with a change still unsent.
- **Left as is, with reasons:** the duplicated local two-step check at start-up (Q18, no network);
  one call per reorder press (Q11, rare and tiny).

## Remaining

- Q1 loads all history at once. At personal scale this is one small request; after many years
  it should move to loading by period (the roadmap's incremental sync).
- Data changed on another device appears when you come back to the app, not while you are
  looking at it (see [EDGE_CASES.md](EDGE_CASES.md)).
- Call counts above have not been measured against the live project; a quick check is to open
  the browser's Network tab, filter by `rpc/`, and sign in, add an expense, and add a fund.
