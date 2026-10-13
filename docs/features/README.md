# Features

One section per feature: what it is for, where it lives in the code, what it reads and writes,
and what to watch out for. Paths are under `apps/command-center/src/` unless noted. Every
feature that saves data does so through the same sync (`features/sync/cloudSync.ts` →
`load_ledger` / `sync_ledger`; changes from another device are picked up when you come back to
the app), except the Portfolio editor, which saves item by item. The
Supabase calls are listed in [`../architecture/DATA_ACCESS.md`](../architecture/DATA_ACCESS.md),
and failure behaviour in [`../architecture/EDGE_CASES.md`](../architecture/EDGE_CASES.md).

## Sign-in and security

- **Purpose:** keep financial data private: allowlisted sign-in, two-step code (TOTP), automatic
  sign-out when idle, "keep me signed in" per device.
- **Access:** `/sign-in`, `/verify-code`, `/forgot-password`, `/reset-password`; Settings →
  Account & security, Two-step sign-in, This device.
- **Code:** `features/auth/` (screens, `SessionProvider`, `sessionStore`, `useIdleSignOut`),
  `features/settings/` (`AccountCard`, `SecurityCard`, `DeviceSignInCard`), `lib/data/authRepository.ts`,
  `mfaRepository.ts`, `authStorage*.ts`, `lib/security/redirects.ts`.
- **Data:** Supabase Auth only (no tables of its own from the app).
- **State:** `useSession` (`loading` / `signedOut` / `needsCode` / `signedIn` / `preview`); the
  dashboard layout redirects on it; the database enforces it anyway.
- **Edge cases:** expired session → stores cleared and sign-in shown; signing out with unsent
  changes asks first; idle sign-out sends pending changes first.

## Expenses (transactions, accounts, categories, budgets, people)

- **Purpose:** record every rupee in and out in a few taps and see where it went.
- **Access:** Expenses (Transactions, Stats, Budget, Categories, People), Accounts, the **+** /
  Add expense button on Overview.
- **Code:** `features/expenses/` (`entry/` the add/edit sheet, `components/` lists and calendar,
  `stats/`, `budget/`, `categories/`, `accounts/`, `people/`, `state/expenseStore.ts`,
  `state/transactionForm.ts`), rules in `lib/domain/expenses/`.
- **Data:** `accounts`, `categories`, `people`, `transactions`, `transaction_splits`,
  `repayment_settles` through `load_ledger` / `sync_ledger`.
- **State:** `useExpenseStore` holds the ledger; screens compute balances, totals and budgets
  from it (pure functions, tested).
- **Budget alerts:** a category with a monthly budget is flagged when it is over, when 80% or
  more is used, or (from the 7th) when this month's daily rate would pass it by month-end;
  subcategories count toward their parent. They show on Expenses → Budget (current month) and
  as one Overview insight. Code: `budgetAlerts` in `lib/domain/expenses/budgets.ts`,
  `budget/BudgetAlertsCard.tsx`, `features/overview/budgetInsight.ts`.
- **Receipt photos** (`photos/`): signed in, a photo is uploaded to the private `receipts`
  bucket as soon as it is picked (re-encoded in the browser first, which drops location data),
  and Save waits for it; it is shown through links that expire after a minute; unused files are
  deleted at a later sign-in once a day old. In the preview it stays in memory. Needs migration 0011.
- **Calculator:** the amount accepts sums (`120+45`, `450/3`, with + − × ÷ keys); the result
  shows underneath and becomes the amount (`lib/domain/expenses/calculator.ts`, no code is
  evaluated).
- **Search and export** (`search/`): the header's search button finds entries across all months
  by words, an amount, type, period, category and account, with totals; **Export** saves the
  results (or everything) as CSV for Excel. Cells that would run as formulas are neutralised
  (`lib/domain/expenses/csv.ts`). Web: a file download; phones: the share sheet.
- **Recurring entries** (`recurring/`, `state/recurring*.ts`): **Repeat** on a new entry (daily,
  weekly, monthly, yearly; monthly keeps the day, using the month's last day when shorter). Due
  dates appear on Transactions: **Add** opens the sheet with the amount ready to change, **Skip**
  moves on, **Add all** adds those that can be added as they are; the repeat button lists and
  edits them. Nothing is added automatically. Needs migration 0012 when signed in.
- **Default view:** the calendar, on every screen size. Tapping an empty day opens **Add** on
  that date. Tapping a day with entries shows them in the day panel; tapping it again (or the
  panel's **Add**) opens **Add** on that date.
- **Edge cases:** validation in the form and the database; a double tap on Save adds one entry.
  Flows in detail:
  [`../architecture/EXPENSE_MANAGER_FLOW.md`](../architecture/EXPENSE_MANAGER_FLOW.md).

## Notes

- **Purpose:** notes and checklists next to the numbers (colours, pins, labels, archive, search).
- **Access:** Notes.
- **Reminders:** the bell in a note sets a day it comes back on. Due notes show on the card (in
  red), under **Reminders** and in **Reminders due** on Overview, where **Done** clears them.
  There are no push notifications: the app shows them when you open it.
- **Recently deleted:** a deleted note waits there for 7 days (Undo right after deleting,
  **Restore** later, **Delete for good** at once), then the app removes it when it next loads.
- **Code:** `features/notes/` (`NotesScreen.tsx`, `components/`, `state/notesStore.ts`); the
  Overview card is `features/overview/RemindersCard.tsx`.
- **Data:** `notes` through `load_ledger` / `sync_ledger`. Reminders and Recently deleted need
  migration 0015; before it they are hidden and deleting removes a note at once.
- **Edge cases:** checklist and label sizes are bounded in the database; see
  [`EDGE_CASES.md`](../architecture/EDGE_CASES.md).

## Salary and PF

- **Purpose:** every payslip and the PF account, across job changes: nothing is tied to one
  company. Replaces the spreadsheet's salary and PF sheets.
- **Access:** Salary & PF (desktop rail; **More** on phones). Tabs: Payslips, PF / EPF, Employers.
- **Payslips:** one per employer and month, with the lines as printed (earnings and other
  deductions), employee EPF, VPF, TDS and the employer's EPF and pension shares. A new payslip
  starts from the last one, a month later. Saving can record the net pay as an income entry (and
  updates it later). Totals by financial year: gross, net, TDS, your PF and the employer's, per
  employer when there were several.
- **PF / EPF:** the balance is your share (EPF + VPF + interest) and the employer's EPF share,
  less withdrawals; pension (EPS) is shown apart because it is not a withdrawable balance. Each
  payslip adds its month's contribution. Interest counts only once entered from the passbook (the
  rate EPFO declared for that year); the app estimates it the EPFO way (monthly balances at a
  twelfth of the rate) to check against, and lists finished years still missing it. Opening
  balances, withdrawals and months without a payslip are entered by hand. PF counts in net worth.
- **Privacy:** no UAN, member ID, PAN or other identity number is asked for or stored.
- **Code:** `features/salary/` (screen, sheets, `state/`), `lib/domain/salary/` (pay totals,
  PF balance, interest estimate), `lib/data/salaryRows.ts`.
- **Data:** migration 0016, through `load_ledger` / `sync_ledger`.

## Export everything

Settings → **Export everything** saves one JSON file (`ledgerly-export-<date>.json`) with all your
data: accounts, categories, people, entries, recurring entries, notes (Recently deleted too),
funds, SIPs, shares, goals, employers, payslips, the PF passbook and the portfolio site's content.
Amounts are in paise. Receipt photos stay in storage; each entry keeps its path. Code:
`features/settings/exportAll.ts`, `ExportCard.tsx`.

## Import from another app

Settings → **Import from another app** reads an .xlsx or .csv export from another expense app
(the Money Manager layout: Period, Accounts, Category, Subcategory, Note, Description, Amount,
Income/Expense) on the device; the file is not uploaded or kept. A review lists what would be
added before anything is saved:

- **Entries:** expenses and income, with the time of day kept for ordering. Note and Description
  are joined (120 characters at most).
- **Dates:** Excel dates, `2026-08-14 10:49`, `14/08/2026` or `8/14/26 7:05 PM`. Whether text
  dates are day-first or month-first is decided from the whole file (day-first when it cannot
  tell). Dates outside 1900–2100 are left out.
- **Amounts:** numbers or text such as `₹1,234.50`; zero, negative or unreadable amounts are
  left out.
- **Emoji:** left out of account, category and subcategory names (notes keep them). An entry
  whose category is only an emoji is imported uncategorised (or under its parent category).
- **Accounts and categories:** matched to yours by name (ignoring case, spaces and emoji); missing ones
  are created, with names cut to the database's limits (accounts 60 characters, categories 40).
  New accounts start at a ₹0 opening balance: set it in Accounts so balances match.
- **Left out, with the reason:** balance corrections, transfers, unreadable dates or amounts.
- **Already there:** entries with the same day, type, amount, account and note are skipped, so
  importing the same file twice adds nothing.
- **Large files:** at most 4,000 entries per import (one save takes up to 5,000 rows); the
  oldest go first and importing the same file again adds the rest. Files over 5 MB, and old
  .xls files, are refused with what to do instead.

**Import** plans again against the ledger as it is at that moment, so a double press or edits
made meanwhile add no duplicates. **Undo import** (while the card is open) removes exactly the
imported entries, and the accounts and categories the import created unless something added
since uses them. Web only for now (phones need a file picker). Code:
`lib/domain/expenses/sheetImport.ts`, `sheetDates.ts`, `sheetImportPlan.ts` (tested),
`features/settings/import/`.

## Mutual funds, stocks and tradebook import

- **Purpose:** real returns on investments (FIFO gains, XIRR), SIP tracking, net worth.
- **Access:** Mutual funds, Stocks, **Import**, **Update prices**.
- **Code:** `features/mutual-funds/`, `features/stocks/`, `features/investments/` (stores, hooks,
  import), rules in `lib/domain/investments/`, prices from `supabase/functions/market-refresh`.
- **Guide:** [`INVESTMENTS.md`](INVESTMENTS.md).

## Overview

- **Purpose:** the whole picture at a glance: net worth (accounts, funds, shares, PF), insights,
  cash flow, budget use, recent activity.
- **Net worth:** credit card accounts are left out; what is owed on them shows as an insight.
- **Insights:** up to six, warnings first, worked out by simple rules from your own entries:
  card dues, budget alerts, savings rate, spending pace against the same days last month, the month-end
  course, the category that rose most, how many months your cash covers, recurring entries due
  this week, the last salary and TDS this financial year, the largest expense. Nothing leaves
  the device for this. Code: `features/overview/insights.ts` (tested), `InsightsCard.tsx`.
- **Access:** `/dashboard`.
- **Code:** `features/overview/` (`useOverviewData.ts` computes everything from the stores).
- **Data:** none of its own; reads the expense, recurring, salary, portfolio and market stores.

## Portfolio (public site and editor)

- **Purpose:** the owner's public developer portfolio, the site's home page, edited in the
  dashboard and published without a redeploy; the CV tab downloads an ATS-friendly CV (PDF or
  Word) built from it, with a readiness score.
- **Access:** `/` (public); Dashboard → Portfolio (editor).
- **Code:** `apps/portfolio/` (site), `features/portfolio-site/` and `lib/domain/site/` (editor),
  `apps/command-center/api/site.mjs` (serves the site at `/`).
- **Guide:** [`PORTFOLIO.md`](PORTFOLIO.md).

## Not built (hidden)

App-wide Reports and search across every module are not in the app (their "Planned"
placeholders were removed in October 2026). See [`../PRODUCT.md`](../PRODUCT.md).
