# Go-live checklist

The one ordered list for taking Ledgerly live. Work top to bottom; each step says where to click
and how to check it. Details live in [`SUPABASE_SETUP.md`](../SUPABASE_SETUP.md) and
[`apps/command-center/README.md`](../apps/command-center/README.md). Anything marked _check in
your plan_ depends on your Supabase, Vercel or GitHub plan: limits and features change, so
confirm them on the provider's pricing page rather than relying on this file.

## 1. Supabase database

1. **Migrations, in order**, in the SQL Editor (paste, Run), oldest first:
   `0004` foundation, `0005` core finance, `0006` ledger sync, `0007` investments, `0009` fund
   ISIN, `0010` portfolio, `0011` receipts, `0012` recurring, `0013` fund goals, `0014` stock
   benchmark, `0015` note reminders, `0016` salary and PF, `0017` drop unused tables, `0018`
   reset data. There is no `0008`. Each file is safe to run again.
   - **When merged** (open pull requests; apply after the ones above, in number order):
     `0019` security hardening, `0020` sync conflicts.
   - Check: Table Editor shows `transactions`, `mf_funds`, `payslips`, `pf_entries`; SQL
     `select public.load_ledger();` as a signed-in user (from the app) loads without an error.
2. **Allowlist and hook:** add your email to the allowlist (SQL in SUPABASE_SETUP.md →
   Managing access), then Authentication → Hooks → **Before User Created** → Postgres →
   `internal.before_user_created`. Check: a sign-up with an email not on the list is refused.
3. **Sign-ups off:** Authentication → Sign In / Providers → turn off **Allow new users to sign
   up** (the hook stays as a second layer).
4. **Anonymous sign-ins off:** same page → **Allow anonymous sign-ins** off.
5. **Create your user:** Authentication → Users → **Add user** → Create new user (email and a
   long password, auto-confirm). The app has no sign-up screen.
6. **Site URL and redirect URLs:** Authentication → URL Configuration → Site URL
   `https://ledgerly.vercel.app`; Redirect URLs `https://ledgerly.vercel.app/reset-password` and
   `https://ledgerly.vercel.app/dashboard/settings` (plus the `http://localhost:8081/...` pair
   for local development).
7. **Custom SMTP:** Authentication → Emails → SMTP Settings → your mail provider. The built-in
   sender is rate-limited and meant for testing (_check in your plan_). Check: Forgot password
   sends a mail that arrives.
8. **Session time-box:** Authentication → Sessions → time-box user sessions (for example 7
   days) and an inactivity timeout (_check in your plan_: may need a paid plan). The app also
   signs out after idle time (Settings → This device).
9. **Storage buckets:** Storage → `receipts` is **private** (10 MB, images only) and
   `portfolio-media` is **public** (5 MB, images and PDF); both come from the migrations. No
   other buckets should be public.

## 2. Accounts and two-step sign-in

1. **MFA in the app:** sign in → Settings → Two-step sign-in → scan the QR code → enter the
   first code. Keep the setup key somewhere safe.
2. **2FA everywhere else:** turn on two-factor sign-in for your Supabase, Vercel and GitHub
   accounts (each account's security settings). They can change everything the app protects.

## 3. Prices (market-refresh)

1. Deploy the function: GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`, then
   Actions → **Deploy Edge Functions** → Run workflow (SUPABASE_SETUP.md → Prices, step 1).
2. Schedule: function secret `MARKET_REFRESH_SECRET`, extensions `pg_cron` and `pg_net`, the
   two Vault secrets and the two `cron.schedule` jobs (SUPABASE_SETUP.md → Prices, step 2).
3. Verify: Mutual funds → **Update prices** works; `select * from cron.job;` lists both jobs;
   after the next weekday evening this shows scheduled runs with status `ok` (an NSE failure
   followed by an ok BSE run is normal):

   ```sql
   select source, status, started_at from market_refresh_runs
   where triggered_by = 'schedule' order by started_at desc limit 5;
   ```

## 4. Vercel

1. **Environment variables** (Project → Settings → Environment Variables, Production and
   Preview): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the
   publishable key, never the secret or service-role key) and `PORTFOLIO_HANDLE`. Redeploy
   without the build cache. Check: the app asks for sign-in (no "Preview · not saved" badge).
2. **Deployment Protection for previews:** Settings → Deployment Protection → protect Preview
   deployments (Vercel Authentication). Preview builds use the **production** database, so an
   open preview URL is a second door to your data.
3. **Instant Rollback:** know where it is (Deployments → a previous Production deployment →
   Instant Rollback) before you need it.

## 5. GitHub

1. **Require CI before deploying:** Settings → Branches (or Rules) → protect `main`: require a
   pull request and the CI checks (Database migrations, the app's checks) to pass, no force
   pushes. Vercel deploys `main`, so this is what keeps a red build out of production.
2. **Database backups:** add the secrets `SUPABASE_DB_URL` (Session pooler string) and
   `BACKUP_PASSPHRASE` (keep a copy outside GitHub), then Actions → **Database backup** → Run
   workflow and check the artifact (SUPABASE_SETUP.md → Backups and restore). Alternatively, or
   as well, a Supabase plan with daily backups or point-in-time recovery (_check in your plan_).
3. **Old repository:** make the previous repository private, or delete it, so old code and
   history with project details are not public.

## 6. Data

1. **First import:** Settings → Import from another app → review → Import. Set each new
   account's opening balance in Accounts.
2. **First export:** Settings → Export everything → keep the file somewhere private.
3. **First restore test:** with a second test user (add their email to the allowlist and create
   them in Authentication → Users), sign in → Settings → Restore from backup → your export →
   check the counts and a few balances → Undo restore (or Reset data). Remove the test user
   afterwards. Also decrypt one database backup once (SUPABASE_SETUP.md → Restore, steps 1–2)
   so you know the passphrase works.

## 7. Last checks

- Two browsers, two users: each sees only their own data; signed out sees nothing.
- `https://ledgerly.vercel.app/` shows the published portfolio; `/dashboard` asks for sign-in
  and then the 6-digit code.
- Nothing in the repository, Vercel variables or the app holds a secret key, database password
  or service-role key.
