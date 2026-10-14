# Database (Supabase Postgres)

What is in the database, who can touch it and how it changes. Migrations live in
`supabase/migrations/` and are run in order in the Supabase SQL Editor; setup steps are in
[`SUPABASE_SETUP.md`](../../SUPABASE_SETUP.md). The calls the apps make are listed in
[`DATA_ACCESS.md`](DATA_ACCESS.md).

## Security model in one paragraph

Every table that holds a user's data is created through one template,
`internal.secure_user_table`: Row Level Security is **forced**, `user_id` defaults to the caller
and can never be changed, foreign keys include `user_id` (a row can never point at another user's
row), a **restrictive** `<table>_mfa` policy requires an allowlisted email and the two-step code
(aal2) once the account has one (`internal.session_meets_mfa()`, 0005, allowlist added 0019), every
change writes an audit entry naming the columns (never the values), and `updated_at` is kept by a
trigger. Grants are revoked from `anon` and `PUBLIC`; the browser reaches data only through the
functions below. The `internal` schema is not exposed through the API. Since 0019 the same
restrictive policy is on every public table (market data and `audit_logs` included) and RLS is
forced on all of them; `supabase/tests/access_rules.sql` checks this in CI.

## Tables

| Group                    | Tables (migration)                                                                                                                                                                                        | Purpose                                                                                                   | Written by                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Identity                 | `audit_logs`, `internal.auth_allowlist` (0004)                                                                                                                                                            | The change log (column names only), the sign-up allowlist                                                 | Auth hooks and triggers; the owner (allowlist via SQL Editor)      |
| Ledger                   | `accounts`, `categories`, `people`, `transactions`, `transaction_splits`, `repayment_settles`, `notes` (0005)                                                                                             | Money in and out, who shares an expense, repayments, notes                                                | The owner, through `sync_ledger`                                   |
| Recurring                | `recurring_entries` (0012)                                                                                                                                                                                | Entries that repeat (rent, subscriptions, EMIs) and the next date not yet added or skipped                | The owner, through `sync_ledger`                                   |
| Goals                    | `investment_goals` (0013); `mf_funds.expense_ratio`, `mf_funds.goal_id`, `mf_sips.step_up_pct` (0013)                                                                                                     | Investment goals, fund expense ratios and SIP step-ups                                                    | The owner, through `sync_ledger`                                   |
| Salary and PF            | `employers`, `payslips`, `pf_entries` (0016): employers, monthly payslips with PF and TDS, the PF passbook                                                                                                | Pay across job changes; the PF balance (your share, the employer's, pension apart)                        | The owner, through `sync_ledger`                                   |
| Reset                    | `reset_data(scope)` (0018): deletes expense entries (or all of Expenses), mutual funds and goals, or shares, in one transaction                                                                           | Settings → Reset data                                                                                     | The owner, as themselves (RLS and two-step sign-in apply)          |
| Notes extras             | `notes.remind_on`, `notes.trashed_at` (0015): reminders and Recently deleted (7 days)                                                                                                                     | Note reminders and deleted notes waiting to be removed                                                    | The owner, through `sync_ledger`                                   |
| Benchmark                | `stock_benchmarks` (0014)                                                                                                                                                                                 | The index fund each user compares their shares with                                                       | The owner, through `set_stock_benchmark`                           |
| Investments              | `mf_funds`, `mf_sips`, `mf_transactions`, `stocks`, `stock_trades` (0007; `mf_funds.isin` 0009)                                                                                                           | Holdings, SIP plans and every purchase, redemption, trade, dividend, split and bonus                      | The owner, through `sync_ledger`                                   |
| Market data (shared)     | `mf_schemes`, `mf_nav_history`, `securities`, `security_prices`, `market_refresh_runs` (0007)                                                                                                             | AMFI schemes and NAVs, NSE/BSE securities and closing prices, a log of every refresh                      | Only the `market-refresh` Edge Function (service role); users read |
| Portfolio (working copy) | `portfolio_profile`, `portfolio_links`, `portfolio_facts`, `portfolio_skill_groups`, `portfolio_skills`, `portfolio_projects`, `portfolio_experience`, `portfolio_education`, `portfolio_sections` (0010) | What the owner edits in Dashboard → Portfolio                                                             | The owner, through `portfolio_save` / `_delete` / `_reorder`       |
| Portfolio (public side)  | `portfolio_publications`, `portfolio_preview_tokens`, `portfolio_messages` (0010)                                                                                                                         | The published snapshot (built by a trigger), 20-minute preview links (hash only), contact messages        | The owner; visitors only through three functions                   |
| Rate limiting            | `internal.portfolio_salt`, `internal.portfolio_contact_attempts` (0010)                                                                                                                                   | Salted IP hashes for the contact form, kept for a day                                                     | `portfolio_contact` only                                           |
| Storage                  | Bucket `portfolio-media` (0010)                                                                                                                                                                           | Portfolio images and résumé, under the owner's id; public read, owner write (two-step), never overwritten | The owner                                                          |
| Storage (private)        | Bucket `receipts` (0011); `transactions.receipt` (0011)                                                                                                                                                   | Receipt photos, under the owner's id; only the owner reads or writes (two-step), never overwritten        | The owner (upload from the app; path saved through `sync_ledger`)  |

Money is stored as integer paise, units and NAVs as exact 4-decimal numbers, dates as calendar
dates ([ADR 0005](decisions/0005-money-units-and-dates.md)).

## Rules the database enforces

Checks run on every write, whatever the app sends:

- Amounts positive, transfers between two different accounts, categories only on expenses and
  income and of the matching kind (`check_transaction_category`), a category's parent at the top
  level (`check_category_parent`).
- Only expenses can be split, and the shares cannot add up to more than the expense
  (`check_splits`); a repayment cannot settle itself.
- Fund units and share quantities never go below zero after a sale (`check_fund_units`,
  `check_stock_quantity`); a SIP belongs to its fund (`check_sip_fund`).
- Names unique per user where it matters (accounts, categories, people, stock symbols, skill
  areas); ISINs and links validated (`valid_isin`, `valid_link`); text lengths and list sizes
  bounded on free-text columns.
- Email addresses (`valid_email`, stricter since 0019): letters, digits and `. _ + -` before the
  `@`, a plain domain after it, so an address can never add parameters to a `mailto:` link.
- A receipt's path must be in the row owner's own folder, with an image type and size within
  limits (`valid_receipt`).

## Functions

| Function                                                                                                                                 | Runs as           | Used by                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------- |
| `load_ledger()`, `sync_ledger(jsonb)`, `sync_ledger_v2(jsonb)` (0020: skips and reports rows changed or deleted since `base_updated_at`) | The user (RLS)    | Dashboard sync                                      |
| `load_market()`, `search_funds`, `search_securities`, `nav_on`, `load_stock_benchmark()`, `set_stock_benchmark(int)`                     | The user (RLS)    | Funds and Stocks pages                              |
| `market_*` (ingest, run start/finish, held schemes, status)                                                                              | Service role only | `market-refresh` Edge Function                      |
| `portfolio_load`, `_save`, `_delete`, `_reorder`, `_mark_message`, `_media_paths`, `_publish`, `_unpublish`, `_preview_token`            | The user (RLS)    | Dashboard → Portfolio                               |
| `portfolio_public`, `portfolio_preview`, `portfolio_contact`                                                                             | Definer (narrow)  | The public site; the only functions `anon` may call |

All functions set an empty `search_path` and name every object with its schema.

## Indexes

Every table has its primary key; per-user unique keys where names must be unique;
`transactions (user_id, date)`, `notes (user_id, updated_at)`, `mf_funds (user_id, sort_order)`,
`mf_funds (user_id, isin)`; and indexes on every foreign key used in joins (fund, stock, account,
category, person, SIP, skill area). Market tables are indexed by scheme code, ISIN and symbol.
Query plans have not been measured on the live project; at personal data sizes every query is a
small scan.

## Changing the schema

1. Add a new numbered file in `supabase/migrations/` (never edit an applied one).
2. Use `internal.secure_user_table` for user tables, a `check` for every rule, and update
   `load_ledger` / `sync_ledger` if the data belongs to the ledger.
3. Run it against a fresh local Postgres (`supabase/tests/fresh_install.sh`, then
   `supabase/tests/access_rules.sql`) before shipping, then in the SQL Editor. A new public table
   must force RLS and have a restrictive `<table>_mfa` policy, or the access test fails.
4. Document it here and in `SUPABASE_SETUP.md`; record a decision in `decisions/` if it changes
   how things work.

## Deletion and retention

- Deleting an item in the app deletes the row (the audit log keeps that it happened, not what it
  contained).
- Contact-form rate-limit hashes are deleted after a day; preview links expire after 20 minutes;
  contact messages stay until the owner deletes them.
- Price history is kept only for schemes and shares someone holds.
- Account deletion and data export are not built yet. Today a full deletion is done by the
  project owner in the Supabase dashboard (database rows and the `receipts` and
  `portfolio-media` files).
- Receipt files no entry uses are deleted by the app at a later sign-in once they are a day old.
- `portfolio-media` is a public bucket: a file's address works for anyone who has it, including
  images of draft (hidden) items and items not yet published. Deleting an item does not delete
  its file; the editor removes files that neither the working copy nor the live site uses once
  they are an hour old, the next time Portfolio loads. Do not upload anything private there.
