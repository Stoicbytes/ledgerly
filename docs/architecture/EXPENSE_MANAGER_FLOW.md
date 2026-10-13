# Expense Manager: Logical Flow and Screen Plan

> Scope: the Expenses module of `apps/command-center`.
> References: the earlier expense tracker (calendar view) and the Money Manager app by Realbyte Inc. (transaction entry, category grid with subcategories, stats pie, category management).
> Status (Oct 2026): **implemented** in `apps/command-center` and saved to Supabase when signed in (a labelled sample-data preview otherwise). Later additions (recurring entries, search and CSV export, receipts, the calculator) are described in [`../features/README.md`](../features/README.md).

---

## 1. What we take from each reference

| From                              | Keep                                                                                                                                                                                            | Improve                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner's tracker                   | Month navigator; Income / Expenses / Net / Balance strip with "vs last month"; account filter pills; Calendar ⇄ Transactions ⇄ Insights views; category donut + recent list beside the calendar | One consistent visual system; correct bank balance (card bills reduce bank cash); compact layout with no page scroll on desktop                  |
| Money Manager — Trans.            | Daily / Calendar / Monthly views of the same month; Income · Exp. · Total summary; day headers with day totals; floating **+**                                                                  | Same three views on web, with a details panel beside them instead of separate screens                                                            |
| Money Manager — Add               | Income / Expense / Transfer switch; Date → Amount → Category → Account → Note order; picker panel for the active field; **Save** and **Continue**                                               | Auto-advance between fields, category search, "general" option for a parent with subcategories, recent-note suggestions, inline validation, undo |
| Money Manager — Category grid     | 3-column grid; a parent with subcategories expands **in place** beneath its row                                                                                                                 | Icons and colour tints, keyboard and screen-reader support                                                                                       |
| Money Manager — Stats             | Income / Expense toggle with totals; month/year period; pie with callout labels; ranked list with coloured % badges                                                                             | Drill-down to subcategories, a 6-month trend and the category's transactions; colours stay attached to a category, not its rank                  |
| Money Manager — Budget            | Per-category monthly budget vs spent                                                                                                                                                            | Overall budget hero, daily allowance, inline budget editing                                                                                      |
| Money Manager — Category settings | Expense / Income lists, "Subcategory" toggle, `Food(80)` counts with previews, edit, reorder, delete                                                                                            | Delete asks where existing transactions should go, with undo; duplicate names are prevented                                                      |

---

## 2. Information architecture

```
Expenses (top nav)                       Accounts (left rail)
├── Transactions   /dashboard/expenses   └── /dashboard/accounts
│     views: Daily · Calendar · Monthly       Assets · Liabilities · Total
├── Stats          /dashboard/expenses/stats   groups → accounts → open filtered transactions
├── Budget         /dashboard/expenses/budget
└── Categories     /dashboard/expenses/categories

Add / edit transaction: one sheet, reachable from everywhere
  ("Add" on any expense page, the Overview quick actions, any transaction row)
```

Shared state across Expenses pages:

- the selected month (one navigator, so switching tabs keeps the period)
- the account filter
- the selected calendar day, which becomes the default date for new entries

---

## 3. Entities and money rules

| Entity          | Fields (preview store ≈ planned tables)                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account**     | `name`, `group` (cash · bank · card · wallet · investment · loan), `openingBalance` (paise, signed: negative = owed), `order`                                                                           |
| **Category**    | `kind` (expense · income), `parentId` (null = top level; one level of subcategories), `name`, `icon`, `tint`, `budget` (monthly, top-level expense only), `order`                                       |
| **Transaction** | `kind` (expense · income · transfer), `date`, `amount` (paise > 0), `accountId`, `toAccountId` (transfer), `fee` (transfer, paise ≥ 0), `categoryId` (leaf: subcategory or parent), `note`, `createdAt` |

**Rules.** These are pure functions in `src/lib/domain/expenses`, all unit-tested:

1. **Balances.**
   - An income adds to its account; an expense subtracts from its account.
   - A transfer subtracts **amount + fee** from the source and adds **amount** to the destination.
   - Cards hold a negative balance (money owed), so a card purchase makes it more negative and a card bill payment (a transfer bank → card) brings it back towards zero.
   - A card bill payment therefore reduces the bank balance as well as the card debt.
2. **Income / Expense totals** count income and expense transactions. They **exclude transfers**: moving money between your own accounts is neither earning nor spending. A transfer **fee** is a real cost, so it counts as an expense and shows in Stats as "Transfer fees".
3. **"Savings" and "Credit card bill" are transfers, not expense categories.** Treating them as expenses double-counts spending: the card purchases are already expenses, and money moved into investments is not spent. Seed data models a SIP as bank → Investments and a bill as bank → card. The future CSV importer maps these old categories to transfers (plan §21).
4. **Assets / Liabilities / Total:** Assets are the sum of positive account balances, liabilities the sum of negative ones, and Total = assets + liabilities.
5. **Account filter.** When an account is selected:
   - totals count only that account's income and expenses (fees on transfers out of it count too);
   - lists also show transfers in and out of it;
   - Balance shows that account's balance alone.
6. **Category deletion** must say where existing transactions go: either another category of the same kind, or _Uncategorized_. Deleting a subcategory moves its transactions to the parent. Every destructive action can be undone.

---

## 4. Primary flows

### 4.1 Add an expense (fast path, about 4 interactions)

1. Open: press the "Add" button on any expense page (or an Overview quick action).
   - **Type** defaults to the last used type, otherwise Expense.
   - **Date** defaults to the selected calendar day, otherwise today.
   - **Account** defaults to the last used one.
2. **Amount** is focused with the numeric keyboard. Enter or "Next" opens the category grid.
3. **Category grid.**
   - Tapping a parent without subcategories selects it.
   - Tapping a parent with subcategories expands them beneath its row; you then pick a subcategory or "All ‹Food›".
   - Search filters parents and subcategories.
   - **Missing category?** Create it without leaving the entry: when a search finds no match, `Create "…"` adds it and selects it; `+ New` at the end of an opened category's subcategories adds a subcategory there; "New … category" under the grid adds a top-level one. New items get a default icon and colour (subcategories take their parent's), editable later in Categories; names must be unique among their siblings.
   - Choosing a category jumps to **Account** (skipped when the default account is already set) and then to **Note**.
4. **Note.** Suggestions show recent notes for the chosen category. Enter saves.
5. **Save** closes the sheet and shows "Expense added · Undo". **Continue** saves and keeps the type, date and account for the next entry.

### 4.2 Transfer, card bill or SIP

Choose **Transfer**. The fields become **From**, **To**, **Amount** and **Fee**; From and To must differ. Both balances update and the totals are unchanged.

### 4.3 Review and correct

- Browse by **Daily** (grouped list with day totals), **Calendar** (per-day income and expense) or **Monthly** (12 months, expandable weeks).
- Click any row to open the same sheet in edit mode, which has **Delete** with undo.
- In the calendar, a day click shows that day's entries and an "Add on this day" button.

### 4.4 Understand spending

- **Stats**: pick Income or Expenses and Month or Year to see the pie and ranked list.
- Click a category to drill down to subcategories, its 6-month trend and its transactions.
- **Budget** shows the overall budget, daily allowance and per-category bars; budgets are edited inline.

### 4.5 Organise

- **Categories**: Expense or Income list with a Subcategories toggle, counts and previews.
- The editor covers name, icon, colour, budget and subcategories (add, rename, reorder, delete).
- **Accounts**: groups with balances. Clicking an account opens its transactions; accounts can be added or edited.

---

## 5. Screen layout per breakpoint

| Screen                      | Desktop (no page scroll; panels scroll)                                                                                       | Tablet / phone (scroll)                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Header (all Expenses pages) | Title · section tabs · month navigator · Add                                                                                  | Title + Add; section tabs and navigator on their own rows         |
| Transactions                | Summary strip (Income · Expenses · Total · Balance) → view switcher + account filter → view (8 cols) + context panel (4 cols) | Summary row of 3, view switcher, account chips, view, panel below |
| Calendar                    | 6-week grid filling the height; context panel shows the selected day                                                          | Shorter fixed row height; day details below                       |
| Daily                       | Grouped list; panel shows the month's category donut and top categories                                                       | List only, donut below                                            |
| Monthly                     | 12-month table with expandable weeks; panel shows a year bar chart and totals                                                 | Table, chart below                                                |
| Stats                       | Pie with callouts (6 cols) and ranked list / drill-down (6 cols)                                                              | Pie (callouts kept short), list below                             |
| Budget                      | Budget hero and per-category list                                                                                             | Same, stacked                                                     |
| Categories                  | List (5 cols) and editor (7 cols)                                                                                             | List; the editor opens as a sheet                                 |
| Add / edit                  | Dialog: fields on the left, active picker on the right                                                                        | Bottom sheet: fields, picker beneath, sticky Save / Continue      |

---

## 6. Validation (client now; mirrored by database constraints in Phase 3)

- **Amount:** greater than 0 and at most ₹100 crore, with up to 2 decimals. Accepts "1,250.50" and "₹ 250".
- **Date:** a real calendar date.
- **Income / Expense:** a category of the same kind and an existing account.
- **Transfer:** two different existing accounts, and a fee of 0 or more.
- **Note:** at most 120 characters.
- **Category names:** 1–30 characters, unique within their parent (case-insensitive); likewise for subcategories.

Errors appear under the field and are announced to screen readers. On save, focus moves to the first invalid field.

---

## 7. Accessibility and keyboard

- Every tile and row is a real button with a name. The selected category or account is announced as "selected".
- Enter advances between fields; Escape closes the sheet; Tab order follows the visual order.
- Amounts always carry a sign or label (never colour alone). Calendar cells announce the date and that day's totals.

---

## 8. Test plan

- **Domain:** balances (including the card-bill regression), totals excluding transfers with fees counted, day/calendar/month/week grouping, category and subcategory breakdowns, trends, budgets, amount parsing, draft validation.
- **Store:** add / edit / delete with undo; category delete with reassignment and undo; subcategory delete moving its transactions to the parent; reorder.
- **Components:** category grid expand → select subcategory; the form's fast path (amount → category → account → note → save); validation messages.

---

## 8a. Additions (October 2026)

**Subcategory focus in Stats.** Inside a category, pressing a subcategory (pie slice or row) focuses it: the trend line, the total row and the entry list follow that subcategory; "All ‹category›" or pressing it again returns. Entries filed directly under the parent are the "(general)" slice.

**Note suggestions.** Typing in the note field suggests notes from earlier entries of the same kind, ranked by: used with the chosen category, then match quality (starts with › a word starts with › contains), then how often, then how recently. Picking one fills the note and, when no category is chosen yet, the category it is usually filed under.

**People and split expenses.**

- A **person** is someone you share expenses with (managed like categories; deletable only when unused).
- An expense can carry **splits**: shares that people owe you. Your **own share** = amount − splits. Stats, budgets and income/expense totals count only your own share; the paying account still pays the full amount.
- **Split modes:** _Equally_ (with you) and _They pay all_ work the shares out from the amount and update when the amount or the people change (odd paise stay with you, or are spread so the others pay exactly the amount). Typing a share switches to _Custom_, which adds a **You** row: everyone's shares, yours included, must add up to the amount before saving (a live line says what is left or too much; _Rest to me_ fills the gap). Editing an expense recognises its mode.
- When someone pays you back, a **repayment** is recorded: income linked to the person, into the account that received it. It raises that account's balance but is **not income** (excluded from totals and Stats).
- A repayment can name the **expenses it was for** ("Mark paid" on one shared expense): those shares are settled first, and anything extra goes to the person's oldest open shares. A general payment ("Record payment") settles the **oldest shares first**. Each share shows Paid (amount struck out), part paid (original struck out above what is left) or a _Mark paid_ button.
- Expenses › **People** lists everyone with what they owe; a person's page lists shared expenses and repayments (both open in the edit sheet).

**Receipt photos.** Any expense or income can carry one photo, taken with the camera or uploaded (images only: JPEG, PNG, WebP, HEIC; up to 10 MB; compressed; no EXIF requested). Rows with a photo show a camera mark; the sheet shows a thumbnail and a full-size viewer. In the preview the photo stays in memory; signed in, it is stored in the private `receipts` bucket (migration 0011) and shown through one-minute links.

**Phones: pickers under their field.** On phones the picker for the active field (category grid, accounts, date, split, note suggestions) opens directly under that field instead of at the end of the form; wide screens keep the picker column beside the fields.

## 9. Path to real data (Phases 2–3)

| Preview store action                       | Phase 3 replacement                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saveTransaction`                          | `insert` / `update` on `transactions` (RLS; composite FKs; `version` check) via TanStack Query mutation with optimistic update                                                                                                                                                              |
| `deleteTransaction` / `restoreTransaction` | soft delete (`deleted_at`) and undo within 30 days                                                                                                                                                                                                                                          |
| `transfer`                                 | the `create_transfer` RPC (atomic; both accounts must belong to the caller)                                                                                                                                                                                                                 |
| category / account actions                 | `categories` / `accounts` tables; reassignment through one RPC (single transaction)                                                                                                                                                                                                         |
| calculations                               | unchanged pure functions, plus SQL read models (`f_monthly_cashflow`, `v_account_balances`) tested against the same fixtures                                                                                                                                                                |
| people / splits / repayments               | `people` table; `transaction_splits (transaction_id, person_id, amount)` with a check that splits ≤ amount; repayment = income row with `person_id` (excluded from the income read models) and `repayment_settles (repayment_id, transaction_id)` for payments made for particular expenses |
| receipt photo                              | private `attachments` bucket, `{user_id}/{uuid}` paths, 60-second signed URLs, EXIF stripped before upload (plan §8.5)                                                                                                                                                                      |

The seed data and the preview banner go away once the repositories are connected.

---

## 10. Implementation map

| Area                   | Route                            | Code                                                                                                                                           |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules and calculations | —                                | `src/lib/domain/expenses/` (balances, periods, categories, breakdowns, budgets, dates, validation), unit-tested against a hand-checked fixture |
| Preview store and seed | —                                | `src/features/expenses/state/` (`expenseStore`, `expenseUi`, `transactionForm`, seed files)                                                    |
| Transactions           | `/dashboard/expenses`            | `screens/TransactionsScreen` + `components/` (header, summary, Calendar / Daily / Monthly, panels)                                             |
| Add / edit sheet       | global                           | `entry/` (`TransactionSheet`, fields, category / account / date pickers), opened by Add buttons, Overview quick actions and any row            |
| Stats                  | `/dashboard/expenses/stats`      | `stats/` + `components/charts/PieChart` (callout layout in `pieLayout.ts`)                                                                     |
| Budget                 | `/dashboard/expenses/budget`     | `budget/`                                                                                                                                      |
| Categories             | `/dashboard/expenses/categories` | `categories/`                                                                                                                                  |
| Accounts               | `/dashboard/accounts`            | `accounts/`                                                                                                                                    |
| Overview               | `/dashboard`                     | `features/overview/useOverviewData` reads the same ledger; fund and stock values are still samples                                             |
| People and splits      | `/dashboard/expenses/people`     | `lib/domain/expenses/people.ts`, `people/`, `entry/SplitField.tsx`, `state/peopleActions.ts`                                                   |
| Note suggestions       | global sheet                     | `lib/domain/expenses/notes.ts`, `entry/EntryPanel.tsx`                                                                                         |
| Receipt photos         | global sheet                     | `lib/domain/expenses/photos.ts`, `photos/` (`expo-image-picker`)                                                                               |

**Verified (web, headless Chromium):** every page at 1440×900, 1366×768, 1366×705, 820×1180 and 390×844 in light and dark. Fit pages do not scroll at desktop sizes, nothing overflows horizontally, and there are no console errors. An end-to-end run covered Quick add from the Overview through Transport › Bus, Cash, a note and Enter to save, the toast with Undo, the Overview total rising by exactly ₹250, the entry appearing under today, and Escape closing the sheet. Native (iOS/Android) rendering has not been verified in the authoring environment.

**Known limits of the preview:** nothing is persisted. Search is still a placeholder. Mutual fund purchases and stock trades open clearly labelled "planned" sheets. Recurring entries and CSV import/export are not part of this step (plan §21–22); photos are not uploaded until Phase 3.
