# 0004. Market data on the server, from official end-of-day files

- Status: Accepted
- Date: 2026-10-09

## Context

Fund and share values need prices. Rules for this project: never fetch or scrape financial sites
from the client, never hard-code market data, never ship provider secrets to the browser. There
is no free, official live-quote service for NSE/BSE shares; commercial feeds and broker APIs need
paid plans or daily logins.

## Decision

- A `market-refresh` Edge Function downloads, on the server:
  - AMFI's daily NAV file (official; every scheme, with ISINs and categories);
  - the exchange end-of-day file (NSE bhavcopy, BSE as a fallback): closing and previous close;
  - older NAVs for held schemes from mfapi.in (charts only; unofficial but stable).
- It writes shared market tables that users can only read; history is kept only for held schemes
  and shares. Every run is logged with its data date and a short message.
- It runs on a daily schedule (pg_cron) and when the user presses "Update prices" (at most every
  30 minutes).
- Values always show "as of" a date and source; a manual NAV or price overrides a missing one.

## Consequences

- Share values are end of day, not live. A live-quote provider can be added behind the same
  function and tables once one is chosen (it would need its key as a function secret).
- The exchange file location or format can change; parsers find columns by name and a run with too
  few rows fails loudly instead of storing bad data.
- Exchange websites may block automated downloads; the BSE fallback and manual prices keep the
  app usable.
