# Ledgerly app (Expo)

The cross-platform app (iOS, Android, web) for personal finances and notes. What comes next is
in [`ROADMAP.md`](../../docs/architecture/ROADMAP.md).

- **Expense manager** (Expenses › Transactions, Stats, Budget, Categories, plus Accounts and the
  add/edit sheet): add, edit and delete entries, categories, budgets and accounts. Flows and
  rules: [`EXPENSE_MANAGER_FLOW.md`](../../docs/architecture/EXPENSE_MANAGER_FLOW.md).
- **People and splits:** split an expense with friends; Stats and budgets count your share, and
  Expenses › People tracks who owes you and records repayments. Notes are suggested as you type,
  and entries can carry a receipt photo (stored privately once migration 0011 is applied).
  Entries can repeat (recurring, migration 0012), the amount accepts sums like `120+45`, and the
  search button finds entries across months and exports them as CSV.
- **Notes** (Google Keep style): text notes and checklists with colours, pins, labels, archive
  and search.
- **Mutual funds**: funds from the AMFI list or entered by hand; purchases (stamp duty and units
  worked out), SIPs, redemptions and dividends; SIP plans with due and upcoming instalments; FIFO
  cost, gains, XIRR, allocation and growth; NAVs from AMFI. How it works:
  [`docs/features/INVESTMENTS.md`](../../docs/features/INVESTMENTS.md).
- **Stocks**: buys, sells, dividends, bonus issues and splits; FIFO P&L, XIRR, sectors, day
  change and price charts at end-of-day exchange prices.
- **Overview** reads the same ledger and portfolio; net worth includes funds and stocks.
- **Portfolio** (public developer site): edit the profile, projects, skills, experience,
  education, numbers and extra sections; drafts, reorder, image and résumé uploads (web), a
  private preview link and Publish; read contact messages. The site itself is `apps/portfolio`,
  served as this site's home page by `api/site.mjs` (built by `npm run build:site`); how it
  works: [`docs/features/PORTFOLIO.md`](../../docs/features/PORTFOLIO.md).

**Signed in** (migrations 0005–0015 applied), every page loads and saves **your own** data, and
the badge by the page title reads Saved / Saving… / Offline · will retry. Prices come from the
`market-refresh` Edge Function (see [`SUPABASE_SETUP.md`](../../SUPABASE_SETUP.md#prices-the-market-refresh-function)).
**Without the Supabase settings** the app runs as a labelled preview on sample data, and a
"Preview · not saved" badge says every change is lost on reload.

## Sign-in

Without Supabase settings the app runs as a labelled **preview** and asks for no sign-in. With
them, every `/dashboard` page requires a session (the guard is convenience; Row Level Security
is the real boundary).

### The two values

| Variable (exact name)                  | Value                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | The **Project URL**, `https://<project-ref>.supabase.co`, from Supabase → Project Settings → Data API. Nothing after `.supabase.co` (no `/rest/v1`). Not the dashboard address. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`) from Supabase → Project Settings → API Keys; on older projects, the **anon public** key.                                           |

Never use the **secret** (`sb_secret_…`) or **service_role** key: the app refuses both. Other names
(for example `VITE_SUPABASE_*` or `SUPABASE_ANON_KEY`) are ignored.

### On Vercel (the live site)

1. Open the Vercel project that builds `apps/command-center` (named
   **ledgerly**; it serves `ledgerly.vercel.app`).
2. **Settings → Environment Variables**: add both variables with the exact names above,
   **Environments: All Environments** (at least Production and Preview). Leave **Sensitive**
   off: Vercel refuses it for public (`EXPO_PUBLIC_`) variables, and these values are public by
   design.
3. **Deployments** → the top **Production** deployment → **⋯ → Redeploy**, with **Use existing
   build cache unticked**. The values are built into the bundle, so a deployment made before
   they were added keeps running in preview.
4. Open the site: it should show **Sign in**. If it still shows the dashboard with
   "Preview · not saved", the build did not receive the variables: re-check the project, the
   names and the environments, then redeploy again.

### Locally

Copy `.env.example` to `.env.local`, fill in the same two values, and restart with
`npx expo start --clear` (the values are read at build time).

### Supabase redirect URLs

In Supabase → Authentication → URL configuration, add the app's URLs to the redirect allowlist,
for example `https://ledgerly.vercel.app/reset-password` and
`http://localhost:8081/reset-password`.

### What you get

- **Two-step sign-in** (TOTP) is set up in Settings; after the password, `/verify-code` asks for
  the 6-digit code. **Sign out other devices** is in the same card.
- **Sessions:** on web they live in the tab's `sessionStorage`, or in `localStorage` when
  "Keep me signed in on this device" is ticked; on iOS/Android in the encrypted SecureStore.
- **Automatic sign-out** is chosen per device in Settings → This device (Auto, 15 min, 1 hour,
  8 hours, Never).
- Security headers (CSP, HSTS, frame blocking) are set in `vercel.json`. Server-side setup
  (sign-up allowlist hook, migrations) is in [`SUPABASE_SETUP.md`](../../SUPABASE_SETUP.md).

## Run

```bash
cd apps/command-center
npm ci
npm run web        # browser
npm run ios        # iOS simulator / Expo Go
npm run android    # Android emulator / Expo Go
```

The design-system gallery is at `/dev/components` (development builds only; production
builds redirect it away).

## Checks (same as CI)

```bash
npm run typecheck
npx eslint . --max-warnings 0
npm run format:check
npm test
npm run build:web && npm run check:bundle
npm run build:site && npm run check:site   # the portfolio at /, as Vercel builds it
```

## Structure

```
src/
  app/                 routes only (Expo Router); thin, ≤ 80 lines each
    dashboard/         adaptive shell + destinations
    dev/components     design-system gallery (dev only)
  components/          ui · layout · navigation · feedback · overlays · icons.ts
  components/charts/   BarChart, AreaChart, DonutChart, PieChart (callouts), Sparkline
                       (react-native-svg, no extra deps)
  features/            auth, shell (header, nav, rail, tab bar), overview, expenses, notes,
                       mutual-funds, stocks, investments (stores, hooks, shared parts),
                       portfolio-site, settings, sync, preview, dev-gallery
  features/expenses/   state/ (ledger store, seed, entry-form state) · entry/ (add/edit sheet)
                       · components/ (Transactions) · stats/ · budget/ · categories/ · accounts/
  lib/domain/expenses/ pure, tested money rules: balances, totals, breakdowns, budgets,
                       validation (no React, no storage)
  lib/domain/investments/ FIFO lots, XIRR, SIP schedules, splits and bonus, valuation, forms
  lib/domain/site/     portfolio content: field definitions, checks and save payloads
  features/preview/    SAMPLE DATA for preview mode and the Mutual funds / Stocks designs
  features/sync/       cloud load/save, save status badge, starter setup
  lib/data/            the only code that talks to Supabase (auth, MFA, RPCs, ledger,
                       portfolio, Storage)
  hooks/               useBreakpoint, useInteractionState
  lib/formatting/      display-only money/percent formatting (integer paise in)
  state/               small Zustand UI store (no financial data)
  theme/               tokens, typography, semantic colours (light/dark), motion, ThemeProvider
```

## Conventions

- **Colours** come from semantic roles in `src/theme/colors.ts`; no hex values elsewhere.
  `src/theme/__tests__/contrast.test.ts` enforces WCAG contrast for every text/UI pairing.
- **Icons** are imported from `@/components/icons` (per-icon imports). Importing the
  `lucide-react-native` barrel is a lint error because it adds ~2 MB to the web bundle.
- **Money** is passed to UI as integer minor units (paise); formatting happens only at display.
- **Motion** uses React Native's built-in `Animated` (no Reanimated: it cost ~140 KiB gzip on
  web). Timings come from `useMotion()`, which honours the OS reduced-motion setting; `Appear`
  and `useSlidingIndicator` cover entrances and moving selection indicators.
- **Focus rings** show for keyboard focus only (`useInteractionState` follows :focus-visible).
- **Responsive layouts** are chosen per breakpoint (`useBreakpoint`), not shrunk from desktop.
- **Single-screen pages** (all Expenses pages, Accounts, Mutual funds, Stocks) use `<Screen fit>`: on desktop the
  page never scrolls and panels scroll internally; windows 700–819 px tall get a denser layout,
  and below 700 px the page scrolls rather than clipping. Tablets and phones always scroll.
- Web output is a single-page app; `vercel.json` rewrites unknown paths to `index.html`. To
  deploy, create a Vercel project from this repo with **Root Directory** `apps/command-center`;
  `vercel.json` supplies the install, build (`npm run build:web`) and output (`dist`) settings.
