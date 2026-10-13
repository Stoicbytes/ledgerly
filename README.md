# Ledgerly

Ledgerly, by StoicBytes, is a private, single-owner workspace for personal finance and notes, with a public developer
portfolio as its home page. One Expo codebase serves the app on the web, iOS and Android;
Supabase provides authentication, the database and storage. Amounts are in Indian rupees (INR).

**Live:** [ledgerly.vercel.app](https://ledgerly.vercel.app)
(portfolio at `/`, the app at `/dashboard`).

## Features

| Area           | What it does                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expenses       | Calendar, daily and monthly views; accounts, categories, budgets; split expenses and repayments; recurring entries; receipts; search with CSV export; sums in amounts |
| Mutual funds   | AMFI scheme search and daily NAVs; purchases, SIPs and redemptions; FIFO cost, XIRR, allocation; capital gains by financial year; goals, costs and SIP step-up        |
| Stocks         | Buys, sales, dividends, bonus issues and splits; FIFO profit and loss; end-of-day NSE/BSE prices; sectors and movers; comparison with an index fund                   |
| Import         | Zerodha tradebooks for funds and shares, and other expense apps' exports; read on the device and reviewed before anything is saved                                    |
| Salary & PF    | Payslips per employer and month across job changes, yearly totals and TDS; the PF passbook with interest estimates, pension apart                                     |
| Overview       | Net worth across accounts (credit cards left out), funds, shares and PF; insights from your entries                                                                   |
| Notes          | Text notes and checklists with colours, pins, labels, reminders, archive, search and Recently deleted                                                                 |
| Portfolio site | Profile, projects, skills and experience edited in the dashboard, previewed privately and published as a snapshot                                                     |

What it is not: a multi-user product, a bank connection, a trading app or tax software. The full
product definition is in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Technology

- **App:** Expo SDK 57, Expo Router, React Native and React Native Web, TypeScript, Zustand.
- **Portfolio:** Vite and React 19, rendered on the server by a Vercel Function.
- **Backend:** Supabase Postgres with Row Level Security, Auth with two-step (TOTP) sign-in,
  Storage, and one Edge Function (Deno) that fetches market prices on the server.
- **Quality:** strict TypeScript, ESLint, Prettier, Jest, Vitest and Deno tests, bundle-size
  budgets and a production build run in CI on every pull request.

## Repository layout

```text
apps/command-center/   The app (Expo Router, React Native Web) and the Vercel project that
                       serves both sites
apps/portfolio/        The public portfolio (Vite + React, server-rendered)
supabase/migrations/   Database schema, rules and functions, applied in order (0004–0017)
supabase/functions/    market-refresh: AMFI NAVs and exchange closing prices, fetched server-side
docs/                  Product definition, architecture, decisions and feature guides
SUPABASE_SETUP.md      Setting up and verifying the Supabase project
.github/workflows/     CI and Edge Function deployment
```

## Getting started

Requirements: Node.js 22 (see [`.nvmrc`](.nvmrc)) and npm.

```bash
cd apps/command-center
cp .env.example .env.local   # Supabase Project URL and publishable key
npm ci
npm run web                  # or: npm run ios / npm run android
```

Without the two Supabase values the app runs as a clearly labelled preview on sample data, with
no sign-in. Checks and project structure: [`apps/command-center/README.md`](apps/command-center/README.md).

## Deployment

- **Web (Vercel):** the project builds `apps/command-center` with its `vercel.json` (the Expo web
  export plus the portfolio). Set `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `PORTFOLIO_HANDLE`, then redeploy without the build
  cache. Details: [`apps/command-center/README.md`](apps/command-center/README.md#sign-in) and
  [`apps/portfolio/README.md`](apps/portfolio/README.md#deploy-on-vercel).
- **Database:** run the files in `supabase/migrations/` in order in the Supabase SQL Editor; each
  is safe to run again and documents its rollback.
- **Prices:** deploy the `market-refresh` Edge Function and, optionally, its daily schedule
  ([`SUPABASE_SETUP.md`](SUPABASE_SETUP.md#prices-the-market-refresh-function)).

## Documentation

| Document                                                                   | Covers                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`docs/PRODUCT.md`](docs/PRODUCT.md)                                       | Purpose, features and their status                            |
| [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)   | Modules, data flow, security and deployment                   |
| [`docs/architecture/DATA_ACCESS.md`](docs/architecture/DATA_ACCESS.md)     | Every call to Supabase and why it is made                     |
| [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md)           | Tables, rules, functions and schema changes                   |
| [`docs/architecture/EDGE_CASES.md`](docs/architecture/EDGE_CASES.md)       | Behaviour offline, on errors, with two devices and bad input  |
| [`docs/architecture/AUDIT_2026-10.md`](docs/architecture/AUDIT_2026-10.md) | The October 2026 review: findings and fixes                   |
| [`docs/architecture/decisions/`](docs/architecture/decisions/README.md)    | Architecture decision records                                 |
| [`docs/architecture/ROADMAP.md`](docs/architecture/ROADMAP.md)             | What comes next                                               |
| [`docs/features/`](docs/features/README.md)                                | How expenses, investments and the portfolio work              |
| [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)                                   | Supabase setup: migrations, prices, sign-in, security         |
| [`SECURITY.md`](SECURITY.md)                                               | How to report a vulnerability, and what the security model is |

## Known limitations

- Edits to the same entry on two devices at the same moment: the last save wins. Changes made
  elsewhere appear when you return to the app.
- Share prices are end of day; there is no free official live-quote source.
- Account deletion is not in the app yet. Settings → **Export everything** saves all your data as
  one JSON file.
- The whole ledger loads at sign-in, which suits personal scale.

## Security

The app and the portfolio use only the Supabase **publishable** key; secrets live only in the
Edge Function's settings. Row Level Security and database checks are the security boundary, new
accounts are blocked except for allowlisted emails, and two-step sign-in (TOTP) protects the
dashboard.
See [`SECURITY.md`](SECURITY.md).

## License

Copyright © 2026 StoicBytes. All rights reserved. The source is published for reference; no
licence to use, copy or distribute it is granted.
