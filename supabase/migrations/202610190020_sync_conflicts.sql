-- Conflict checks for saving: a stale tab or device can no longer overwrite newer data or
-- bring back a deleted row. Apply after 202610180018_reset_data.sql.
--
--   * New public.sync_ledger_v2(p_changes jsonb) returns jsonb. It takes the same changes
--     as sync_ledger, with the same validation, limits (5 MB, 5,000 rows per list) and
--     security invoker behaviour (Row Level Security and two-step sign-in apply).
--   * Each saved row may carry "base_updated_at": the updated_at the app last saw for it
--     (from load_ledger or an earlier save). It marks the row as one the app believes
--     exists. When the row was changed since (its updated_at is newer) or no longer exists
--     (deleted on another device, or never visible to this user), that row is skipped,
--     with its splits and settles, and returned under "conflicts" as
--     {list, id, reason: 'changed' | 'deleted', updated_at}. A skipped row is never
--     re-inserted. Rows are locked while checked, so two saves of one row queue.
--   * Rows without base_updated_at (new rows, and every row from an older app) are saved as
--     before: insert, or update the user's own row with that id. Deletes are unchanged.
--   * Returns {conflicts, saved_at}. Every row saved by the call has updated_at = saved_at
--     (the insert default and the touch_updated_at trigger both use now()).
--   * A new name instead of changing sync_ledger: Postgres cannot change a function's
--     return type in place, and the earlier migrations must stay re-runnable. sync_ledger
--     keeps its signature and void result and now runs sync_ledger_v2, so both share one
--     body; an app that finds no sync_ledger_v2 (404) uses sync_ledger as before.
--
-- Rollback (the app falls back to sync_ledger by itself):
--   drop function if exists public.sync_ledger_v2(jsonb);
--   then re-run sync_ledger (and its revoke/grant lines) from 202610170016_salary_pf.sql.

create or replace function public.sync_ledger_v2(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_changes jsonb;
  v_kept jsonb;
  v_skipped jsonb;
  v_conflicts jsonb := '[]';
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
    'mf_funds', 'mf_sips', 'mf_transactions', 'stocks', 'stock_trades', 'recurring', 'goals',
    'employers', 'payslips', 'pf_entries'] loop
    if p_changes ? v_key and (pg_catalog.jsonb_typeof(p_changes -> v_key) is distinct from 'array'
      or pg_catalog.jsonb_array_length(p_changes -> v_key) > 5000) then
      raise exception 'Invalid % list', v_key using errcode = '22023';
    end if;
  end loop;

  -- Rows the app believes exist (base_updated_at) are kept only when nobody changed or
  -- deleted them since; the others are reported and left alone.
  v_changes := p_changes;
  foreach v_key in array array['accounts', 'categories', 'people', 'transactions', 'notes',
    'mf_funds', 'mf_sips', 'mf_transactions', 'stocks', 'stock_trades', 'recurring', 'goals',
    'employers', 'payslips', 'pf_entries'] loop
    continue when not (p_changes ? v_key);
    execute pg_catalog.format($q$
      with r as (
        select e.value as item, e.n
        from pg_catalog.jsonb_array_elements($1) with ordinality as e(value, n)
      ), locked as (
        select t.id, t.updated_at from public.%I t
        where t.id in (
          select (r.item ->> 'id')::uuid from r
          where pg_catalog.jsonb_typeof(r.item -> 'base_updated_at') = 'string')
        for update
      ), checked as (
        select r.item, r.n, l.updated_at,
          case
            when pg_catalog.jsonb_typeof(r.item -> 'base_updated_at') is distinct from 'string'
              then null
            when l.id is null then 'deleted'
            when l.updated_at > (r.item ->> 'base_updated_at')::timestamptz then 'changed'
          end as reason
        from r left join locked l on l.id = (r.item ->> 'id')::uuid
      )
      select
        coalesce(pg_catalog.jsonb_agg(c.item order by c.n) filter (where c.reason is null), '[]'),
        coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('list', %L,
          'id', c.item -> 'id', 'reason', c.reason, 'updated_at', c.updated_at) order by c.n)
          filter (where c.reason is not null), '[]')
      from checked c
    $q$,
      case v_key when 'recurring' then 'recurring_entries' when 'goals' then 'investment_goals'
        else v_key end,
      v_key)
    using p_changes -> v_key
    into v_kept, v_skipped;
    v_changes := pg_catalog.jsonb_set(v_changes, array[v_key], v_kept);
    v_conflicts := v_conflicts || v_skipped;
  end loop;

  insert into public.accounts (id, name, account_group, opening_balance, sort_order)
  select r.id, r.name, r.account_group, r.opening_balance, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'accounts', '[]'))
    as r(id uuid, name text, account_group text, opening_balance bigint, sort_order integer)
  on conflict (id) do update set
    name = excluded.name, account_group = excluded.account_group,
    opening_balance = excluded.opening_balance, sort_order = excluded.sort_order;

  insert into public.people (id, name, sort_order)
  select r.id, r.name, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'people', '[]'))
    as r(id uuid, name text, sort_order integer)
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

  -- Top-level categories first, so subcategories find their parent.
  insert into public.categories (id, kind, parent_id, name, icon, tint, budget, sort_order)
  select r.id, r.kind, r.parent_id, r.name, r.icon, r.tint, r.budget, r.sort_order
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'categories', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'transactions', '[]'))
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
  using pg_catalog.jsonb_array_elements(coalesce(v_changes -> 'transactions', '[]')) as t
  where s.transaction_id = (t ->> 'id')::uuid;
  insert into public.transaction_splits (transaction_id, person_id, amount)
  select (t ->> 'id')::uuid, (s ->> 'person_id')::uuid, (s ->> 'amount')::bigint
  from pg_catalog.jsonb_array_elements(coalesce(v_changes -> 'transactions', '[]')) as t,
    pg_catalog.jsonb_array_elements(coalesce(t -> 'splits', '[]')) as s;

  delete from public.repayment_settles r
  using pg_catalog.jsonb_array_elements(coalesce(v_changes -> 'transactions', '[]')) as t
  where r.repayment_id = (t ->> 'id')::uuid;
  insert into public.repayment_settles (repayment_id, expense_id)
  select (t ->> 'id')::uuid, e.value::uuid
  from pg_catalog.jsonb_array_elements(coalesce(v_changes -> 'transactions', '[]')) as t,
    pg_catalog.jsonb_array_elements_text(coalesce(t -> 'settles', '[]')) as e;

  insert into public.recurring_entries (
    id, kind, amount, account_id, to_account_id, fee, category_id, note, frequency,
    start_date, next_date, created_at)
  select r.id, r.kind, r.amount, r.account_id, r.to_account_id, coalesce(r.fee, 0),
    r.category_id, coalesce(r.note, ''), r.frequency, r.start_date, r.next_date,
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'recurring', '[]'))
    as r(id uuid, kind text, amount bigint, account_id uuid, to_account_id uuid, fee bigint,
         category_id uuid, note text, frequency text, start_date date, next_date date,
         created_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind, amount = excluded.amount, account_id = excluded.account_id,
    to_account_id = excluded.to_account_id, fee = excluded.fee,
    category_id = excluded.category_id, note = excluded.note, frequency = excluded.frequency,
    start_date = excluded.start_date, next_date = excluded.next_date;

  insert into public.notes (id, title, body, items, color, pinned, archived, labels, remind_on,
    trashed_at, created_at)
  select r.id, coalesce(r.title, ''), coalesce(r.body, ''), r.items, coalesce(r.color, 'default'),
    coalesce(r.pinned, false), coalesce(r.archived, false), coalesce(r.labels, '{}'),
    r.remind_on, r.trashed_at, coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'notes', '[]'))
    as r(id uuid, title text, body text, items jsonb, color text, pinned boolean,
         archived boolean, labels text[], remind_on date, trashed_at timestamptz,
         created_at timestamptz)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, items = excluded.items,
    color = excluded.color, pinned = excluded.pinned, archived = excluded.archived,
    labels = excluded.labels, remind_on = excluded.remind_on, trashed_at = excluded.trashed_at;

  insert into public.investment_goals (id, name, target_amount, target_date, expected_return,
    created_at)
  select r.id, r.name, r.target_amount, r.target_date, coalesce(r.expected_return, 0),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'goals', '[]'))
    as r(id uuid, name text, target_amount bigint, target_date date, expected_return numeric,
         created_at timestamptz)
  on conflict (id) do update set
    name = excluded.name, target_amount = excluded.target_amount,
    target_date = excluded.target_date, expected_return = excluded.expected_return;

  insert into public.mf_funds (id, scheme_code, isin, name, category, fund_house, folio, manual_nav,
    manual_nav_date, note, archived, sort_order, expense_ratio, goal_id, created_at)
  select r.id, r.scheme_code, nullif(r.isin, ''), r.name, coalesce(r.category, ''),
    coalesce(r.fund_house, ''), coalesce(r.folio, ''), r.manual_nav, r.manual_nav_date,
    coalesce(r.note, ''), coalesce(r.archived, false), coalesce(r.sort_order, 0),
    r.expense_ratio, r.goal_id, coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'mf_funds', '[]'))
    as r(id uuid, scheme_code integer, isin text, name text, category text, fund_house text,
         folio text, manual_nav numeric, manual_nav_date date, note text, archived boolean,
         sort_order integer, expense_ratio numeric, goal_id uuid, created_at timestamptz)
  on conflict (id) do update set
    scheme_code = excluded.scheme_code, isin = excluded.isin, name = excluded.name,
    category = excluded.category, fund_house = excluded.fund_house, folio = excluded.folio,
    manual_nav = excluded.manual_nav, manual_nav_date = excluded.manual_nav_date,
    note = excluded.note, archived = excluded.archived, sort_order = excluded.sort_order,
    expense_ratio = excluded.expense_ratio, goal_id = excluded.goal_id;

  insert into public.mf_sips (id, fund_id, amount, day_of_month, start_date, end_date, active,
    note, step_up_pct, created_at)
  select r.id, r.fund_id, r.amount, r.day_of_month, r.start_date, r.end_date,
    coalesce(r.active, true), coalesce(r.note, ''), coalesce(r.step_up_pct, 0),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'mf_sips', '[]'))
    as r(id uuid, fund_id uuid, amount bigint, day_of_month smallint, start_date date,
         end_date date, active boolean, note text, step_up_pct numeric, created_at timestamptz)
  on conflict (id) do update set
    fund_id = excluded.fund_id, amount = excluded.amount, day_of_month = excluded.day_of_month,
    start_date = excluded.start_date, end_date = excluded.end_date, active = excluded.active,
    note = excluded.note, step_up_pct = excluded.step_up_pct;

  insert into public.mf_transactions (id, fund_id, kind, trade_date, amount, stamp_duty, units,
    nav, sip_id, note, created_at)
  select r.id, r.fund_id, r.kind, r.trade_date, r.amount, coalesce(r.stamp_duty, 0), r.units,
    r.nav, r.sip_id, coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'mf_transactions', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'stocks', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'stock_trades', '[]'))
    as r(id uuid, stock_id uuid, kind text, trade_date date, quantity bigint, price bigint,
         charges bigint, amount bigint, ratio_from integer, ratio_to integer, note text,
         created_at timestamptz)
  on conflict (id) do update set
    stock_id = excluded.stock_id, kind = excluded.kind, trade_date = excluded.trade_date,
    quantity = excluded.quantity, price = excluded.price, charges = excluded.charges,
    amount = excluded.amount, ratio_from = excluded.ratio_from, ratio_to = excluded.ratio_to,
    note = excluded.note;

  -- Payslips and PF entries removed first, so a replacement for the same month can be saved.
  delete from public.pf_entries where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,pf_entries}', '[]'))::uuid);
  delete from public.payslips where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,payslips}', '[]'))::uuid);

  insert into public.employers (id, name, joined_on, left_on, note, created_at)
  select r.id, r.name, r.joined_on, r.left_on, coalesce(r.note, ''),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'employers', '[]'))
    as r(id uuid, name text, joined_on date, left_on date, note text, created_at timestamptz)
  on conflict (id) do update set
    name = excluded.name, joined_on = excluded.joined_on, left_on = excluded.left_on,
    note = excluded.note;

  insert into public.payslips (id, employer_id, pay_month, paid_on, earnings, deductions,
    epf_employee, vpf, tds, employer_epf, employer_eps, transaction_id, note, created_at)
  select r.id, r.employer_id, r.pay_month, r.paid_on, coalesce(r.earnings, '[]'),
    coalesce(r.deductions, '[]'), coalesce(r.epf_employee, 0), coalesce(r.vpf, 0),
    coalesce(r.tds, 0), coalesce(r.employer_epf, 0), coalesce(r.employer_eps, 0),
    r.transaction_id, coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'payslips', '[]'))
    as r(id uuid, employer_id uuid, pay_month date, paid_on date, earnings jsonb,
         deductions jsonb, epf_employee bigint, vpf bigint, tds bigint, employer_epf bigint,
         employer_eps bigint, transaction_id uuid, note text, created_at timestamptz)
  on conflict (id) do update set
    employer_id = excluded.employer_id, pay_month = excluded.pay_month,
    paid_on = excluded.paid_on, earnings = excluded.earnings, deductions = excluded.deductions,
    epf_employee = excluded.epf_employee, vpf = excluded.vpf, tds = excluded.tds,
    employer_epf = excluded.employer_epf, employer_eps = excluded.employer_eps,
    transaction_id = excluded.transaction_id, note = excluded.note;

  insert into public.pf_entries (id, kind, entry_date, employer_id, payslip_id, employee, vpf,
    employer, pension, rate, note, created_at)
  select r.id, r.kind, r.entry_date, r.employer_id, r.payslip_id, coalesce(r.employee, 0),
    coalesce(r.vpf, 0), coalesce(r.employer, 0), coalesce(r.pension, 0), r.rate,
    coalesce(r.note, ''), coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(v_changes -> 'pf_entries', '[]'))
    as r(id uuid, kind text, entry_date date, employer_id uuid, payslip_id uuid,
         employee bigint, vpf bigint, employer bigint, pension bigint, rate numeric,
         note text, created_at timestamptz)
  on conflict (id) do update set
    kind = excluded.kind, entry_date = excluded.entry_date, employer_id = excluded.employer_id,
    payslip_id = excluded.payslip_id, employee = excluded.employee, vpf = excluded.vpf,
    employer = excluded.employer, pension = excluded.pension, rate = excluded.rate,
    note = excluded.note;

  -- Deletes last: entries before the things they use.
  delete from public.recurring_entries where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,recurring}', '[]'))::uuid);
  delete from public.transactions where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,transactions}', '[]'))::uuid);
  delete from public.notes where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,notes}', '[]'))::uuid);
  delete from public.categories where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,categories}', '[]'))::uuid);
  delete from public.people where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,people}', '[]'))::uuid);
  delete from public.accounts where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,accounts}', '[]'))::uuid);
  delete from public.mf_transactions where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,mf_transactions}', '[]'))::uuid);
  delete from public.mf_sips where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,mf_sips}', '[]'))::uuid);
  delete from public.mf_funds where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,mf_funds}', '[]'))::uuid);
  delete from public.investment_goals where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,goals}', '[]'))::uuid);
  delete from public.stock_trades where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,stock_trades}', '[]'))::uuid);
  delete from public.stocks where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,stocks}', '[]'))::uuid);
  delete from public.employers where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(v_changes #> '{deleted,employers}', '[]'))::uuid);

  return pg_catalog.jsonb_build_object('conflicts', v_conflicts, 'saved_at', pg_catalog.now());
end;
$$;
revoke all on function public.sync_ledger_v2(jsonb) from public, anon;
grant execute on function public.sync_ledger_v2(jsonb) to authenticated;

-- The older name runs the same body (conflicts only arise for rows that carry
-- base_updated_at, which older apps never send).
create or replace function public.sync_ledger(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.sync_ledger_v2(p_changes);
end;
$$;
revoke all on function public.sync_ledger(jsonb) from public, anon;
grant execute on function public.sync_ledger(jsonb) to authenticated;
