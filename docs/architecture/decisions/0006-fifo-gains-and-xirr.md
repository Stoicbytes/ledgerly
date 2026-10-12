# 0006. Gains by FIFO lots; returns as XIRR

- Status: Accepted
- Date: 2026-10-09

## Context

Investors need to know what they paid for what they still hold, what they gained on what they
sold, and how fast their money grew when it went in at different times (SIPs).

## Decision

- Holdings are replayed transaction by transaction in a fixed order (by date; for funds purchases,
  dividends, redemptions; for shares bonus and split first, then buys, dividends, sales). Sales use
  the oldest units or shares first (FIFO), as Indian capital-gains rules do.
- Cost includes stamp duty (funds) and charges (shares). Bonus shares cost nothing and are dated
  on allotment. Splits keep the cost and the original purchase date. Fractions from bonus or split
  are rounded down (paid in cash).
- Returns are XIRR over every cash flow plus today's value (Newton's method with a bisection
  fallback), shown with an absolute gain on cost.
- The database replays the same order to refuse a sale of units or shares not held.

## Consequences

- Realised lots carry buy and sell dates, ready for a capital-gains report by financial year.
- Tax amounts are not computed yet: rates and exemptions change by budget and must not be
  hard-coded without a source and a date. The report will show holding periods and gains first.
