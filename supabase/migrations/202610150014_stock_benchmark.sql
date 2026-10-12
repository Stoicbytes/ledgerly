-- Compare shares with an index. Apply after 202610140013_fund_goals.sql.
--
--   * stock_benchmarks: the index fund each user compares their shares with (one per user),
--     chosen in the app from the AMFI list (for example a Nifty 50 index fund).
--   * market_ingest_schemes and market_held_schemes also cover these funds, so the
--     market-refresh function keeps their daily NAVs and fetches their older history,
--     as it does for funds you hold. The Edge Function itself is unchanged.
--   * load_stock_benchmark returns the chosen fund and its daily NAVs from a little before
--     your first share trade; set_stock_benchmark chooses or clears it.
--
-- Rollback (removes the choice; NAV history already stored stays):
--   drop function if exists public.load_stock_benchmark(), public.set_stock_benchmark(integer);
--   drop table if exists public.stock_benchmarks;
--   then re-run market_ingest_schemes and market_held_schemes from 202610090007_investments.sql.

create table if not exists public.stock_benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() unique references auth.users (id) on delete cascade,
  scheme_code integer not null references public.mf_schemes (scheme_code) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create index if not exists stock_benchmarks_scheme_idx on public.stock_benchmarks (scheme_code);
select internal.secure_user_table('stock_benchmarks', true);
-- The refresh function reads which funds are chosen (as it reads which are held).
grant select on table public.stock_benchmarks to service_role;

-- Chooses the caller's index fund (null clears it). Returns the scheme code kept.
create or replace function public.set_stock_benchmark(p_scheme_code integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_scheme_code is null then
    delete from public.stock_benchmarks where user_id = auth.uid();
    return null;
  end if;
  if not exists (select 1 from public.mf_schemes m where m.scheme_code = p_scheme_code) then
    raise exception 'unknown scheme' using errcode = '22023';
  end if;
  insert into public.stock_benchmarks (user_id, scheme_code)
  values (auth.uid(), p_scheme_code)
  on conflict (user_id) do update set scheme_code = excluded.scheme_code,
    updated_at = pg_catalog.now();
  return p_scheme_code;
end;
$$;
revoke all on function public.set_stock_benchmark(integer) from public, anon;
grant execute on function public.set_stock_benchmark(integer) to authenticated;

-- The caller's index fund with its daily NAVs from 10 days before their first share
-- trade (RLS limits both tables to the caller), or null when none is chosen.
create or replace function public.load_stock_benchmark()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with chosen as (
    select b.scheme_code,
      (select pg_catalog.min(t.trade_date) from public.stock_trades t) as since
    from public.stock_benchmarks b
    limit 1
  )
  select pg_catalog.jsonb_build_object(
    'scheme_code', m.scheme_code, 'name', m.name, 'category', m.category,
    'nav', m.nav, 'nav_date', m.nav_date,
    'history', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(n.nav_date, n.nav)
        order by n.nav_date)
      from public.mf_nav_history n
      where n.scheme_code = c.scheme_code
        and n.nav_date >= coalesce(c.since, current_date) - 10), '[]'))
  from chosen c join public.mf_schemes m on m.scheme_code = c.scheme_code
$$;
revoke all on function public.load_stock_benchmark() from public, anon;
grant execute on function public.load_stock_benchmark() to authenticated;

-- As in 0007, and the daily NAV is also kept for index funds chosen as a benchmark.
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
    and m.scheme_code in (
      select f.scheme_code from public.mf_funds f where f.scheme_code is not null
      union
      select b.scheme_code from public.stock_benchmarks b)
  on conflict (scheme_code, nav_date) do update set nav = excluded.nav;
  return v_count;
end;
$$;

-- As in 0007, plus benchmark funds: their history is needed from each chooser's first
-- share trade.
create or replace function public.market_held_schemes()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(x), '[]') from (
    select h.scheme_code, pg_catalog.array_agg(distinct h.user_id) as user_ids,
      (select pg_catalog.min(n.nav_date) from public.mf_nav_history n
        where n.scheme_code = h.scheme_code) as first_nav_date,
      pg_catalog.min(h.first_trade_date) as first_trade_date
    from (
      select f.scheme_code, f.user_id,
        (select pg_catalog.min(t.trade_date) from public.mf_transactions t
          join public.mf_funds g on g.id = t.fund_id
          where g.scheme_code = f.scheme_code) as first_trade_date
      from public.mf_funds f where f.scheme_code is not null
      union all
      select b.scheme_code, b.user_id,
        (select pg_catalog.min(t.trade_date) from public.stock_trades t
          where t.user_id = b.user_id) as first_trade_date
      from public.stock_benchmarks b
    ) h
    group by h.scheme_code
  ) x
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public.market_ingest_schemes(jsonb)', 'public.market_held_schemes()'] loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', f);
    execute pg_catalog.format('grant execute on function %s to service_role', f);
  end loop;
end $$;
