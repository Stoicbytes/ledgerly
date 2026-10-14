# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub: open the repository's **Security** tab
and choose **Report a vulnerability**. Do not open a public issue or pull request for a
vulnerability.

Include what is affected, how to reproduce it and what an attacker could do. You will get a reply
within a few days, and a fix or a decision before any details are made public.

Only the `main` branch and the live site are supported.

## Security model

- **Row Level Security is the boundary.** Every table is limited to its owner's rows, and saves
  go through database functions and constraints that check the input again. Screens and route guards
  are convenience only.
- **Only public keys in clients.** The app and the portfolio use the Supabase publishable key.
  Service keys and other secrets exist only in the Edge Function's settings; the app refuses a secret or
  service-role key.
- **Sign-in.** New accounts are blocked except for allowlisted emails, and the database checks the
  allowlist again on every request (an account whose email is not on it sees nothing). Once
  two-step sign-in (TOTP) is set up, every table, file and function requires it, market data
  included. Idle sessions sign out (8 hours at most on Auto); set Supabase's session time-box too.
- **Tested.** `supabase/tests/access_rules.sql` runs in CI: every table forces Row Level Security
  and has the restrictive two-step policy, and password-only, other-account, non-allowlisted and
  signed-out sessions get nothing.
- **Browser limits.** The dashboard's Content-Security-Policy allows requests only to this app's
  own Supabase project. Spreadsheet imports are capped (50 MB unpacked, 100,000 rows, 200 columns).
- **Deploys.** Edge Functions deploy only after CI passes on `main`, with a pinned CLI version.
- **Public files.** The `portfolio-media` bucket is public: anyone with a file's address can open it,
  drafts included (addresses are random and not listed). Deleting an item does not delete its file
  at once; the editor removes files nothing uses after an hour, the next time it loads.
- **Market data on the server.** Prices are fetched by the `market-refresh` Edge Function; the
  browser never contacts third-party financial sites.
- **No financial data leaves the owner's project** except what the owner publishes on the
  portfolio.

The go-live checklist (sign-ups off, hook on, your email allowlisted, session limits, SMTP,
preview protection) is in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md#go-live-security-checklist).

No system is free of vulnerabilities; reports are welcome.
