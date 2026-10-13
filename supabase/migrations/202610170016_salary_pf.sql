-- Salary and PF / EPF. Apply after 202610160015_note_reminders.sql.
--
--   * employers: everyone who has paid you, with the dates you joined and left. Nothing is
--     tied to one company: payslips and PF entries name their employer, and the PF account
--     follows you from job to job as it does under one UAN. No UAN, member ID, PAN or other
--     identity number is stored.
--   * payslips: one per employer and month. Earnings and other deductions are free lines
--     (label and amount); employee EPF, VPF and TDS have their own columns because PF and tax
--     totals are built from them; the employer's EPF and pension (EPS) shares are recorded
--     but are not part of pay. transaction_id links the income entry made for the net pay.
--   * pf_entries: the PF passbook. contribution (a wage month: employee, VPF, employer EPF,
--     pension), interest (credited once a year at the rate you enter), withdrawal and opening
--     (a balance carried in from before you started tracking). Interest counts only once
--     credited.
--   * Same template as the ledger: own rows only, two-step sign-in, checks for every rule,
--     audit by column name. Money is integer paise.
--   * load_ledger returns them under "employers", "payslips" and "pf_entries"; sync_ledger
--     saves and deletes them. Everything else in both functions is unchanged from 0015.
--
-- Rollback (deletes payslips, PF entries and employers; income entries stay):
--   drop table if exists public.pf_entries, public.payslips, public.employers;
--   drop function if exists internal.valid_pay_lines(jsonb);
--   then re-run load_ledger and sync_ledger from 202610160015_note_reminders.sql.

-- Earnings or deductions: up to 30 lines of {label, amount}, amount in paise.
create or replace function internal.valid_pay_lines(p_lines jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_lines) = 'array'
    and pg_catalog.jsonb_array_length(p_lines) <= 30
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_lines) as line
      where pg_catalog.jsonb_typeof(line) is distinct from 'object'
        or pg_catalog.jsonb_typeof(line -> 'label') is distinct from 'string'
        or pg_catalog.char_length(pg_catalog.btrim(line ->> 'label')) not between 1 and 60
        or pg_catalog.jsonb_typeof(line -> 'amount') is distinct from 'number'
        or (line ->> 'amount')::numeric <> pg_catalog.trunc((line ->> 'amount')::numeric)
        or (line ->> 'amount')::numeric not between 0 and 1000000000000
    )
$$;

create or replace function internal.pay_lines_total(p_lines jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(pg_catalog.sum((line ->> 'amount')::numeric), 0)
  from pg_catalog.jsonb_array_elements(p_lines) as line
$$;

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 80),
  joined_on date check (joined_on between date '1950-01-01' and date '2100-12-31'),
  left_on date check (left_on between date '1950-01-01' and date '2100-12-31'),
  note text not null default '' check (pg_catalog.char_length(note) <= 300),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);
create index if not exists employers_user_idx on public.employers (user_id);
select internal.secure_user_table('employers', true);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  employer_id uuid not null,
  -- The pay month, as its first day.
  pay_month date not null
    check (pay_month between date '1950-01-01' and date '2100-12-01'
      and pg_catalog.date_part('day', pay_month) = 1),
  paid_on date check (paid_on between date '1950-01-01' and date '2100-12-31'),
  earnings jsonb not null default '[]' check (internal.valid_pay_lines(earnings)),
  deductions jsonb not null default '[]' check (internal.valid_pay_lines(deductions)),
  epf_employee bigint not null default 0 check (epf_employee between 0 and 1000000000000),
  vpf bigint not null default 0 check (vpf between 0 and 1000000000000),
  tds bigint not null default 0 check (tds between 0 and 1000000000000),
  employer_epf bigint not null default 0 check (employer_epf between 0 and 1000000000000),
  employer_eps bigint not null default 0 check (employer_eps between 0 and 1000000000000),
  transaction_id uuid,
  note text not null default '' check (pg_catalog.char_length(note) <= 300),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  unique (user_id, employer_id, pay_month),
  -- Pay never goes below zero: earnings cover every deduction.
  check (internal.pay_lines_total(earnings)
    >= internal.pay_lines_total(deductions) + epf_employee + vpf + tds),
  foreign key (employer_id, user_id) references public.employers (id, user_id)
    on delete restrict,
  foreign key (transaction_id, user_id) references public.transactions (id, user_id)
    on delete set null (transaction_id)
);
create index if not exists payslips_user_month_idx on public.payslips (user_id, pay_month);
create index if not exists payslips_employer_idx on public.payslips (employer_id);
create index if not exists payslips_transaction_idx on public.payslips (transaction_id);
select internal.secure_user_table('payslips', true);

create table if not exists public.pf_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('contribution', 'interest', 'withdrawal', 'opening')),
  -- contribution: the wage month (first day); others: the date on the passbook.
  entry_date date not null check (entry_date between date '1950-01-01' and date '2100-12-31'),
  employer_id uuid,
  -- Set when the contribution comes from a payslip; it follows that payslip.
  payslip_id uuid unique,
  employee bigint not null default 0 check (employee between 0 and 1000000000000),
  vpf bigint not null default 0 check (vpf between 0 and 1000000000000),
  employer bigint not null default 0 check (employer between 0 and 1000000000000),
  pension bigint not null default 0 check (pension between 0 and 1000000000000),
  -- The yearly rate EPFO declared, entered by you with the interest entry (percent).
  rate numeric(5, 2) check (rate between 0 and 20),
  note text not null default '' check (pg_catalog.char_length(note) <= 300),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (employee + vpf + employer + pension > 0),
  check (
    (kind = 'contribution' and employer_id is not null
      and pg_catalog.date_part('day', entry_date) = 1 and rate is null)
    or (kind = 'interest' and rate is not null and vpf = 0 and pension = 0
      and payslip_id is null)
    or (kind = 'withdrawal' and vpf = 0 and pension = 0 and rate is null and payslip_id is null)
    or (kind = 'opening' and vpf = 0 and rate is null and payslip_id is null)
  ),
  foreign key (employer_id, user_id) references public.employers (id, user_id)
    on delete restrict,
  foreign key (payslip_id, user_id) references public.payslips (id, user_id) on delete cascade
);
create index if not exists pf_entries_user_date_idx on public.pf_entries (user_id, entry_date);
create index if not exists pf_entries_employer_idx on public.pf_entries (employer_id);
select internal.secure_user_table('pf_entries', true);

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
      from public.recurring_entries r), '[]'),
    'goals', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(g) - 'user_id' order by g.target_date, g.created_at)
      from public.investment_goals g), '[]'),
    'employers', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) - 'user_id' order by e.joined_on nulls last, e.created_at)
      from public.employers e), '[]'),
    'payslips', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) - 'user_id' order by p.pay_month, p.created_at)
      from public.payslips p), '[]'),
    'pf_entries', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) - 'user_id' order by f.entry_date, f.created_at)
      from public.pf_entries f), '[]'),
    -- Tells the app that notes keep reminders and a Recently deleted list (0015).
    'note_extras', true
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
    'mf_funds', 'mf_sips', 'mf_transactions', 'stocks', 'stock_trades', 'recurring', 'goals',
    'employers', 'payslips', 'pf_entries'] loop
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

  insert into public.notes (id, title, body, items, color, pinned, archived, labels, remind_on,
    trashed_at, created_at)
  select r.id, coalesce(r.title, ''), coalesce(r.body, ''), r.items, coalesce(r.color, 'default'),
    coalesce(r.pinned, false), coalesce(r.archived, false), coalesce(r.labels, '{}'),
    r.remind_on, r.trashed_at, coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'notes', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'goals', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_funds', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'mf_sips', '[]'))
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

  -- Payslips and PF entries removed first, so a replacement for the same month can be saved.
  delete from public.pf_entries where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,pf_entries}', '[]'))::uuid);
  delete from public.payslips where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,payslips}', '[]'))::uuid);

  insert into public.employers (id, name, joined_on, left_on, note, created_at)
  select r.id, r.name, r.joined_on, r.left_on, coalesce(r.note, ''),
    coalesce(r.created_at, pg_catalog.now())
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'employers', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'payslips', '[]'))
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
  from pg_catalog.jsonb_to_recordset(coalesce(p_changes -> 'pf_entries', '[]'))
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
  delete from public.investment_goals where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,goals}', '[]'))::uuid);
  delete from public.stock_trades where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,stock_trades}', '[]'))::uuid);
  delete from public.stocks where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,stocks}', '[]'))::uuid);
  delete from public.employers where id in (
    select pg_catalog.jsonb_array_elements_text(coalesce(p_changes #> '{deleted,employers}', '[]'))::uuid);
end;
$$;
revoke all on function public.sync_ledger(jsonb) from public, anon;
grant execute on function public.sync_ledger(jsonb) to authenticated;
