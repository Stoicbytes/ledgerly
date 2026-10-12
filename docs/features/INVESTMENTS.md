# Mutual funds and stocks

How the investment pages work: what you can record, where prices come from, and how every number
is calculated. Server setup (migrations 0007 and 0009, the price function and its schedule) is in
[`SUPABASE_SETUP.md`](../../SUPABASE_SETUP.md#mutual-funds-and-stocks-migration-0007).

## Mutual funds

**Add a fund**: Mutual funds → **Add fund**.

- **From the AMFI list** (signed in, once prices are set up): type three letters of the scheme
  name or its AMFI code and pick it. The fund is linked to its scheme: name, category and fund
  house come from AMFI, and its NAV is updated automatically.
- **By hand**: type the name, pick a type (Equity, Debt, Hybrid, Index & ETF, Gold & silver,
  Other) and, if you like, a NAV with its date. Use this for funds not in the list.
- Folio number and notes are optional. **Archive** hides a fund once it has no units left.

**Record transactions**: open a fund → **Add transaction**.

| Type       | What to enter                         | Notes                                                                                                                                                                                          |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase   | NAV date, amount paid, NAV            | Lump sum, SIP instalment, switch in or reinvested dividend. Stamp duty (0.005 %) is filled in; units are worked out as (amount − stamp duty) ÷ NAV to 3 decimals, or typed from the statement. |
| Redemption | NAV date, amount received, NAV, units | Switch outs too. Refused if more units than were held on that date.                                                                                                                            |
| Dividend   | Date, amount paid out                 | Counted as a return; no units.                                                                                                                                                                 |

For a fund linked to AMFI, **Use AMFI NAV for this date** fills in the NAV published on that
date (or the last one before it on a holiday) from stored history.

**SIP plans**: in a fund, **Add SIP**: monthly amount, day (1–28), start and optional end date;
pause it with **Active**. The SIPs card lists instalments that are due but not recorded (with
**Record**, pre-filled) and the next month's instalments. Any purchase of that fund within a few
days of the date counts as the instalment, so purchases brought in by a tradebook import are not
asked for again.

**SIP step-up** (migration 0013): a yearly increase in percent. The instalment rises once for
every full year since the start date (₹5,000 at 10 %: ₹5,500 in year two, ₹6,050 in year three);
the SIPs card, **Record** and the monthly total use the stepped amount. The sheet also estimates
ten years of it at a yearly return you type (not saved).

**Insights** (button on the Mutual funds page):

- **Capital gains**: every redemption split over the purchases it used (first in, first out),
  by financial year (April–March), as the tax return groups them: equity short term (12 months
  or less) and long term; debt bought from 1 April 2023 at your slab rate; older debt short or
  long term (24 months, or 36 for sales before 23 July 2024); hybrid, index and other funds
  listed **to check**, since that depends on how much of the fund is in Indian shares. It notes
  the yearly equity long-term exemption (₹1.25 lakh from FY 2024-25, ₹1 lakh before) and
  units bought before 1 February 2018 (grandfathering). **Export** gives a CSV for your CA. It
  classifies gains; it does not compute tax. Check your CAMS/KFintech capital gains statement
  before filing.
- **Goals** (migration 0013): a name, amount, date and a yearly return you assume. Tie funds to
  a goal in **Edit fund → Goal**; the goal shows their value against the target, the time left
  and about how much a month would close the gap at that return (an estimate).
- **Costs** (migration 0013): enter each fund's expense ratio (TER, from its factsheet) in
  **Edit fund**; this shows what each fund and all of them cost per year at today's value.
  **Similar funds** lists funds you hold in the same category, which often hold the same
  shares; it is a hint from the category, not from the funds' actual holdings (which the app
  does not have).

## Stocks

**Add a stock**: Stocks → **Add stock**. Search the listed shares (signed in, once prices are set
up) or enter the symbol, exchange (NSE/BSE) and company name by hand. Pick a sector for the sector
chart. A price entered by hand (with its date) is used when there is no newer closing price.

**Trades**: open a stock (press its row twice, or **Details**) → **Add trade**.

| Type     | What to enter                       | How it counts                                                               |
| -------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Buy      | Shares, price, charges              | Cost = shares × price + charges                                             |
| Sell     | Shares, price, charges              | Refused if more than held on that date. Proceeds = shares × price − charges |
| Dividend | Amount received                     | A return; shares unchanged                                                  |
| Bonus    | New : held (e.g. 1 : 1)             | New shares at zero cost, dated on the ex-date                               |
| Split    | From → to (e.g. 1 → 5 for ₹10 → ₹2) | Shares multiplied; cost and purchase dates unchanged                        |

Bonus issues and splits apply to the shares held before that day; whole shares only (fractions
are paid in cash and rounded down). ETFs and listed bonds can be tracked as stocks.

## Shares against an index

Stocks → **vs Index** (signed in, migration 0014) shows what your shares would be worth had the
same money gone into an index fund instead: each buy puts the same amount into the fund at that
day's NAV, and each sale (after charges) or dividend takes the same amount out. It shows both
values today, the difference, and the return a year of each once your first trade is a year old.

- **The index fund** is yours to choose from the AMFI list; the search starts at Nifty 50 index
  funds (direct plan, growth option). **Change** picks another (Sensex, Nifty Next 50, …).
- **Why a fund, not the index itself:** its NAV is after the fund's costs and with dividends
  reinvested, so it is something you could actually have bought. The NAVs come from AMFI (daily)
  and mfapi.in (older history) through the market-refresh function, like your funds' NAVs.
- **No history yet** (just chosen): press **Update prices** in the sheet. If the fund started
  after your first trade, choose an older one.
- **A sale bigger than the index holding** (your shares grew much faster) empties the fund
  holding; the sheet says so.

## Import a tradebook (Zerodha)

Add new trades from the tradebooks Zerodha Console gives you, after checking them. Run migration
0009 first ([`SUPABASE_SETUP.md`](../../SUPABASE_SETUP.md#fund-isins-for-imports-migration-0009)).

1. In Zerodha Console: **Reports → Tradebook**, segment **Equity** or **Mutual funds**, pick the
   dates, download (`.xlsx` or `.csv`). Several files at once is fine; overlapping dates too.
2. Mutual funds or Stocks → **Import** → **Choose files**.
3. **Review.** The files are read on your device and nothing is uploaded. For each fund or share
   you see:
   - every trade it would add: date, buy or sell, units or shares, NAV or price, amount;
   - how many of the file's trades are already in the app (they are not added again);
   - units or shares and invested amount, now → after the import;
   - "New fund" or "New stock" when it is not in the app yet.

   Every trade has a tick box; the holding's switch ticks or unticks all of it. A trade that
   may already be in the app under other figures is marked **Possible duplicate** and starts
   unticked (below). If unticking a purchase leaves a later sale with nothing to sell, the
   holding says so and **Approve** waits until you tick it back or untick the sale. **Cannot be
   added** lists what would not fit (below).

4. **Approve and add N trades.** Only then is anything saved, in one batch, with the same checks
   as trades typed by hand. **Cancel** keeps everything as it was.

How it decides:

- **Same holding**: by ISIN, otherwise the fund name (Direct/Regular, case and punctuation
  ignored) or the share symbol.
- **Shares** are grouped by symbol, so trades from before and after a split or face-value change
  (which gives the share a new ISIN) stay one holding; it keeps the newest ISIN.
- **Already in the app**: same date, type, units (shares) and NAV (price). The same trade in two
  files counts once. A file covering a whole year when one month is missing adds only that month.
- **Possible duplicate** (unticked, you decide): a trade in the app on the same day and side that
  no file trade matched exactly, because its price differs (corrected or rounded), because
  several fills in the file add up to it (one order executed in parts), or simply because there
  is one that day. Changing an imported trade's charges does not affect matching.
- **Amount** = units × NAV (shares × price) to the paisa, as Kite shows it. Tradebooks have no stamp
  duty or charges; edit a trade afterwards to add them.
- **Earlier sales left out**: a sale of units bought before the file starts cannot be added (the
  app would hold fewer than zero). The fewest such trades are left out and listed; a holding that
  only sells is under **Cannot be added**. An older tradebook that covers the purchases adds them.
- A new fund is named from the file and has no AMFI scheme yet: edit it and pick the scheme to get
  automatic NAVs. A new share uses the symbol from the file; its price comes with the next update.

Choosing files works in the web app; the phone apps say so for now. Only Zerodha's tradebook
layout is read today.

## Prices

| What                  | Source                                                                      | When                                                       |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Fund NAVs             | AMFI daily NAV file (official)                                              | Daily schedule; **Update prices** at most every 30 minutes |
| Share prices          | NSE end-of-day file (BSE if NSE is unavailable): closing and previous close | Same                                                       |
| Older NAVs for charts | mfapi.in, only for schemes you hold                                         | After you add a fund with older purchases                  |

- Prices are **end of day**. Under each page title: "NAVs as of Tue, 7 Oct (AMFI)".
- A holding's price is the newest of: the market price, a price you entered by hand, and
  otherwise the price of your latest transaction (each labelled in the details).
- Prices are fetched on the server; the app never contacts AMFI or the exchanges. Until the price
  function is deployed, **Update prices** says so and manual prices work as usual.

## How the numbers are worked out

- **Units and shares held** replay every transaction in date order (purchases before redemptions
  on the same day; bonus and splits before trades). The database checks the same order and refuses
  a sale of units or shares not held.
- **Invested** is the cost of what you still hold, first in first out: a redemption uses the
  oldest units first, and their cost leaves "invested". Stamp duty and charges are part of cost.
- **Average cost** = invested ÷ units (or shares) held.
- **Value** = units × NAV (shares × price), rounded to paise once.
- **Unrealised gain** = value − invested. **Realised gain** = proceeds − FIFO cost of what was
  sold. Dividends are shown with realised gains.
- **XIRR** is the annual rate that makes every purchase (money in), sale and dividend (money out)
  and today's value add up to zero, taking each date into account. It suits SIPs, where money goes
  in at different times. It is shown once the first money went in at least a year ago: before
  that, annualising blows small moves up (2 % in a month would read as 27 % a year), so younger
  holdings show only their gain on cost (as fund statements do).
- **Day change** = holdings × (latest price − previous price), from AMFI history or the exchange's
  previous close.
- **Allocation** groups funds by AMFI category (Equity, Debt, Hybrid, Index & ETF, Gold & silver,
  Other) and stocks by the sector you chose.
- **Growth** shows month-end value against the cost of what you held then, using stored NAV and
  price history (or your own transaction prices before that).

## Not yet

- Tax amounts (rates change by budget; the capital gains report classifies gains only), capital
  gains for shares, and real fund overlap (needs each fund's monthly portfolio).
- Importing a CAMS/KFintech consolidated account statement, and tradebooks from other brokers
  (Zerodha tradebooks import today, [above](#import-a-tradebook-zerodha)).
- Live share prices (needs a paid or broker data provider), price alerts, benchmark comparison.

See [`ROADMAP.md`](../architecture/ROADMAP.md) for when these arrive.
