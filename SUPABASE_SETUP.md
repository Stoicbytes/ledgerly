# Supabase setup

Ledgerly (`apps/command-center`) uses one hosted Supabase project for sign-in and data.
This page lists what is set up on the Supabase side and how to manage it. Connecting the app
(the two `EXPO_PUBLIC_` variables on Vercel) is in
[`apps/command-center/README.md` → Sign-in](apps/command-center/README.md#sign-in).

> **Migrations.** `supabase/migrations/` holds everything a new project needs, in order, starting
> with `202610080004_foundation.sql`. CI applies all of them twice to an empty database
> (`supabase/tests/fresh_install.sh`). New database changes add new numbered files there.

## What is in the database

| Part                                                | From                | Used by                                                    |
| --------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| Sign-up allowlist and its Before User Created hook  | 0004                | Every new account (only allowlisted emails can sign up)    |
| `audit_logs`, `internal.log_audit`                  | 0004                | Every change, recorded by column name, never the values    |
| Finance and notes tables                            | 0005                | The Ledgerly                                               |
| `load_ledger()` and `sync_ledger(jsonb)`            | 0006, replaced 0007 | The Ledgerly, to load and save (now including investments) |
| Mutual fund and stock tables                        | 0007                | Mutual funds and Stocks pages                              |
| `mf_funds.isin`, `sync_ledger` saving it            | 0009                | Matching tradebook imports to your funds                   |
| Market data tables and their functions              | 0007                | Prices, written only by the `market-refresh` Edge Function |
| Portfolio tables, functions and `portfolio-media`   | 0010                | Dashboard → Portfolio, and the public portfolio site       |
| `transactions.receipt`, private `receipts` bucket   | 0011                | Receipt photos on entries (only you can see them)          |
| `recurring_entries`, `load_ledger`/`sync_ledger`    | 0012                | Recurring entries (rent, subscriptions, EMIs)              |
| `investment_goals`, fund expense ratio, SIP step-up | 0013                | Mutual funds → Insights (goals, costs) and SIP step-up     |
| `stock_benchmarks`, index fund NAV history          | 0014                | Stocks → vs Index                                          |
| `notes.remind_on`, `notes.trashed_at`               | 0015                | Notes → reminders and Recently deleted                     |
| `employers`, `payslips`, `pf_entries`               | 0016                | Salary & PF (payslips across employers, the PF passbook)   |

`internal` (allowlist, hook, helpers) is not exposed through the Data API, so none of it is
reachable from the browser.

## One-time setup checklist

1. **Migrations applied, in order:** every file in `supabase/migrations/`, oldest first, from
   `202610080004_foundation.sql` to `202610170017_drop_unused_tables.sql` (SQL Editor → paste →
   Run). Each file is safe to run again.
2. **Sign-up hook on:** Authentication → Hooks → Before User Created → Postgres → schema `internal`,
   function `before_user_created`. Add your own email to the allowlist first (below). The **Allow new users to sign up** switch can stay off as a
   second layer.
3. **Two-step sign-in available:** Authentication → Multi-Factor → TOTP enabled (on by default).
4. **Redirect URLs:** Authentication → URL Configuration → add
   `https://ledgerly.vercel.app/reset-password` (and
   `http://localhost:8081/reset-password` for local development). Set the Site URL to
   `https://ledgerly.vercel.app`.
5. **Keys:** the app uses only the **Project URL** and the **publishable** key. Never use the
   secret or service-role key anywhere in the app or its Vercel variables.
6. **Prices (optional, recommended):** deploy the `market-refresh` Edge Function and its daily
   schedule ([below](#prices-the-market-refresh-function)). Without it, funds and stocks work
   with NAVs and prices you enter by hand.

## Managing access (SQL Editor)

```sql
-- Let someone sign up
insert into internal.auth_allowlist (email, note) values ('person@example.com', 'why');
-- Remove them from the list (it does not delete an existing account)
delete from internal.auth_allowlist where email = 'person@example.com';
```

## Finance and notes tables (migration 0005)

`accounts`, `categories`, `people`, `transactions`, `transaction_splits`, `repayment_settles` and
`notes`.

- Every row belongs to the signed-in user; others cannot read, change or link to it (RLS plus
  composite foreign keys).
- Accounts with two-step sign-in turned on must enter the code before these tables open (`aal2`,
  enforced by the database).
- The rules the app checks (amounts, transfer accounts, category types, split totals, note sizes)
  are also enforced by the database.
- Changes are recorded in `audit_logs` by column name only.

## Loading and saving (migration 0006)

`load_ledger()` and `sync_ledger(jsonb)` run as the signed-in user (`security invoker`), so Row
Level Security, two-step sign-in and every rule from 0005 still apply. They let the app read
everything in one request and save a batch of changes all at once (all or nothing).

Signed in, the app shows **your** data (empty at first) and saves changes automatically; the
badge next to the page title reads **Saved**, **Saving…** or **Offline · will retry**. Receipt
photos are saved once migration 0011 is applied (see below).

## Mutual funds and stocks (migration 0007)

Run `202610090007_investments.sql` after 0006. It adds:

- **Your investments:** `mf_funds`, `mf_sips`, `mf_transactions`, `stocks`, `stock_trades`, with the
  same protections as the ledger (own rows only, two-step sign-in, composite keys, audit by column
  name). The database also refuses a redemption or sale of more units or shares than were held on
  that date, and an SIP instalment that belongs to another fund.
- **Market data:** `mf_schemes` (AMFI list with the latest NAV), `mf_nav_history` (only for
  schemes someone holds), `securities` and `security_prices` (end-of-day prices; history only for
  held shares) and `market_refresh_runs` (a log of every update). Signed-in users can only read
  them; only the service role (the Edge Function) writes.
- **Functions:** `load_market()`, `search_funds(text)`, `search_securities(text)`,
  `nav_on(integer, date)` for the app; `market_*` functions for the Edge Function only.
- `load_ledger()` and `sync_ledger(jsonb)` are replaced to carry the new tables (same rules).

The file ends with a commented rollback.

## Fund ISINs for imports (migration 0009)

Run `202610110009_fund_isin.sql` after 0007. It gives each
fund an `isin` column, which **Import** uses to match tradebook rows to the right fund, and fills it
in for the funds you have: from the fund's AMFI scheme, or from the "ISIN …" note the Zerodha load
left (that note is then cleared). `sync_ledger` is replaced to save the new column (nothing else in
it changes) and `search_funds` also returns each scheme's ISIN. Safe to run again. The file ends
with a commented rollback.

How the import itself works: [`docs/features/INVESTMENTS.md`](docs/features/INVESTMENTS.md#import-a-tradebook-zerodha).

## Public portfolio (migration 0010)

Run `202610120010_portfolio.sql` after 0009. It adds the portfolio you edit under Dashboard →
Portfolio and publish to the public site (`apps/portfolio`); how it works:
[`docs/features/PORTFOLIO.md`](docs/features/PORTFOLIO.md). Safe to run again; the rollback is
in the comment at the top of the file.

- **Tables:** the working copy (profile, links, numbers and highlights, skill areas and skills,
  projects, experience, education, extra sections) with the same rules as the ledger (own rows,
  two-step sign-in, checks, audit by column name); `portfolio_publications` (the published
  snapshot), `portfolio_preview_tokens` (20-minute preview links, hash only) and
  `portfolio_messages` (contact form). Rate-limit data is in `internal`.
- **Functions anyone may call:** `portfolio_public(handle)` (the published snapshot only),
  `portfolio_preview(token)` (a valid preview link only) and `portfolio_contact(…)` (checks,
  limits, stores the message). Everything else needs your signed-in session.
- **Storage:** the file creates the public bucket `portfolio-media` (5 MB per file; WebP, JPEG,
  PNG, AVIF and PDF only) and its policies. Anyone can open a file by its address. Only you can
  list, add or delete files, only in the folder named after your user id, and adding or deleting
  needs two-step sign-in; files cannot be overwritten. Check under **Storage** that the bucket
  exists and that **Storage → Policies** lists `portfolio_media_select`, `portfolio_media_insert`
  and `portfolio_media_delete`. If the SQL Editor refuses the `storage` part (it should not on a
  hosted project), create the bucket by hand with those settings and rerun the file.
- **No email:** messages from the contact form appear under Portfolio → Messages only.

**Starting content:** fill the portfolio in Dashboard → Portfolio (profile, links, skills,
projects, experience, education). Nothing is public until you Publish.

After running it: add `PORTFOLIO_HANDLE` to the Vercel project and redeploy
([`apps/portfolio/README.md`](apps/portfolio/README.md#deploy-on-vercel)); the portfolio is then
the site's home page. In Dashboard → Portfolio set the site address to the same handle, add your
content, use Preview, and Publish.

## Receipt photos (migration 0011)

Run `202610120011_receipts.sql` after 0010. Safe to run again; the rollback is in the comment at
the top of the file.

- **Storage:** the private bucket `receipts` (10 MB per file; JPEG, PNG, WebP, HEIC and HEIF only).
  Only you can see, add or delete files, only in the folder named after your user id, and all of
  it needs two-step sign-in when you have it turned on; files cannot be overwritten. Nobody can
  open a receipt by its address: the app shows each one through a link that stops working after
  a minute. Check under **Storage** that the bucket exists and is **not** public, and that
  **Storage → Policies** lists `receipts_select`, `receipts_insert` and `receipts_delete`.
- **Table:** `transactions.receipt` holds the stored file's path and size (the database refuses a
  path outside your own folder). `sync_ledger` is replaced to save it; nothing else changes.
- **Tidying:** a photo that was replaced or removed, or picked for an entry that was never saved,
  is deleted by the app at a later sign-in once it is a day old.
- **Before this migration** the app could not keep photos: a photo added while signed in
  disappeared on reload. Until it is applied, adding a photo shows "Could not upload the photo"
  (there is no bucket to put it in); entries without photos save as before.

## Recurring entries (migration 0012)

Run `202610130012_recurring.sql` after 0011. Safe to run again; the rollback is in the comment
at the top of the file.

- **Table:** `recurring_entries` (type, amount, accounts, category, note, how often, first date
  and next date), with the same rules as entries (own rows, two-step sign-in, checks, audit by
  column name). An account a recurring entry uses cannot be deleted; deleting a category clears
  it from recurring entries.
- **Functions:** `load_ledger` returns them and `sync_ledger` saves them; nothing else in either
  function changes.
- **Nothing is added by itself:** due dates wait on Expenses → Transactions to be added (amount
  can be changed) or skipped.
- **Before this migration** the app hides **Repeat** and the recurring list while signed in.

## Goals, expense ratio and SIP step-up (migration 0013)

Run `202610140013_fund_goals.sql` after 0012. Safe to run again; the rollback is in the comment
at the top of the file.

- **Table:** `investment_goals` (name, target amount, target date, the yearly return you assume),
  with the same protections as everything else (own rows, two-step sign-in, checks, audit).
- **Columns:** `mf_funds.expense_ratio` (0–5 %), `mf_funds.goal_id` (deleting a goal unties its
  funds) and `mf_sips.step_up_pct` (0–100 % a year).
- **Functions:** `load_ledger` returns goals and `sync_ledger` saves them and the new columns;
  nothing else changes.
- **Before this migration** the app hides goals, costs, the expense ratio field and the step-up
  while signed in; capital gains work without it.

## Shares against an index (migration 0014)

Run `202610150014_stock_benchmark.sql` after 0013. Safe to run again; the rollback is in the
comment at the top of the file.

- **Table:** `stock_benchmarks`, the index fund each user compares their shares with (one per
  user, own row only, two-step sign-in, audit).
- **Functions:** `set_stock_benchmark` and `load_stock_benchmark` (the user's own choice and the
  fund's daily NAVs from just before their first share trade). `market_ingest_schemes` and
  `market_held_schemes` now also cover chosen index funds, so the market-refresh function keeps
  their daily NAV and fetches older NAVs from mfapi.in. The Edge Function needs no redeploy.
- **Before this migration** Stocks → **vs Index** says which file to run.

## Note reminders and Recently deleted (migration 0015)

Run `202610160015_note_reminders.sql` after 0014. Safe to run again; the rollback is in the
comment at the top of the file.

- **Columns:** `notes.remind_on` (a date, 1990–2100) and `notes.trashed_at` (when the note was
  deleted). Deleted notes stay for 7 days, then the app removes them when it loads.
- **Functions:** `load_ledger` also returns `note_extras` so the app knows the columns exist;
  `sync_ledger` saves them. Everything else is unchanged from 0013.
- **Before this migration** the app hides reminders and Recently deleted while signed in, and
  deleting a note removes it at once (with Undo).

## Salary and PF (migration 0016)

Run `202610170016_salary_pf.sql` after 0015. Safe to run again; the rollback is in the comment at
the top of the file. How it works: [`docs/features/README.md`](docs/features/README.md#salary-and-pf).

- **Tables:** `employers` (name, joined and left dates; no ID numbers), `payslips` (one per
  employer and month: earnings and other deductions as lines, employee EPF, VPF, TDS, the
  employer's EPF and pension shares, the linked income entry) and `pf_entries` (the passbook:
  contributions, yearly interest with the declared rate, withdrawals, opening balances). Same
  rules as the ledger (own rows, two-step sign-in, checks, audit by column name).
- **Rules the database keeps:** pay never goes below zero; one payslip per employer and month;
  a contribution names its employer and wage month; interest has a rate; an employer with
  payslips or PF entries cannot be deleted; deleting a payslip deletes its contribution;
  deleting an income entry unlinks it from its payslip.
- **Functions:** `load_ledger` returns `employers`, `payslips` and `pf_entries`; `sync_ledger`
  saves and deletes them. Everything else is unchanged from 0015.
- **Before this migration** the Salary & PF page says the database needs updating.

## Removing unused tables (migration 0017)

`202610170017_drop_unused_tables.sql` deletes `profiles` and `user_preferences`, which the
original setup created for an earlier app (nothing reads them), with the trigger that filled them
for each new account. It is permanent; the tables hold no financial data. On a project built from
this folder they never existed and the file changes nothing.

## Bringing in existing funds and shares

Use **Import** on the Mutual funds and Stocks pages with your broker's tradebooks
([`docs/features/INVESTMENTS.md`](docs/features/INVESTMENTS.md#import-a-tradebook-zerodha)): you
review every trade before anything is saved. The one-time SQL loads used while the app was being
built have been run and were removed from the repository.

## Prices: the market-refresh function

`supabase/functions/market-refresh` downloads, on Supabase's servers, AMFI's daily NAV file and
the exchange end-of-day price file (NSE; BSE if NSE is unavailable), plus older NAVs from mfapi.in
for the schemes you hold. It never runs in the browser. Details:
[`docs/features/INVESTMENTS.md`](docs/features/INVESTMENTS.md#prices).

### 1. Deploy it (once; again only when the function changes)

**Option A, automatic from GitHub (recommended):** add two repository secrets
(GitHub → Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN`: create one at supabase.com/dashboard/account/tokens.
- `SUPABASE_PROJECT_REF`: the part of your Project URL before `.supabase.co`.

Then run **Actions → Deploy Edge Functions → Run workflow** (it also runs on every change to
`supabase/functions` on `main`).

**Option B, Supabase CLI:** `supabase functions deploy market-refresh --project-ref <ref> --no-verify-jwt`.

**Option C, dashboard:** Edge Functions → Deploy a new function → via editor, name it
`market-refresh`, add the files `index.ts`, `handler.ts` and `parse.ts` from
`supabase/functions/market-refresh/`, and turn **Verify JWT** off (the function checks callers
itself: a signed-in user's token, or the schedule's secret).

Test it: open the app signed in → Mutual funds → **Update prices**. The message says what was
updated; `market_refresh_runs` in the Table Editor shows each run.

### 2. Daily schedule (optional, recommended)

1. Make a long random secret (at least 24 characters) and add it as an Edge Function secret named
   `MARKET_REFRESH_SECRET` (Edge Functions → Secrets).
2. Database → Extensions: enable `pg_cron` and `pg_net`.
3. In the SQL Editor, store the URL and the same secret in Vault, then schedule two runs on
   weekdays: after the exchange file and AMFI NAVs are out (23:45 IST), and a morning catch-up
   (07:00 IST):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/market-refresh', 'market_refresh_url');
select vault.create_secret('<the MARKET_REFRESH_SECRET value>', 'market_refresh_secret');

select cron.schedule('market-refresh-evening', '15 18 * * 1-5', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
$$);
select cron.schedule('market-refresh-morning', '30 1 * * 2-6', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refresh-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
$$);
```

The secret is stored encrypted in Vault and as a function secret; it is never in the repository or
the app. To stop: `select cron.unschedule('market-refresh-evening');` (and `-morning`).

### Other settings and troubleshooting

- `ALLOWED_ORIGINS` (function secret, optional): the web addresses allowed to call the function,
  comma-separated. An entry may hold one `*` for one part of a host name (letters, digits,
  hyphens). Setting it replaces the defaults (`DEFAULT_ORIGINS` in
  `supabase/functions/market-refresh/parse.ts`): `https://ledgerly.vercel.app`,
  `https://ledgerly-stoicbytes-developers-team.vercel.app`, every deployment of the Vercel project
  (`https://ledgerly-*-stoicbytes-developers-team.vercel.app`) and `http://localhost:8081`. Set it
  only for an address outside these, such as a custom domain, and list the defaults too.
- "Automatic prices are not set up yet", or "The price function did not answer" while online:
  the function is not deployed (step 1), or the app's web address is not in `ALLOWED_ORIGINS`.
  "NAVs: not fetched yet" on the Funds page means no run has finished yet.
- A failed NSE run followed by an ok BSE run is normal if NSE refuses downloads from the server.
  If both fail, the run's message says why; values keep the last known price, and a price entered
  by hand (Edit stock / Edit fund) is used when it is newer.
- Share prices are end of day; there is no free official live-quote service.

## Two-step sign-in

Turn it on in the app under **Settings → Two-step sign-in**: scan the QR code with an
authenticator app (or type the setup key), then enter the first code. From then on, signing in
asks for your password and then the 6-digit code.

- **Day-to-day use:** tick **Keep me signed in on this device** at sign-in on your own phone or
  computer; the code is then asked for only when you sign in again. Choose the automatic sign-out
  under **Settings → This device**.
- If you lose the authenticator app, remove the factor in **Authentication → Users → (your user)
  → Multi-factor authentication**, then set it up again.

## Security boundaries

- Row Level Security is the security boundary; screens and route guards are convenience only.
- Table grants are revoked from `PUBLIC` and `anon`; only `authenticated` gets the operations it
  needs, and only on its own rows.
- No service-role keys, database passwords or admin tokens in the app, in `EXPO_PUBLIC_`
  variables, or in the repository.

## Verification before relying on it

Use two separate accounts in separate browsers. Confirm each sees only its own data, that a
signed-out session gets nothing, and that changing a `user_id` in a request is rejected. Use
HTTPS in production.
