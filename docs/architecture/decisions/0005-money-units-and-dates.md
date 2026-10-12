# 0005. Money in paise, units and NAVs as exact decimals, calendar dates

- Status: Accepted
- Date: 2026-10-07 (units and NAVs added 2026-10-09)

## Context

Floating-point rupees drift (0.1 + 0.2). Fund statements show units to 3–4 decimals and NAVs to 4. Times zones must never move a transaction to another day.

## Decision

- Money is an integer number of paise everywhere (database `bigint`, app `number`), formatted only
  for display.
- Fund units and NAVs are `numeric(18,4)` in the database; app calculations convert units to
  integer ten-thousandths, so adding and splitting lots is exact. Value = units × NAV, rounded to
  paise once.
- Share quantities are whole numbers; prices are paise per share.
- Dates are calendar dates (`YYYY-MM-DD`), parsed at local noon.

## Consequences

- No rounding drift in totals; the same numbers on every screen and in the database.
- Every input path must parse to these units (helpers: `parseAmount`, `parseDecimal`,
  `parseWhole`).
