-- Recurring entries: rent, subscriptions, EMIs, SIP transfers. Apply after
-- 202610120011_receipts.sql.
--
--   * recurring_entries: what repeats (type, amount, accounts, category, note), how often
--     (daily, weekly, monthly, yearly), the first date and the next date not yet added or
--     skipped. Same template as the ledger: own rows only, two-step sign-in, checks for every
--     rule, audit by column name. Nothing is added by itself: the app lists what is due and
--     you add (amount can be changed) or skip each one.
--   * An account used by a recurring entry cannot be deleted; deleting a category clears it
--     from recurring entries.
--   * load_ledger returns them under "recurring"; sync_ledger saves and deletes them.
--     Everything else in both functions is unchanged (load_ledger from 0007, sync_ledger
--     from 0011).
--
-- Rollback (deletes recurring entries; entries already added stay):
--   drop table if exists public.recurring_entries;
--   then re-run load_ledger from 202610090007_investments.sql and sync_ledger from
--   202610120011_receipts.sql.

create table if not exists public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  amount bigint not null check (amount between 1 and 1000000000000),
  account_id uuid not null,
  to_account_id uuid,
  fee bigint not null default 0 check (fee between 0 and 1000000000000),
  category_id uuid,
  note text not null default '' check (pg_catalog.char_length(note) <= 500),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  start_date date not null check (start_date between date '1900-01-01' and date '2100-12-31'),
  next_date date not null check (next_date between date '1900-01-01' and date '2100-12-31'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (next_date >= start_date),
  check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id
      and category_id is null)
    or (kind <> 'transfer' and to_account_id is null and fee = 0)
  ),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete set null (category_id)
);
create index if not exists recurring_entries_user_next_idx
  on public.recurring_entries (user_id, next_date);
create index if not exists recurring_entries_account_idx on public.recurring_entries (account_id);
create index if not exists recurring_entries_to_account_idx
  on public.recurring_entries (to_account_id);
create index if not exists recurring_entries_category_idx on public.recurring_entries (category_id);
select internal.secure_user_table('recurring_entries', true);

-- The category must be of the entry's type (the same check as for transactions).
drop trigger if exists check_transaction_category on public.recurring_entries;
create trigger check_transaction_category before insert or update of category_id, kind
  on public.recurring_entries for each row execute function internal.check_transaction_category();

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
      from public.stock_trades t), '[]'),
    'recurring', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) - 'user_id' order by r.created_at)
      from public.recurring_entries r), '[]')
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
    'mf_funds', 'mf_sips', 'mf_transactions', 'stocks', 'stock_trades', 'recurring'] loop
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
    person_id, receipt, created_at)
  select r.id, r.kind, r.occurred_on, r.amount, r.account_id, r.to_account_id,
    coalesce(r.fee, 0), r.category_id, coalesce(r.note, ''), r.person_id,
    case when pg_catalog.jsonb_typeof(r.receipt) = 'object' then r.receipt end,
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'transactions', '[]'))
    as r(id uuid, kind text, occurred_on date, amount bigint, account_id uuid,
         to_account_id uuid, fee bigint, category_id uuid, note text, person_id uuid,
         receipt jsonb, created_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind, occurred_on = excluded.occurred_on, amount = excluded.amount,
    account_id = excluded.account_id, to_account_id = excluded.to_account_id,
    fee = excluded.fee, category_id = excluded.category_id, note = excluded.note,
    person_id = excluded.person_id, receipt = excluded.receipt;

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

  insert into public.recurring_entries (
    id, kind, amount, account_id, to_account_id, fee, category_id, note, frequency,
    start_date, next_date, created_at)
  select r.id, r.kind, r.amount, r.account_id, r.to_account_id, coalesce(r.fee, 0),
    r.category_id, coalesce(r.note, ''), r.frequency, r.start_date, r.next_date,
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'recurring', '[]'))
    as r(id uuid, kind text, amount bigint, account_id uuid, to_account_id uuid, fee bigint,
         category_id uuid, note text, frequency text, start_date date, next_date date,
         created_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind, amount = excluded.amount, account_id = excluded.account_id,
    to_account_id = excluded.to_account_id, fee = excluded.fee,
    category_id = excluded.category_id, note = excluded.note, frequency = excluded.frequency,
    start_date = excluded.start_date, next_date = excluded.next_date;

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

  insert into public.mf_funds (id, scheme_code, isin, name, category, fund_house, folio, manual_nav,
    manual_nav_date, note, archived, sort_order, created_at)
  select r.id, r.scheme_code, nullif(r.isin, ''), r.name, coalesce(r.category, ''),
    coalesce(r.fund_house, ''), coalesce(r.folio, ''), r.manual_nav, r.manual_nav_date,
    coalesce(r.note, ''), coalesce(r.archived, false), coalesce(r.sort_order, 0),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_funds', '[]'))
    as r(id uuid, scheme_code integer, isin text, name text, category text, fund_house text,
         folio text, manual_nav numeric, manual_nav_date date, note text, archived boolean,
         sort_order integer, created_at timestamptz)
  on conflict (id) do update set
    scheme_code = excluded.scheme_code, isin = excluded.isin, name = excluded.name,
    category = excluded.category, fund_house = excluded.fund_house, folio = excluded.folio,
    manual_nav = excluded.manual_nav, manual_nav_date = excluded.manual_nav_date,
    note = excluded.note, archived = excluded.archived, sort_order = excluded.sort_order;

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
  delete from public.recurring_entries where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,recurring}', '[]'))::uuid);
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
