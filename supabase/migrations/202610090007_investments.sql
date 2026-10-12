-- Phase 6–7: mutual funds and stocks on real data. Apply after 202610080006_ledger_sync.sql.
--
-- Two kinds of tables:
--   * MARKET DATA (mf_schemes, mf_nav_history, securities, security_prices,
--     market_refresh_runs): public prices shared by every account. Signed-in users can
--     only read them. They are written only by the `market-refresh` Edge Function
--     (service role, server side), which downloads the official AMFI NAV file and the
--     exchange end-of-day price file. The browser never fetches market data.
--   * YOUR INVESTMENTS (mf_funds, mf_sips, mf_transactions, stocks, stock_trades): the
--     same template as the ledger tables (0005): owner-only RLS, two-step sign-in (aal2)
--     once it is on, composite foreign keys, CHECKs, audit entries without values.
--
-- Money is integer paise. Fund units and NAVs are exact decimals (4 places). Holdings can
-- never go negative: a deferred check replays each fund's or stock's history after every
-- change, so the database refuses a sale of units or shares you did not hold.
--
-- load_ledger() and sync_ledger() are replaced to carry the new tables, so the app keeps
-- one load and one atomic save for everything.
--
-- Rollback (drops the investment tables WITH their data; export first):
--   drop function if exists public.load_market(), public.search_funds(text),
--     public.search_securities(text), public.nav_on(integer, date),
--     public.market_ingest_schemes(jsonb), public.market_ingest_nav_history(integer, jsonb),
--     public.market_ingest_prices(jsonb, text, date), public.market_run_start(text, text),
--     public.market_run_finish(bigint, text, integer, date, text), public.market_status(),
--     public.market_held_schemes();
--   drop table if exists public.stock_trades, public.stocks, public.mf_transactions,
--     public.mf_sips, public.mf_funds, public.security_prices, public.securities,
--     public.mf_nav_history, public.mf_schemes, public.market_refresh_runs;
--   then re-run 202610080006_ledger_sync.sql to restore the previous load/save functions.

-- ---------------------------------------------------------------------------
-- Market data (shared, read-only for signed-in users)
-- ---------------------------------------------------------------------------
create or replace function internal.valid_isin(p_isin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'
$$;
-- Used in CHECK constraints, which run as the caller.
grant usage on schema internal to service_role;
grant execute on function internal.valid_isin(text) to authenticated, service_role;

create table if not exists public.mf_schemes (
  scheme_code integer primary key check (scheme_code > 0),
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 200),
  fund_house text not null default '' check (pg_catalog.char_length(fund_house) <= 120),
  category text not null default '' check (pg_catalog.char_length(category) <= 160),
  isin_growth text check (isin_growth is null or internal.valid_isin(isin_growth)),
  isin_reinvest text check (isin_reinvest is null or internal.valid_isin(isin_reinvest)),
  nav numeric(18, 4) check (nav is null or nav > 0),
  nav_date date,
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.mf_nav_history (
  scheme_code integer not null references public.mf_schemes (scheme_code) on delete cascade,
  nav_date date not null,
  nav numeric(18, 4) not null check (nav > 0),
  primary key (scheme_code, nav_date)
);

create table if not exists public.securities (
  isin text primary key check (internal.valid_isin(isin)),
  symbol text not null check (symbol ~ '^[A-Z0-9&._-]{1,30}$'),
  name text not null default '' check (pg_catalog.char_length(name) <= 200),
  exchange text not null check (exchange in ('NSE', 'BSE')),
  series text not null default '' check (pg_catalog.char_length(series) <= 4),
  -- Paise per share.
  close bigint check (close is null or close > 0),
  prev_close bigint check (prev_close is null or prev_close > 0),
  price_date date,
  updated_at timestamptz not null default pg_catalog.now()
);
create index if not exists securities_symbol_idx on public.securities (symbol);

create table if not exists public.security_prices (
  isin text not null references public.securities (isin) on delete cascade,
  trade_date date not null,
  close bigint not null check (close > 0),
  primary key (isin, trade_date)
);

create table if not exists public.market_refresh_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('amfi', 'nse', 'bse', 'mfapi')),
  triggered_by text not null default 'schedule' check (triggered_by in ('schedule', 'user')),
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  started_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz,
  data_date date,
  row_count integer not null default 0 check (row_count >= 0),
  -- A short, user-safe summary. Never secrets or response bodies.
  message text not null default '' check (pg_catalog.char_length(message) <= 300)
);
create index if not exists market_refresh_runs_source_idx
  on public.market_refresh_runs (source, started_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['mf_schemes', 'mf_nav_history', 'securities', 'security_prices',
    'market_refresh_runs'] loop
    execute pg_catalog.format('alter table public.%I enable row level security', t);
    execute pg_catalog.format('alter table public.%I force row level security', t);
    execute pg_catalog.format('revoke all on table public.%I from public, anon, authenticated', t);
    execute pg_catalog.format('grant select on table public.%I to authenticated', t);
    execute pg_catalog.format('grant select, insert, update, delete on table public.%I to service_role', t);
    execute pg_catalog.format('drop policy if exists %I on public.%I', t || '_read', t);
    execute pg_catalog.format(
      'create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;
grant usage on sequence public.market_refresh_runs_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Your mutual funds
-- ---------------------------------------------------------------------------
create table if not exists public.mf_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- AMFI scheme when picked from the list; null for a fund entered by hand.
  scheme_code integer references public.mf_schemes (scheme_code) on delete set null,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 200),
  category text not null default '' check (pg_catalog.char_length(category) <= 160),
  fund_house text not null default '' check (pg_catalog.char_length(fund_house) <= 120),
  folio text not null default '' check (pg_catalog.char_length(folio) <= 40),
  -- Used when there is no AMFI NAV (fund entered by hand, or prices not set up yet).
  manual_nav numeric(18, 4) check (manual_nav is null or manual_nav > 0),
  manual_nav_date date check (manual_nav_date between date '1990-01-01' and date '2100-12-31'),
  note text not null default '' check (pg_catalog.char_length(note) <= 500),
  archived boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check ((manual_nav is null) = (manual_nav_date is null))
);
create index if not exists mf_funds_user_idx on public.mf_funds (user_id, sort_order);
create index if not exists mf_funds_scheme_idx on public.mf_funds (scheme_code);
select internal.secure_user_table('mf_funds', true);

create table if not exists public.mf_sips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fund_id uuid not null,
  amount bigint not null check (amount between 100 and 10000000000),
  day_of_month smallint not null check (day_of_month between 1 and 28),
  start_date date not null check (start_date between date '1990-01-01' and date '2100-12-31'),
  end_date date,
  active boolean not null default true,
  note text not null default '' check (pg_catalog.char_length(note) <= 200),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (end_date is null or end_date >= start_date),
  foreign key (fund_id, user_id) references public.mf_funds (id, user_id) on delete cascade
);
create index if not exists mf_sips_fund_idx on public.mf_sips (fund_id);
select internal.secure_user_table('mf_sips', true);

create table if not exists public.mf_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fund_id uuid not null,
  -- buy (lump sum, SIP instalment, switch in, reinvested dividend), sell (redemption,
  -- switch out), dividend (paid out to the bank).
  kind text not null check (kind in ('buy', 'sell', 'dividend')),
  -- The NAV (allotment) date.
  trade_date date not null check (trade_date between date '1990-01-01' and date '2100-12-31'),
  -- Paise. buy: amount paid including stamp duty; sell: proceeds; dividend: amount paid.
  amount bigint not null check (amount between 1 and 1000000000000),
  stamp_duty bigint not null default 0 check (stamp_duty between 0 and 100000000),
  units numeric(18, 4) check (units is null or (units > 0 and units < 1000000000000)),
  nav numeric(18, 4) check (nav is null or nav > 0),
  sip_id uuid,
  note text not null default '' check (pg_catalog.char_length(note) <= 300),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (
    (kind = 'dividend' and units is null and nav is null and stamp_duty = 0 and sip_id is null)
    or (kind in ('buy', 'sell') and units is not null and nav is not null)
  ),
  check (kind = 'buy' or stamp_duty = 0),
  check (kind = 'buy' or sip_id is null),
  check (stamp_duty < amount),
  foreign key (fund_id, user_id) references public.mf_funds (id, user_id) on delete cascade,
  foreign key (sip_id, user_id) references public.mf_sips (id, user_id) on delete set null (sip_id)
);
create index if not exists mf_transactions_fund_idx
  on public.mf_transactions (fund_id, trade_date);
create index if not exists mf_transactions_sip_idx on public.mf_transactions (sip_id);
select internal.secure_user_table('mf_transactions', true);

-- Replays a fund's history: units held may never go below zero. Same order as the app:
-- by date, purchases before redemptions on the same day.
create or replace function internal.check_fund_units()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fund uuid;
  v_lowest numeric;
begin
  -- Both the fund the row is in now and the one it was in (a row moved between funds).
  foreach v_fund in array pg_catalog.array_remove(array[
    (pg_catalog.to_jsonb(new) ->> 'fund_id')::uuid, (pg_catalog.to_jsonb(old) ->> 'fund_id')::uuid
  ], null) loop
    select pg_catalog.min(running) into v_lowest from (
      select pg_catalog.sum(case t.kind when 'buy' then t.units when 'sell' then -t.units else 0 end)
        over (order by t.trade_date, case t.kind when 'buy' then 0 when 'dividend' then 1 else 2 end,
              t.created_at, t.id rows unbounded preceding) as running
      from public.mf_transactions t where t.fund_id = v_fund
    ) s;
    if v_lowest < 0 then
      raise exception 'Redemption is more than the units held on that date' using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function internal.check_fund_units() from public, anon, authenticated;
drop trigger if exists check_fund_units on public.mf_transactions;
create constraint trigger check_fund_units after insert or update or delete
  on public.mf_transactions deferrable initially deferred
  for each row execute function internal.check_fund_units();

-- An SIP instalment must belong to the same fund as its plan.
create or replace function internal.check_sip_fund()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sip_id is not null and not exists (
    select 1 from public.mf_sips s where s.id = new.sip_id and s.fund_id = new.fund_id
  ) then
    raise exception 'The SIP belongs to another fund' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function internal.check_sip_fund() from public, anon, authenticated;
drop trigger if exists check_sip_fund on public.mf_transactions;
create trigger check_sip_fund before insert or update of sip_id, fund_id
  on public.mf_transactions for each row execute function internal.check_sip_fund();

-- ---------------------------------------------------------------------------
-- Your stocks
-- ---------------------------------------------------------------------------
create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  isin text check (isin is null or internal.valid_isin(isin)),
  symbol text not null check (symbol ~ '^[A-Z0-9&._-]{1,30}$'),
  exchange text not null default 'NSE' check (exchange in ('NSE', 'BSE')),
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 200),
  sector text not null default '' check (pg_catalog.char_length(sector) <= 60),
  -- Paise per share; used when there is no exchange price.
  manual_price bigint check (manual_price is null or manual_price between 1 and 100000000000),
  manual_price_date date check (manual_price_date between date '1990-01-01' and date '2100-12-31'),
  note text not null default '' check (pg_catalog.char_length(note) <= 500),
  archived boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check ((manual_price is null) = (manual_price_date is null))
);
create unique index if not exists stocks_user_symbol_key on public.stocks (user_id, exchange, symbol);
create index if not exists stocks_isin_idx on public.stocks (isin);
select internal.secure_user_table('stocks', true);

create table if not exists public.stock_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stock_id uuid not null,
  -- bonus: ratio_to new shares for every ratio_from held. split: ratio_from shares become
  -- ratio_to (1:5 for a face value of 10 → 2). Fractions are paid out in cash, so whole
  -- shares are kept (rounded down).
  kind text not null check (kind in ('buy', 'sell', 'bonus', 'split', 'dividend')),
  trade_date date not null check (trade_date between date '1990-01-01' and date '2100-12-31'),
  quantity bigint check (quantity is null or quantity between 1 and 1000000000),
  -- Paise per share.
  price bigint check (price is null or price between 1 and 100000000000),
  -- Brokerage, STT, exchange and GST charges in paise.
  charges bigint not null default 0 check (charges between 0 and 100000000000),
  -- Dividend received, in paise.
  amount bigint check (amount is null or amount between 1 and 1000000000000),
  ratio_from integer check (ratio_from is null or ratio_from between 1 and 1000),
  ratio_to integer check (ratio_to is null or ratio_to between 1 and 1000),
  note text not null default '' check (pg_catalog.char_length(note) <= 300),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (
    (kind in ('buy', 'sell') and quantity is not null and price is not null and amount is null
      and ratio_from is null and ratio_to is null)
    or (kind = 'bonus' and quantity is null and price is null and amount is null and charges = 0
      and ratio_from is not null and ratio_to is not null)
    or (kind = 'split' and quantity is null and price is null and amount is null and charges = 0
      and ratio_from is not null and ratio_to is not null and ratio_from <> ratio_to)
    or (kind = 'dividend' and quantity is null and price is null and amount is not null
      and ratio_from is null and ratio_to is null and charges = 0)
  ),
  foreign key (stock_id, user_id) references public.stocks (id, user_id) on delete cascade
);
create index if not exists stock_trades_stock_idx on public.stock_trades (stock_id, trade_date);
select internal.secure_user_table('stock_trades', true);

-- Replays a stock's history: shares held may never go below zero. Same order as the app:
-- by date; bonus and split first (they apply to shares held before that day), then
-- purchases, dividends, sales.
create or replace function internal.check_stock_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_stock uuid;
  v_held bigint;
  r record;
begin
  -- Both the stock the row is in now and the one it was in (a row moved between stocks).
  foreach v_stock in array pg_catalog.array_remove(array[
    (pg_catalog.to_jsonb(new) ->> 'stock_id')::uuid, (pg_catalog.to_jsonb(old) ->> 'stock_id')::uuid
  ], null) loop
    v_held := 0;
    for r in
      select t.kind, t.quantity, t.ratio_from, t.ratio_to from public.stock_trades t
      where t.stock_id = v_stock
      order by t.trade_date,
        case t.kind when 'bonus' then 0 when 'split' then 0 when 'buy' then 1
          when 'dividend' then 2 else 3 end,
        t.created_at, t.id
    loop
      if r.kind = 'buy' then
        v_held := v_held + r.quantity;
      elsif r.kind = 'sell' then
        v_held := v_held - r.quantity;
        if v_held < 0 then
          raise exception 'Sale is more than the shares held on that date' using errcode = '23514';
        end if;
      elsif r.kind = 'bonus' then
        v_held := v_held + (v_held * r.ratio_to) / r.ratio_from;
      elsif r.kind = 'split' then
        v_held := (v_held * r.ratio_to) / r.ratio_from;
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
revoke all on function internal.check_stock_quantity() from public, anon, authenticated;
drop trigger if exists check_stock_quantity on public.stock_trades;
create constraint trigger check_stock_quantity after insert or update or delete
  on public.stock_trades deferrable initially deferred
  for each row execute function internal.check_stock_quantity();

-- The refresh function reads which schemes and stocks are held (never amounts).
grant select on table public.mf_funds, public.mf_transactions, public.stocks, public.stock_trades
  to service_role;

-- ---------------------------------------------------------------------------
-- Load and save (replaces the 0006 versions; same rules, more tables)
-- ---------------------------------------------------------------------------
create or replace function public.load_ledger()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'accounts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) - 'user_id' order by a.sort_order, a.created_at)
      from public.accounts a), '[]'),
    'categories', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - 'user_id' order by c.sort_order, c.created_at)
      from public.categories c), '[]'),
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) - 'user_id' order by p.sort_order, p.created_at)
      from public.people p), '[]'),
    'transactions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - 'user_id' order by t.occurred_on, t.created_at)
      from public.transactions t), '[]'),
    'splits', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) - 'user_id' - 'created_at')
      from public.transaction_splits s), '[]'),
    'settles', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) - 'user_id' - 'created_at')
      from public.repayment_settles r), '[]'),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(n) - 'user_id' order by n.updated_at desc)
      from public.notes n), '[]'),
    'mf_funds', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) - 'user_id' order by f.sort_order, f.created_at)
      from public.mf_funds f), '[]'),
    'mf_sips', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) - 'user_id' order by s.created_at)
      from public.mf_sips s), '[]'),
    'mf_transactions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - 'user_id' order by t.trade_date, t.created_at)
      from public.mf_transactions t), '[]'),
    'stocks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) - 'user_id' order by s.sort_order, s.created_at)
      from public.stocks s), '[]'),
    'stock_trades', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - 'user_id' order by t.trade_date, t.created_at)
      from public.stock_trades t), '[]')
  )
$$;
revoke all on function public.load_ledger() from public, anon;
grant execute on function public.load_ledger() to authenticated;

create or replace function public.sync_ledger(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'Changes must be a JSON object' using errcode = '22023';
  end if;
  if pg_catalog.octet_length(p_changes::text) > 5242880 then
    raise exception 'Too many changes at once' using errcode = '22023';
  end if;
  foreach v_key in array array['accounts', 'categories', 'people', 'transactions', 'notes',
    'mf_funds', 'mf_sips', 'mf_transactions', 'stocks', 'stock_trades'] loop
    if p_changes ? v_key and (pg_catalog.jsonb_typeof(p_changes -> v_key) is distinct from 'array'
      or pg_catalog.jsonb_array_length(p_changes -> v_key) > 5000) then
      raise exception 'Invalid % list', v_key using errcode = '22023';
    end if;
  end loop;

  insert into public.accounts (id, name, account_group, opening_balance, sort_order)
  select r.id, r.name, r.account_group, r.opening_balance, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'accounts', '[]'))
    as r(id uuid, name text, account_group text, opening_balance bigint, sort_order integer)
  on conflict (id) do update set
    name = excluded.name, account_group = excluded.account_group,
    opening_balance = excluded.opening_balance, sort_order = excluded.sort_order;

  insert into public.people (id, name, sort_order)
  select r.id, r.name, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'people', '[]'))
    as r(id uuid, name text, sort_order integer)
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

  -- Top-level categories first, so subcategories find their parent.
  insert into public.categories (id, kind, parent_id, name, icon, tint, budget, sort_order)
  select r.id, r.kind, r.parent_id, r.name, r.icon, r.tint, r.budget, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'categories', '[]'))
    as r(id uuid, kind text, parent_id uuid, name text, icon text, tint smallint,
         budget bigint, sort_order integer)
  order by r.parent_id is not null
  on conflict (id) do update set
    kind = excluded.kind, parent_id = excluded.parent_id, name = excluded.name,
    icon = excluded.icon, tint = excluded.tint, budget = excluded.budget,
    sort_order = excluded.sort_order;

  insert into public.transactions (
    id, kind, occurred_on, amount, account_id, to_account_id, fee, category_id, note,
    person_id, created_at)
  select r.id, r.kind, r.occurred_on, r.amount, r.account_id, r.to_account_id,
    coalesce(r.fee, 0), r.category_id, coalesce(r.note, ''), r.person_id,
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'transactions', '[]'))
    as r(id uuid, kind text, occurred_on date, amount bigint, account_id uuid,
         to_account_id uuid, fee bigint, category_id uuid, note text, person_id uuid,
         created_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind, occurred_on = excluded.occurred_on, amount = excluded.amount,
    account_id = excluded.account_id, to_account_id = excluded.to_account_id,
    fee = excluded.fee, category_id = excluded.category_id, note = excluded.note,
    person_id = excluded.person_id;

  -- Splits and settles of the saved transactions are replaced as a whole.
  delete from public.transaction_splits s
  using pg_catalog.jsonb_array_elements(coalesce(p_changes -> 'transactions', '[]')) as t
  where s.transaction_id = (t ->> 'id')::uuid;
  insert into public.transaction_splits (transaction_id, person_id, amount)
  select (t ->> 'id')::uuid, (s ->> 'person_id')::uuid, (s ->> 'amount')::bigint
  from pg_catalog.jsonb_array_elements(coalesce(p_changes -> 'transactions', '[]')) as t,
    pg_catalog.jsonb_array_elements(coalesce(t -> 'splits', '[]')) as s;

  delete from public.repayment_settles r
  using pg_catalog.jsonb_array_elements(coalesce(p_changes -> 'transactions', '[]')) as t
  where r.repayment_id = (t ->> 'id')::uuid;
  insert into public.repayment_settles (repayment_id, expense_id)
  select (t ->> 'id')::uuid, e.value::uuid
  from pg_catalog.jsonb_array_elements(coalesce(p_changes -> 'transactions', '[]')) as t,
    pg_catalog.jsonb_array_elements_text(coalesce(t -> 'settles', '[]')) as e;

  insert into public.notes (id, title, body, items, color, pinned, archived, labels, created_at)
  select r.id, coalesce(r.title, ''), coalesce(r.body, ''), r.items, coalesce(r.color, 'default'),
    coalesce(r.pinned, false), coalesce(r.archived, false), coalesce(r.labels, '{}'),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'notes', '[]'))
    as r(id uuid, title text, body text, items jsonb, color text, pinned boolean,
         archived boolean, labels text[], created_at timestamptz)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, items = excluded.items,
    color = excluded.color, pinned = excluded.pinned, archived = excluded.archived,
    labels = excluded.labels;

  insert into public.mf_funds (id, scheme_code, name, category, fund_house, folio, manual_nav,
    manual_nav_date, note, archived, sort_order, created_at)
  select r.id, r.scheme_code, r.name, coalesce(r.category, ''), coalesce(r.fund_house, ''),
    coalesce(r.folio, ''), r.manual_nav, r.manual_nav_date, coalesce(r.note, ''),
    coalesce(r.archived, false), coalesce(r.sort_order, 0), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_funds', '[]'))
    as r(id uuid, scheme_code integer, name text, category text, fund_house text, folio text,
         manual_nav numeric, manual_nav_date date, note text, archived boolean,
         sort_order integer, created_at timestamptz)
  on conflict (id) do update set
    scheme_code = excluded.scheme_code, name = excluded.name, category = excluded.category,
    fund_house = excluded.fund_house, folio = excluded.folio, manual_nav = excluded.manual_nav,
    manual_nav_date = excluded.manual_nav_date, note = excluded.note,
    archived = excluded.archived, sort_order = excluded.sort_order;

  insert into public.mf_sips (id, fund_id, amount, day_of_month, start_date, end_date, active,
    note, created_at)
  select r.id, r.fund_id, r.amount, r.day_of_month, r.start_date, r.end_date,
    coalesce(r.active, true), coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_sips', '[]'))
    as r(id uuid, fund_id uuid, amount bigint, day_of_month smallint, start_date date,
         end_date date, active boolean, note text, created_at timestamptz)
  on conflict (id) do update set
    fund_id = excluded.fund_id, amount = excluded.amount, day_of_month = excluded.day_of_month,
    start_date = excluded.start_date, end_date = excluded.end_date, active = excluded.active,
    note = excluded.note;

  insert into public.mf_transactions (id, fund_id, kind, trade_date, amount, stamp_duty, units,
    nav, sip_id, note, created_at)
  select r.id, r.fund_id, r.kind, r.trade_date, r.amount, coalesce(r.stamp_duty, 0), r.units,
    r.nav, r.sip_id, coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_transactions', '[]'))
    as r(id uuid, fund_id uuid, kind text, trade_date date, amount bigint, stamp_duty bigint,
         units numeric, nav numeric, sip_id uuid, note text, created_at timestamptz)
  on conflict (id) do update set
    fund_id = excluded.fund_id, kind = excluded.kind, trade_date = excluded.trade_date,
    amount = excluded.amount, stamp_duty = excluded.stamp_duty, units = excluded.units,
    nav = excluded.nav, sip_id = excluded.sip_id, note = excluded.note;

  insert into public.stocks (id, isin, symbol, exchange, name, sector, manual_price,
    manual_price_date, note, archived, sort_order, created_at)
  select r.id, r.isin, r.symbol, coalesce(r.exchange, 'NSE'), r.name, coalesce(r.sector, ''),
    r.manual_price, r.manual_price_date, coalesce(r.note, ''), coalesce(r.archived, false),
    coalesce(r.sort_order, 0), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'stocks', '[]'))
    as r(id uuid, isin text, symbol text, exchange text, name text, sector text,
         manual_price bigint, manual_price_date date, note text, archived boolean,
         sort_order integer, created_at timestamptz)
  on conflict (id) do update set
    isin = excluded.isin, symbol = excluded.symbol, exchange = excluded.exchange,
    name = excluded.name, sector = excluded.sector, manual_price = excluded.manual_price,
    manual_price_date = excluded.manual_price_date, note = excluded.note,
    archived = excluded.archived, sort_order = excluded.sort_order;

  insert into public.stock_trades (id, stock_id, kind, trade_date, quantity, price, charges,
    amount, ratio_from, ratio_to, note, created_at)
  select r.id, r.stock_id, r.kind, r.trade_date, r.quantity, r.price, coalesce(r.charges, 0),
    r.amount, r.ratio_from, r.ratio_to, coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'stock_trades', '[]'))
    as r(id uuid, stock_id uuid, kind text, trade_date date, quantity bigint, price bigint,
         charges bigint, amount bigint, ratio_from integer, ratio_to integer, note text,
         created_at timestamptz)
  on conflict (id) do update set
    stock_id = excluded.stock_id, kind = excluded.kind, trade_date = excluded.trade_date,
    quantity = excluded.quantity, price = excluded.price, charges = excluded.charges,
    amount = excluded.amount, ratio_from = excluded.ratio_from, ratio_to = excluded.ratio_to,
    note = excluded.note;

  -- Deletes last: entries before the things they use.
  delete from public.transactions where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,transactions}', '[]'))::uuid);
  delete from public.notes where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,notes}', '[]'))::uuid);
  delete from public.categories where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,categories}', '[]'))::uuid);
  delete from public.people where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,people}', '[]'))::uuid);
  delete from public.accounts where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,accounts}', '[]'))::uuid);
  delete from public.mf_transactions where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,mf_transactions}', '[]'))::uuid);
  delete from public.mf_sips where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,mf_sips}', '[]'))::uuid);
  delete from public.mf_funds where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,mf_funds}', '[]'))::uuid);
  delete from public.stock_trades where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,stock_trades}', '[]'))::uuid);
  delete from public.stocks where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,stocks}', '[]'))::uuid);
end;
$$;
revoke all on function public.sync_ledger(jsonb) from public, anon;
grant execute on function public.sync_ledger(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Market data for the signed-in user's holdings (read side)
-- ---------------------------------------------------------------------------

-- Prices for the caller's own funds and stocks (RLS limits the holdings to theirs):
-- latest NAV/close, the previous one for the day change, daily points for the last
-- 400 days and month-end points before that (enough for charts), and the latest
-- refresh per source.
create or replace function public.load_market()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with held_schemes as (
    select f.scheme_code, pg_catalog.min(t.trade_date) as since
    from public.mf_funds f left join public.mf_transactions t on t.fund_id = f.id
    where f.scheme_code is not null
    group by f.scheme_code
  ),
  held_isins as (
    select s.isin, pg_catalog.min(t.trade_date) as since
    from public.stocks s left join public.stock_trades t on t.stock_id = s.id
    where s.isin is not null
    group by s.isin
  ),
  nav_points as (
    select h.scheme_code, n.nav_date, n.nav,
      pg_catalog.row_number() over (
        partition by h.scheme_code, pg_catalog.date_trunc('month', n.nav_date)
        order by n.nav_date desc) as month_rank
    from held_schemes h join public.mf_nav_history n on n.scheme_code = h.scheme_code
    where n.nav_date >= coalesce(h.since, current_date) - 7
  ),
  price_points as (
    select h.isin, p.trade_date, p.close,
      pg_catalog.row_number() over (
        partition by h.isin, pg_catalog.date_trunc('month', p.trade_date)
        order by p.trade_date desc) as month_rank
    from held_isins h join public.security_prices p on p.isin = h.isin
    where p.trade_date >= coalesce(h.since, current_date) - 7
  )
  select pg_catalog.jsonb_build_object(
    'schemes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'scheme_code', m.scheme_code, 'name', m.name, 'fund_house', m.fund_house,
        'category', m.category, 'nav', m.nav, 'nav_date', m.nav_date))
      from public.mf_schemes m where m.scheme_code in (select scheme_code from held_schemes)), '[]'),
    'nav_history', coalesce((
      select pg_catalog.jsonb_object_agg(x.scheme_code::text, x.points) from (
        select p.scheme_code, pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_array(p.nav_date, p.nav) order by p.nav_date) as points
        from nav_points p
        where p.nav_date >= current_date - 400 or p.month_rank = 1
        group by p.scheme_code) x), '{}'),
    'securities', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'isin', s.isin, 'symbol', s.symbol, 'name', s.name, 'exchange', s.exchange,
        'close', s.close, 'prev_close', s.prev_close, 'price_date', s.price_date))
      from public.securities s where s.isin in (select isin from held_isins)), '[]'),
    'price_history', coalesce((
      select pg_catalog.jsonb_object_agg(x.isin, x.points) from (
        select p.isin, pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_array(p.trade_date, p.close) order by p.trade_date) as points
        from price_points p
        where p.trade_date >= current_date - 400 or p.month_rank = 1
        group by p.isin) x), '{}'),
    'runs', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'source', r.source, 'status', r.status, 'finished_at', r.finished_at,
        'data_date', r.data_date, 'message', r.message))
      from (
        select distinct on (source) * from public.market_refresh_runs
        where status <> 'running'
        order by source, started_at desc) r), '[]')
  )
$$;
revoke all on function public.load_market() from public, anon;
grant execute on function public.load_market() to authenticated;

-- Fund search for "Add fund": every word must appear in the name (or an exact scheme
-- code). Schemes with a recent NAV (still open) come first.
create or replace function public.search_funds(p_query text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select pg_catalog.btrim(pg_catalog.left(coalesce(p_query, ''), 80)) as text
  ),
  words as (
    select w from q, pg_catalog.regexp_split_to_table(pg_catalog.lower(q.text), '\s+') as w
    where w <> ''
  )
  select coalesce(pg_catalog.jsonb_agg(x order by x.rank, x.name), '[]') from (
    select m.scheme_code, m.name, m.fund_house, m.category, m.nav, m.nav_date,
      case when m.nav_date >= current_date - 30 then 0 else 1 end as rank
    from public.mf_schemes m, q
    where pg_catalog.char_length(q.text) >= 2
      and (
        m.scheme_code = case when q.text ~ '^[0-9]{3,7}$' then q.text::integer end
        or not exists (
          select 1 from words
          where pg_catalog.strpos(pg_catalog.lower(m.name), words.w) = 0)
      )
    order by rank, m.name
    limit 25
  ) x
$$;
revoke all on function public.search_funds(text) from public, anon;
grant execute on function public.search_funds(text) to authenticated;

-- Stock search for "Add stock": symbol prefix first, then name words.
create or replace function public.search_securities(p_query text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select pg_catalog.upper(pg_catalog.btrim(pg_catalog.left(coalesce(p_query, ''), 60))) as text
  ),
  words as (
    select w from q, pg_catalog.regexp_split_to_table(pg_catalog.lower(q.text), '\s+') as w
    where w <> ''
  )
  select coalesce(pg_catalog.jsonb_agg(x order by x.rank, x.symbol), '[]') from (
    select s.isin, s.symbol, s.name, s.exchange, s.close, s.prev_close, s.price_date,
      case when s.symbol = q.text then 0 when pg_catalog.starts_with(s.symbol, q.text) then 1
        else 2 end as rank
    from public.securities s, q
    where pg_catalog.char_length(q.text) >= 1
      and (
        pg_catalog.starts_with(s.symbol, q.text)
        or s.isin = q.text
        or (pg_catalog.char_length(q.text) >= 3 and not exists (
          select 1 from words where pg_catalog.strpos(pg_catalog.lower(s.name), words.w) = 0))
      )
    order by rank, s.symbol
    limit 25
  ) x
$$;
revoke all on function public.search_securities(text) from public, anon;
grant execute on function public.search_securities(text) to authenticated;

-- The NAV published on a date, or the last one before it (for recording a purchase).
create or replace function public.nav_on(p_scheme_code integer, p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('nav', n.nav, 'nav_date', n.nav_date)
  from public.mf_nav_history n
  where n.scheme_code = p_scheme_code and n.nav_date <= p_date and n.nav_date >= p_date - 10
  order by n.nav_date desc
  limit 1
$$;
revoke all on function public.nav_on(integer, date) from public, anon;
grant execute on function public.nav_on(integer, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Market data writes: only the market-refresh Edge Function (service role)
-- ---------------------------------------------------------------------------

-- Upserts the AMFI scheme list with the latest NAVs, and records the day's NAV in the
-- history of every scheme someone holds.
create or replace function public.market_ingest_schemes(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.mf_schemes as m (scheme_code, name, fund_house, category, isin_growth,
    isin_reinvest, nav, nav_date, updated_at)
  select r.scheme_code, pg_catalog.left(r.name, 200), pg_catalog.left(coalesce(r.fund_house, ''), 120),
    pg_catalog.left(coalesce(r.category, ''), 160),
    case when internal.valid_isin(r.isin_growth) then r.isin_growth end,
    case when internal.valid_isin(r.isin_reinvest) then r.isin_reinvest end,
    case when r.nav > 0 then r.nav end, r.nav_date, pg_catalog.now()
  from pg_catalog.jsonb_to_recordset(p_rows)
    as r(scheme_code integer, name text, fund_house text, category text, isin_growth text,
         isin_reinvest text, nav numeric, nav_date date)
  where r.scheme_code > 0 and pg_catalog.char_length(pg_catalog.btrim(coalesce(r.name, ''))) > 0
  on conflict (scheme_code) do update set
    name = excluded.name, fund_house = excluded.fund_house, category = excluded.category,
    isin_growth = excluded.isin_growth, isin_reinvest = excluded.isin_reinvest,
    nav = coalesce(excluded.nav, m.nav), nav_date = coalesce(excluded.nav_date, m.nav_date),
    updated_at = excluded.updated_at;
  get diagnostics v_count = row_count;

  insert into public.mf_nav_history (scheme_code, nav_date, nav)
  select m.scheme_code, m.nav_date, m.nav from public.mf_schemes m
  where m.nav is not null and m.nav_date is not null
    and m.scheme_code in (select f.scheme_code from public.mf_funds f where f.scheme_code is not null)
  on conflict (scheme_code, nav_date) do update set nav = excluded.nav;
  return v_count;
end;
$$;

-- Adds older NAVs for one scheme (backfill for charts): [[date, nav], ...].
create or replace function public.market_ingest_nav_history(p_scheme_code integer, p_points jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.mf_nav_history (scheme_code, nav_date, nav)
  select p_scheme_code, (p ->> 0)::date, (p ->> 1)::numeric
  from pg_catalog.jsonb_array_elements(p_points) as p
  where (p ->> 1)::numeric > 0
  on conflict (scheme_code, nav_date) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Upserts one day's exchange closing prices, and records the history of every stock
-- someone holds. Rows: [{ isin, symbol, name, series, close, prev_close }] in paise.
create or replace function public.market_ingest_prices(p_rows jsonb, p_exchange text, p_date date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.securities as s (isin, symbol, name, exchange, series, close, prev_close,
    price_date, updated_at)
  select distinct on (r.isin) r.isin, r.symbol, pg_catalog.left(coalesce(r.name, ''), 200),
    p_exchange, pg_catalog.left(coalesce(r.series, ''), 4),
    case when r.close > 0 then r.close end, case when r.prev_close > 0 then r.prev_close end,
    p_date, pg_catalog.now()
  from pg_catalog.jsonb_to_recordset(p_rows)
    as r(isin text, symbol text, name text, series text, close bigint, prev_close bigint)
  where internal.valid_isin(r.isin) and r.symbol ~ '^[A-Z0-9&._-]{1,30}$'
  order by r.isin, case r.series when 'EQ' then 0 else 1 end
  on conflict (isin) do update set
    symbol = excluded.symbol, name = excluded.name, exchange = excluded.exchange,
    series = excluded.series, close = excluded.close, prev_close = excluded.prev_close,
    price_date = excluded.price_date, updated_at = excluded.updated_at
  where s.price_date is null or s.price_date <= excluded.price_date;
  get diagnostics v_count = row_count;

  insert into public.security_prices (isin, trade_date, close)
  select s.isin, s.price_date, s.close from public.securities s
  where s.close is not null and s.price_date = p_date
    and s.isin in (select k.isin from public.stocks k where k.isin is not null)
  on conflict (isin, trade_date) do update set close = excluded.close;
  return v_count;
end;
$$;

create or replace function public.market_run_start(p_source text, p_triggered_by text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  -- Keep the log short: the last 100 runs per source.
  delete from public.market_refresh_runs r
  where r.source = p_source and r.id not in (
    select k.id from public.market_refresh_runs k where k.source = p_source
    order by k.started_at desc limit 99);
  insert into public.market_refresh_runs (source, triggered_by)
  values (p_source, p_triggered_by) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.market_run_finish(p_id bigint, p_status text, p_rows integer,
  p_data_date date, p_message text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.market_refresh_runs set status = p_status, row_count = greatest(coalesce(p_rows, 0), 0),
    data_date = p_data_date, message = pg_catalog.left(coalesce(p_message, ''), 300),
    finished_at = pg_catalog.now()
  where id = p_id
$$;

-- When each source last finished (the function uses it to avoid refreshing too often).
create or replace function public.market_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_object_agg(r.source, pg_catalog.jsonb_build_object(
    'status', r.status, 'started_at', r.started_at, 'finished_at', r.finished_at,
    'data_date', r.data_date)), '{}')
  from (
    select distinct on (source) * from public.market_refresh_runs
    order by source, started_at desc) r
$$;

-- Schemes held by anyone, with the earliest NAV already stored and the user who holds
-- them (backfill is only done for schemes the requesting user holds).
create or replace function public.market_held_schemes()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(x), '[]') from (
    select f.scheme_code, pg_catalog.array_agg(distinct f.user_id) as user_ids,
      (select pg_catalog.min(n.nav_date) from public.mf_nav_history n
        where n.scheme_code = f.scheme_code) as first_nav_date,
      (select pg_catalog.min(t.trade_date) from public.mf_transactions t
        join public.mf_funds g on g.id = t.fund_id where g.scheme_code = f.scheme_code) as first_trade_date
    from public.mf_funds f where f.scheme_code is not null
    group by f.scheme_code
  ) x
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.market_ingest_schemes(jsonb)', 'public.market_ingest_nav_history(integer, jsonb)',
    'public.market_ingest_prices(jsonb, text, date)', 'public.market_run_start(text, text)',
    'public.market_run_finish(bigint, text, integer, date, text)', 'public.market_status()',
    'public.market_held_schemes()'] loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', f);
    execute pg_catalog.format('grant execute on function %s to service_role', f);
  end loop;
end $$;
