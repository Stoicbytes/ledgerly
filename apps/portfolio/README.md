# Ledgerly portfolio (public site)

The public developer portfolio. Its content is edited in Ledgerly (Dashboard →
Portfolio) and stored in Supabase; this site shows the version you last **published**. How it
fits together: [`docs/features/PORTFOLIO.md`](../../docs/features/PORTFOLIO.md),
[ADR 0010](../../docs/architecture/decisions/0010-public-portfolio-site.md) and
[ADR 0011](../../docs/architecture/decisions/0011-portfolio-at-the-dashboard-address.md).

**Where it runs:** as the home page of the dashboard's own address. The dashboard's Vercel
project builds this app too and serves it at `/` ([below](#deploy-on-vercel)); a **Dashboard**
button opens `/dashboard`, which asks for sign-in.

- Vite + React 19 + TypeScript, rendered on the server by one Vercel Function
  (`apps/command-center/api/site.mjs`, or `api/render.ts` when deployed on its own) and hydrated
  in the browser. No UI or animation library: CSS,
  IntersectionObserver, one canvas and View Transitions.
- Reads only `portfolio_public(handle)` (published snapshot), `portfolio_preview(token)` and
  writes only through `portfolio_contact(…)`. No sign-in and no secrets.

## Settings

Server-side environment variables (Vercel → Settings → Environment Variables, or `.env` for
local runs; see [`.env.example`](.env.example)):

| Variable                   | Required | Value                                                                               |
| -------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `SUPABASE_URL`             | Yes¹     | The Supabase Project URL (`https://<ref>.supabase.co`)                              |
| `SUPABASE_PUBLISHABLE_KEY` | Yes¹     | The **publishable** key (`sb_publishable_…`). Never the secret or service-role key  |
| `PORTFOLIO_HANDLE`         | Yes      | The site address set in Dashboard → Portfolio → Profile (e.g. `your-name`)          |
| `SITE_URL`                 | No       | This site's public address, used for canonical links, the sitemap and social cards  |
| `DASHBOARD_URL`            | No       | Where the Dashboard button goes: `/dashboard` or an https address. Unset: no button |

¹ Not needed in the dashboard's project: when these two are missing, the dashboard's own
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used. There,
`DASHBOARD_URL` defaults to `/dashboard`.

These values are public by design: the page hands the URL, key and handle to the browser so it
can refresh content and send the contact form. If the key looks secret (`sb_secret_…` or a
service-role token), the server does not use it and answers every page with a 500 error.

## Run locally

Requirements: Node.js 22.13 or later.

```bash
cd apps/portfolio
cp .env.example .env     # fill in the values above
npm ci
npm run dev              # http://localhost:5173, server-rendered like production
```

Production build served the way Vercel serves it:

```bash
npm run build            # dist/ (browser) and dist-server/ (server bundle)
npm run preview:local    # http://localhost:4180 (reads the same variables)
```

For layout work without a database, `MOCK_DOCUMENT=path/to/document.json npm run preview:local`
answers Supabase calls from a JSON file shaped like `portfolio_public`'s result. It is a local
aid only and is not part of the deployed site.

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test                 # Vitest: parsing, Markdown, SEO, server responses, hydration, contact, preview
npm run build
npm run check:bundle     # JavaScript ≤ 110 KiB, CSS ≤ 16 KiB (gzip)
```

CI runs all of them (`.github/workflows/ci.yml`, job "Portfolio site (Vite)").

`package-lock.json` was created with npm 11 (`npx npm@11 install`), because npm 10.9 stops
with an internal error while resolving Vitest's dependencies. `npm ci` works with npm 10 and 11.
When adding or updating packages, use npm 11.

## Deploy on Vercel

### As the dashboard's home page (how it is set up)

Nothing extra to create: the existing Vercel project **ledgerly** (Root Directory
`apps/command-center`) builds both apps. Its `vercel.json` runs `npm run build:web && npm run
build:site`; `build:site` installs and builds this app and copies its browser files to
`dist/site/` and its server bundle to `site-server/`, used by `api/site.mjs`.

1. Settings → Environment Variables: add `PORTFOLIO_HANDLE` (e.g. `your-name`) for all
   environments. The Supabase values are the dashboard's own. Optional: `SITE_URL`.
2. Settings → Build and Deployment → Root Directory: keep **Include files outside the root
   directory in the Build Step** on (the default). Without it the build stops with "apps/portfolio
   was not found".
3. Redeploy. `/` shows "Nothing is published here yet" (HTTP 404) with a Dashboard button until
   you publish.
4. In the dashboard → Portfolio → Profile: set **Site address** to the same value as
   `PORTFOLIO_HANDLE` and leave **Public site URL** empty. Add your content, use **Preview**, then
   **Publish**.

### On its own address (optional)

To give the portfolio its own project and address (as in ADR 0010), import the repository again
with Root Directory `apps/portfolio` (this folder's `vercel.json` applies), set the variables in
the table above, and `DASHBOARD_URL` to the dashboard's address. Then set **Public site URL** in
the dashboard's Profile to the new address so Preview opens there.

Publishing never needs a redeploy: pages are cached for 60 seconds at the edge and refreshed in
the browser when older than 30 seconds.

### What the server sends

| Path                  | Response                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `/`                   | The portfolio (200); 404 when nothing is published; 503 if Supabase is down |
| `/projects/<address>` | A project page (200) or a 404 page                                          |
| `/preview#t=…`        | A private preview from the dashboard: not cached, `noindex`, no referrer    |
| `/sitemap.xml`        | Home and every published project                                            |
| `/robots.txt`         | Allows everything except `/preview`, points to the sitemap                  |
| `/site/*`             | Hashed files, cached for a year                                             |

Every page gets a Content Security Policy (scripts only from this site plus one hashed inline
script; images and requests only from this site and your Supabase project), HSTS, `nosniff`,
frame blocking and a strict referrer policy.

## Licences

Fonts: Geist and Geist Mono (SIL Open Font License), Instrument Serif (SIL OFL), from
Fontsource. A few icon outlines are adapted from Lucide (ISC), see
[`licenses/lucide.txt`](licenses/lucide.txt).
