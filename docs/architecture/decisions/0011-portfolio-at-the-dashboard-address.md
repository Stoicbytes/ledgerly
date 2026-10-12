# 0011. The portfolio is the home page of the dashboard's address

- Status: Accepted
- Date: 2026-10-11
- Partly supersedes: [0010](0010-public-portfolio-site.md) ("Its own app and origin")

## Context

ADR 0010 put the public portfolio on its own Vercel project and address, so that it would never
share a browser origin with the signed-in dashboard. The owner asked for one site instead: the
portfolio as the landing page of the app's address, with a **Dashboard** option that opens the
sign-in. The original modernization plan had the same shape (the public portfolio at `/`, the app
under `/dashboard`).

## Decision

- **One Vercel project, one address.** The dashboard's project
  (`ledgerly`) also builds `apps/portfolio` (`npm run build:site` after the Expo
  export) and serves it from one function, `api/site.mjs`:
  - `/`, `/projects/…`, `/preview`, `/sitemap.xml` and `/robots.txt` → the portfolio
    (server-rendered, cached for 60 seconds);
  - every other path → the dashboard (Expo's page, renamed `dashboard.html` so that `/` reaches
    the portfolio).
- **The Dashboard button** in the portfolio's header (and phone menu, and its "nothing published
  yet" page) opens `/dashboard`, which asks for sign-in and the two-step code as before.
- **Each part keeps its own security headers.** Dashboard pages keep their CSP and get
  `X-Robots-Tag: noindex`; portfolio pages get the portfolio's per-response CSP. Both get HSTS,
  frame blocking and `nosniff`.
- **Settings are shared.** The portfolio reads the dashboard's own `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, so the only new variable is `PORTFOLIO_HANDLE`.
- `apps/portfolio` can still be deployed on its own (its `vercel.json`), with `DASHBOARD_URL`
  pointing to the dashboard.

## Consequences

- One project to deploy, and no second address to keep in sync; Preview and "Open site" default
  to the dashboard's own address.
- **The public pages now share the dashboard's origin.** A script injected into a portfolio page
  could read a dashboard session kept in that browser's storage. What keeps that unlikely: the
  portfolio shows only content you wrote (rendered as text, never as HTML, with links limited to
  https and mailto), never shows what visitors send, loads no third-party scripts, and allows only
  its own scripts plus one hashed inline script (CSP). The session is in `sessionStorage` unless
  "keep me signed in" is ticked, and every change still needs the two-step code. If this ever
  matters more than one address, serving `apps/portfolio` from its own project (as in ADR 0010)
  restores the separation without code changes.
- The dashboard's Vercel build also installs and builds the portfolio (about half a minute more),
  and needs Vercel's "Include files outside the root directory in the Build Step" setting on (the
  default). CI runs the same build step and a smoke check (`npm run check:site`).
- In the phone apps and in local Expo development, `/` still opens the dashboard.
