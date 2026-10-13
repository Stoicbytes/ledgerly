# Architecture decision records

One short file per decision that shapes the system: the context, what was decided, and what it
costs. A decision is changed by adding a new record that supersedes the old one (the old one
stays, marked "Superseded by …").

| #                                                  | Decision                                                                              | Status                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------- |
| [0001](0001-expo-universal-app.md)                 | One Expo (React Native + web) codebase for web, iOS and Android                       | Accepted                  |
| [0002](0002-supabase-rls-as-security-boundary.md)  | Supabase, with Row Level Security and database constraints as the security boundary   | Accepted                  |
| [0003](0003-batch-sync-through-rpcs.md)            | Load everything once, save changes as one atomic batch through RPCs                   | Accepted                  |
| [0004](0004-market-data-on-the-server.md)          | Market data fetched on the server from official end-of-day files                      | Accepted                  |
| [0005](0005-money-units-and-dates.md)              | Money in integer paise, units and NAVs as exact 4-decimal values, calendar dates      | Accepted                  |
| [0006](0006-fifo-gains-and-xirr.md)                | Gains by first-in-first-out lots; returns as XIRR                                     | Accepted                  |
| [0007](0007-import-inside-the-database.md)         | Import the old app's data inside the database, checked before it is kept              | Superseded by 0008        |
| [0008](0008-start-from-scratch.md)                 | Start from scratch: retire the old app's data, load investments once from Zerodha     | Accepted                  |
| [0009](0009-tradebook-import-on-device.md)         | Tradebooks read on the device, reviewed and approved before anything is saved         | Accepted                  |
| [0010](0010-public-portfolio-site.md)              | A separate public portfolio site, edited in the dashboard and published as a snapshot | Partly superseded by 0011 |
| [0011](0011-portfolio-at-the-dashboard-address.md) | The portfolio is the home page of the dashboard's address, with a Dashboard button    | Accepted                  |
| [0012](0012-web-loads-screens-on-demand.md)        | The web app loads screens on demand and ships subset fonts                            | Accepted                  |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

What forces are at play.

## Decision

What we do.

## Consequences

What becomes easier, what becomes harder, and what we watch.
```
