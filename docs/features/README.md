# Features

One section per feature: what it is for, where it lives in the code, what it reads and writes,
and what to watch out for. Paths are under `apps/command-center/src/` unless noted. Every
feature that saves data does so through the same sync (`features/sync/cloudSync.ts` →
`load_ledger` / `sync_ledger_v2`; changes from another device are picked up when you come back
to the app, focus the window, or every 5 minutes), except the Portfolio editor, which saves item
by item. The sync never silently loses an edit: unsaved changes are kept in the browser and saved
at the same user's next sign-in; idle sign-out waits until everything is saved; a refused row is
left out on its own (the rest is saved) with a note that stays until dismissed; a row changed
or deleted on another device is not overwritten (migration 0020), and the newer version is shown. The
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
  changes asks first; idle sign-out sends pending changes first. Auto idle sign-out: 30 minutes,
  or 8 hours on a device kept signed in; Never only when chosen.
- **Database rules (0019):** an account whose email is not on the allowlist, or a password-only
  session once two-step sign-in is on, gets nothing from any table, file or function;
  `supabase/tests/access_rules.sql` checks it in CI.

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
  more is used, or (from the 7th) when it is on course to pass it: spent so far plus what the
  rest of a month usually costs in that category (the median of the last three months with
  entries; no pace alert without them), so rent on the 1st is not multiplied over the month;
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
- **Search everything:** typed words also find notes and checklists (not deleted ones), funds,
  goals, shares, employers and payslips (by employer, month or pay line), up to five of each,
  above the entries; a tap opens that screen. Folio and member numbers are never searched.
  Code: `lib/domain/search/everything.ts` (tested), `search/EverythingResults.tsx`.
- **Recurring entries** (`recurring/`, `state/recurring*.ts`): **Repeat** on a new entry (daily,
  weekly, monthly, yearly; monthly keeps the day, using the month's last day when shorter). Due
  dates appear on Transactions: **Add** opens the sheet with the amount ready to change, **Skip**
  moves on, **Add all** adds those that can be added as they are; the repeat button lists and
  edits them. Nothing is added automatically. Needs migration 0012 when signed in.
- **Default view:** the calendar, on every screen size. Tapping an empty day opens **Add** on
  that date. Tapping a day with entries shows them in the day panel; tapping it again (or the
  panel's **Add**) opens **Add** on that date.
- **Fast entry:** a new entry starts with the type and, per type, the account used last; both
  are remembered on this device (`state/lastEntry.ts`, device preferences, ids only) and an
  account that no longer exists is skipped. The category picker shows **Used most**: the 4–6
  categories with the most entries in the last 90 days (`frequentCategories` in
  `lib/domain/expenses/frequent.ts`, tested), above the full grid.
- **Long lists:** rows share one lookup per ledger (`sharedLookup` in `hooks/useLedger.ts`; the
  share statuses walk every entry, so building it per row made big months slow) and are
  memoised. On the web the Daily list and search results render 40 rows, then more as you scroll
  near the end or press **Show more** (`components/layout/RevealMore.tsx`; the page itself scrolls,
  so a virtualised list cannot be used). Search runs once typing pauses for 150 ms.
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
  twelfth of the rate, each contribution counted from the month after its wage month, when it is
  deposited, so March wages earn nothing that year) to check against the passbook, and lists
  finished years still missing it. Opening
  balances, withdrawals and months without a payslip are entered by hand. PF counts in net worth.
- **Import payslips** (web; on phones the button is disabled until the next app build): choose
  one or more files from any employer: text PDFs (Keka, greytHR, Zoho, Excel→PDF and so on),
  CSV or Excel exports (one row per month, or a label / amount sheet). A multi-page PDF with a
  different month on each page gives one payslip per page. Password-protected PDFs ask for the
  password per file (or **Skip this file**); RC4, AES-128 and AES-256 are supported. Each file
  becomes a card: month, employer (matched to an existing one ignoring case, punctuation and
  "Pvt Ltd" / "Private Limited"; otherwise **Add employer**), gross and net, and a check that
  the lines add up to the printed gross, total deductions and net pay (±₹1). Fields read with
  less certainty are flagged. **Review and save** opens the usual payslip form filled in;
  **Save all** saves the payslips with nothing to check. A payslip already added for the same
  employer and month shows **Already added**: **Replace** edits it, **Skip** leaves it. Saving
  goes through the normal path, so the PF contribution and the optional income entry work as
  when typed. How it reads: labels are paired with amounts by position (two-column Earnings |
  Deductions tables, `label: value` lists); this month's column is used where Current and YTD
  (or Full and Actual) columns are printed; PF / EPF → employee EPF, VPF, Income tax / TDS →
  TDS, employer PF and EPS → the employer's shares, everything else keeps its printed label.
  Employer shares are never invented: when a payslip does not print them, **Estimate employer
  share** (in the form) applies the statutory rule (12% of the PF wage; EPS 8.33%, at most
  ₹1,250) and notes that it is an estimate to check in the EPFO passbook.
- **Import limits:** scanned or photographed payslips (image-only PDFs, JPG, PNG) have no text to
  read and are added by hand; no OCR. Files over 5 MB are refused. PDFs with uncommon
  compression (other than Flate) or encryption (other than the standard password handler)
  cannot be read; open them and print to a new PDF first.
- **Privacy:** no UAN, member ID, PAN or other identity number is asked for or stored. The
  import ignores lines labelled UAN, PAN, Aadhaar, PF or ESI number, bank account, IFSC,
  employee ID, address or date of birth, and any label carrying a long number. Files are read
  on the device and not kept; passwords are used once and not stored.
- **Code:** `features/salary/` (screen, sheets, `state/`, `import/`), `lib/domain/salary/` (pay
  totals, PF balance, interest estimate, `payslipImport/` for reading payslips),
  `lib/files/pdfText/` (the PDF text reader), `lib/data/salaryRows.ts`. Test PDFs are made by
  `lib/domain/salary/payslipImport/__fixtures__/make_payslips.py` (made-up companies and
  numbers).
- **Data:** migration 0016, through `load_ledger` / `sync_ledger`.

## Export everything

Settings → **Export everything** saves one JSON file (`ledgerly-export-<date>.json`) with all your
data: accounts, categories, people, entries, recurring entries, notes (Recently deleted too),
funds, SIPs, shares, goals, employers, payslips, the PF passbook and the portfolio site's content.
Amounts are in paise. Receipt photos stay in storage; each entry keeps its path. The file says
`"format": "ledgerly-export"` and `"version": 1`; Restore from backup reads that version. Code:
`features/settings/exportAll.ts`, `ExportCard.tsx`.

## Restore from backup

Settings → **Restore from backup** reads an Export everything file on the device (web; the file
is not uploaded or kept) and adds back what is missing. It never deletes or overwrites.

- **Checks first:** files over 20 MB, other formats and newer versions are refused. Every field
  is checked for type and the database's limits (text lengths, amounts, dates, ids), keys such
  as `__proto__` are refused anywhere in the file, ids must be unique and every reference
  (account, category, person, fund, share, employer, payslip) must be in the file. One problem
  refuses the whole file, with where it is.
- **Review:** per kind, how many are in the file, to add, already here, matched by name, and
  differing here; the date range of the entries; what happens to the portfolio site.
- **Adding:** ids are kept, so restoring the same file twice adds nothing. A record whose id is
  already here is kept as it is here (reported when it differs). An account, person, category
  or share whose name is already taken uses the one here, and the restored entries point to it.
  A payslip for a month that is already here under another id is left out (with its PF entry).
  Records go through the normal save (`sync_ledger`) in batches of at most 4,000 rows per list,
  things before their users, then everything is loaded again. If a batch fails, what was saved
  stays and restoring the same file again adds the rest.
- **Portfolio site:** restored only when your portfolio is empty, item by item through its
  editor's save and checks; otherwise skipped. Messages and the published copy are not restored
  (publish again).
- **Not in backups:** receipt photos and portfolio images and files; restored entries come back
  without them.
- **Undo restore** (while the card is open) removes exactly what was added, keeping anything
  used since (an account a new entry uses stays). The portfolio profile stays.
- Preview mode restores into the sample data on screen only.
- **Code:** `lib/domain/backup/` (checks, plan, undo; tested), `lib/data/restoreBatches.ts`,
  `features/settings/restore/`.

## Reset data

Settings → **Reset data** clears one part of Ledgerly so it can start again: **expense entries**
(entries and recurring entries; accounts, categories, budgets and people stay), **everything in
Expenses** (also accounts, categories and people; the starter set can be added again), **mutual
funds** (funds with their transactions and SIPs, and goals) or **stocks** (shares and their
trades; the benchmark stays). Salary, PF, notes and the portfolio site are never touched.

- **Safety:** the sheet says what will be deleted (with counts) and stays locked until RESET is
  typed. Signed in, unsaved edits are sent first; if they cannot be (offline), nothing happens.
- **How:** the database deletes the rows in one transaction (`reset_data`, migration 0018, so
  large ledgers are cleared at once), then the app loads everything again. Preview mode clears
  the sample data in memory. Not reversible here: download **Export everything** first;
  **Restore from backup** can add the records back (not receipt photos).
- **Code:** `features/settings/reset/`, `lib/data/resetRepository.ts`.

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
- **Amounts:** numbers or text such as `₹1,234.50`, `Rs. 1,500.00`, `INR 500` or `Rs 500/-`
  (a leading or trailing ₹, Rs, Rs. or INR is dropped first); zero, negative or unreadable
  amounts are left out, and so are European decimals such as `1.234,50` (not guessed). Notes
  keep up to 500 characters (the database's limit; typed notes have the same limit).
- **Emoji:** left out of account, category and subcategory names (notes keep them). An entry
  whose category is only an emoji is imported uncategorised (or under its parent category).
- **Accounts and categories:** matched to yours by name (ignoring case, spaces and emoji); missing ones
  are created, with names cut to the database's limits (accounts 60 characters, categories 40).
  New accounts start at a ₹0 opening balance: set it in Accounts so balances match.
- **Transfers:** Transfer-Out moves money from Accounts to the account named in Category;
  Transfer-In is the same transfer from the receiving side, so a matching pair imports once.
  Transfers are not counted as spending or income.
- **Balance corrections** ("Modified Bal."): added to the opening balance of an account the
  import creates (Income Balance raises it, Expense Balance lowers it), so totals stay clean.
  For an account you already had they are left out: set its balance in Accounts.
- **Left out, with the reason:** unknown types, transfers without two accounts, transfers whose
  two accounts are the same once emoji are left out ("HDFC" and "HDFC 💳"), corrections for
  existing accounts, unreadable dates or amounts.
- **Already there:** entries with the same day, type, amount, account(s) and note are skipped,
  so importing the same file twice adds nothing.
- **Large files:** at most 4,000 entries per import (one save takes up to 5,000 rows); the
  oldest go first and importing the same file again adds the rest. Files over 5 MB, and old
  .xls files, are refused with what to do instead. An .xlsx that unpacks to more than 50 MB, or
  whose sheet goes past row 100,000 or column 200, is refused too (`lib/files/`), so a crafted
  file cannot freeze the tab.

**Import** plans again against the ledger as it is at that moment, so a double press or edits
made meanwhile add no duplicates. **Undo import** removes exactly the imported entries, and the
accounts and categories the import created unless something added since uses them; entries
already deleted are skipped. Signed in, the last import's ids (only ids) are kept on the device
per user, so **Undo last import** is still offered after a reload until it is used or dismissed. Web only for now (phones need a file picker). Code:
`lib/domain/expenses/sheetImport.ts`, `sheetDates.ts`, `sheetImportPlan.ts` (tested),
`features/settings/import/`.

## Mutual funds, stocks and tradebook import

- **Purpose:** real returns on investments (FIFO gains, XIRR), SIP tracking, net worth.
- **Access:** Mutual funds, Stocks, **Import**, **Update prices**.
- **Code:** `features/mutual-funds/`, `features/stocks/`, `features/investments/` (stores, hooks,
  import), rules in `lib/domain/investments/`, prices from `supabase/functions/market-refresh`.
- **Price status:** under each page's title, "NAVs as of …" / "Closing prices as of …", with a
  warning when they are older than the last weekday (exchange holidays are not known, so the day
  after one may warn) or when the latest update run failed (its message, with web addresses and
  long keys removed). Code: `lib/domain/investments/freshness.ts` (tested),
  `investments/components/PriceStatus.tsx`.
- **Loading:** the tradebook import sheet, and the .xlsx/.csv readers, load only when used.
- **Guide:** [`INVESTMENTS.md`](INVESTMENTS.md).

## Overview

- **Purpose:** the whole picture at a glance: net worth (accounts, funds, shares, PF), insights,
  cash flow, salary & PF, spending by category, budget use, recent activity.
- **Layout:** net worth, this month's figures and cash flow; insights; Salary & PF beside
  spending by category; budget and investments beside recent activity. Phones stack them in
  that order. The Salary & PF and spending cards load after the first paint.
- **Net worth:** accounts (Savings & investments included: PPF, FD, RD), funds, shares and PF.
  Credit card accounts are left out; what is owed on them shows as an insight. A Savings &
  investments account whose name says it holds mutual funds (mutual fund, MF, SIP, ELSS,
  equity) or shares (stocks, shares, demat, equity, broker) is left out while you track funds or
  shares, because those are valued at market price on the investment pages; the Net worth card
  names it and Accounts marks it "Not in net worth". Rename the account to change this. Code:
  `lib/domain/expenses/netWorth.ts` (tested).
  With funds or shares, "Prices as of …" under the figure gives the older of their price dates
  (`PricesAsOf.tsx`), marked when out of date.
  **Trend:** a sparkline of net worth at each month end over the last 12 months, counted the
  same way: account balances from their entries, funds and shares at the last price stored for
  each month (the investment pages' growth series), PF as entered. Account opening balances
  have no date, so months before your first entry are left out rather than guessed
  (`netWorthHistory`, `NetWorthTrend.tsx`).
- **Cash flow:** income and spending for 8 months (this month hatched); the tooltip adds what
  was saved, and a line gives last month's saving and the 6-month average.
- **Salary & PF:** the newest net pay (month, employer), this financial year's gross, net and
  TDS with TDS as a share of gross, the PF balance (your share incl. VPF and interest, the
  employer's share) and the pension (EPS) apart, as on the PF page. Charts: net pay by month for
  the last 12 months (gross and TDS in the tooltip) and the PF balance at each month end over
  the last 24 months. Without payslips or PF entries it offers Import payslips. Code:
  `SalaryPfCard.tsx`, `salaryOverview` in `lib/domain/insights/` (tested).
- **Spending by category:** drawn like Expenses → Stats: a pie in rank colours and the ranking
  with share badges for this month's five largest categories and Other, each with the change
  against the same days of last month (`spendingMix`). Pressing a category opens it in Stats.
- **This month:** three charted panels, then the insights in two groups.
  - **Income kept** (`monthPulse`, `savingsRates`): this month's share as a ring, against the
    six months before, and each of the last seven months as a bar (touch one for income and
    the amount kept).
  - **Spending pace** (`spendingPace`): spending added up day by day this month, against last
    month's at the same day (dashed), with where it is heading (spent so far plus what the rest
    of a month usually costs, `projectMonthEnd`, from the 5th).
  - **Cash would last:** months that bank, cash and wallets cover at the last three months'
    average spend, on a 0–12 month gauge.
  - **Needs a look** (warnings) and **Good to know** (the rest; three shown, "Show more" for
    the others). Each line opens the page where it is acted on (Budget, Accounts, Stats,
    Expenses or Salary & PF). Rules: card dues, budget alerts, spending pace against the same
    days last month, the category that rose most, recurring entries due this week, the largest
    expense.
    Salary and PF: a missing payslip (the newest one's month ended over 45 days ago, not after
    leaving or a break of 6 months), a raise (gross up 5% or more on the month before or the same
    month last year) or an unusually low month (10% or more down, naming a missing pay line), TDS
    so far with about how much by March at the newest payslip's rate (arithmetic only, no tax
    advice; otherwise the last salary), finished years without PF interest, the employer share
    missing on recent payslips, and how much PF grew this financial year. Nothing leaves the
    device for this. Code: `features/overview/insights.ts`, `lib/domain/insights/` (tested),
    `InsightsCard.tsx`, `PulsePanel.tsx`, `PacePanel.tsx`.
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

## Reports

- **Purpose:** one period's money in one place: income, spending (by category, with the change
  on the period before), savings rate, investments bought and sold, dividends, salary and the PF
  account, for a month, a calendar year or a financial year (April–March). A period still under
  way is compared with the same number of days of the one before.
- **Access:** Reports (desktop rail; **More** on phones). **Download PDF** saves it (web; phones
  later, with a share sheet).
- **Code:** `lib/domain/reports/` (period, report, PDF; tested), `features/reports/`. The PDF
  writer is shared with the CV (`lib/files/pdf/`).
- **Data:** none of its own; reads the expense, portfolio and salary stores. Nothing leaves the
  device to build it.

## On a phone (web app)

- **Install:** `public/manifest.webmanifest` (name, `/dashboard` start, standalone, icons from
  `assets/` made by `scripts/make-web-icons.py`) and `public/index.html`, the page template Expo
  uses for this single-page export (`+html.tsx` is only used by static or server output). No
  inline scripts (the CSP is `script-src 'self'`). There is no service worker: no offline mode.
- **Keyboard:** the viewport uses `interactive-widget=resizes-content`, so Android Chrome shrinks
  the page above the keyboard; on iPhone Safari bottom sheets add the keyboard's height as
  padding (`components/overlays/useKeyboardInset.ts`) so **Save** stays visible.
- **First download:** the preview's sample data (`features/preview/sampleData.ts`), the
  spreadsheet readers, the CV's PDF and Word writers and the tradebook import load with
  `import()` when needed; signed-in users never download the sample data. The report PDF writer
  is still part of the first download (the Reports screen calls it directly).
- **Loading errors:** if your data cannot be loaded, the message says whether you are offline or
  the server is not responding (5xx, timeouts, e.g. a paused Supabase project), with **Try
  again**; coming back online retries by itself (`features/sync/CloudGate.tsx`, `loadError.ts`).
- **Database updates needed:** signed in, Settings lists features hidden because their migration
  has not been run (0012 recurring, 0013 goals, 0015 note reminders, 0016 salary, 0018 reset,
  the last once a reset has been tried), with the file names (`features/settings/dbUpdates.ts`).
- **Accessibility:** small controls (icon buttons, chips, small buttons) get a 44 px touch area
  on the web too (`components/ui/HitArea.tsx`; React Native Web ignores `hitSlop`); radios set
  `aria-checked` explicitly; a closed sheet returns focus to the control that opened it.
