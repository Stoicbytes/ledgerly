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
- **Sign-in.** New accounts are blocked except for allowlisted emails; once two-step sign-in (TOTP)
  is set up, the data requires it; idle sessions sign out.
- **Market data on the server.** Prices are fetched by the `market-refresh` Edge Function; the
  browser never contacts third-party financial sites.
- **No financial data leaves the owner's project** except what the owner publishes on the
  portfolio.

No system is free of vulnerabilities; reports are welcome.
