-- Receipt photos, kept privately in Supabase Storage so they follow you to every device.
-- Apply after 202610120010_portfolio.sql.
--
--   * Private bucket `receipts`: images only (JPEG, PNG, WebP, HEIC/HEIF), at most 10 MB.
--     Files live under the owner's id; only the owner can read, add or delete them, adding
--     and deleting need the two-step code (when the account has one), and a file is never
--     overwritten (no update policy; every upload gets a new random name). Nobody else,
--     signed in or not, can read them: the app shows them through links that expire after
--     a minute.
--   * transactions.receipt: the stored photo's path in that bucket and its size, or null.
--     The path must be in the row owner's own folder (checked by the database).
--   * sync_ledger is replaced to save the new column; everything else in it is unchanged
--     from 0009. load_ledger already returns every column.
--
-- Rollback (the files stay in Storage until deleted from the Storage page):
--   alter table public.transactions drop column receipt;
--   drop function if exists internal.valid_receipt(jsonb, uuid);
--   drop policy if exists receipts_select on storage.objects; (and _insert, _delete)
--   then re-run sync_ledger from 202610110009_fund_isin.sql.

-- A stored receipt: {path, width, height, mime_type, bytes}, path "<owner id>/<uuid>.<ext>".
create or replace function internal.valid_receipt(p_receipt jsonb, p_user_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_receipt is null or (
    pg_catalog.jsonb_typeof(p_receipt) = 'object'
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_receipt) k
         where k not in ('path', 'width', 'height', 'mime_type', 'bytes')) = 0
    and coalesce(p_receipt ->> 'path', '') ~ (
      '^' || p_user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$')
    and coalesce(p_receipt ->> 'mime_type', '') in
      ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    and pg_catalog.jsonb_typeof(p_receipt -> 'width') = 'number'
    and pg_catalog.jsonb_typeof(p_receipt -> 'height') = 'number'
    and pg_catalog.jsonb_typeof(p_receipt -> 'bytes') = 'number'
    and (p_receipt ->> 'width')::numeric between 0 and 20000
    and (p_receipt ->> 'height')::numeric between 0 and 20000
    and (p_receipt ->> 'bytes')::numeric between 0 and 10485760
  )
$$;
-- Used in a CHECK constraint, which runs as the caller.
grant execute on function internal.valid_receipt(jsonb, uuid) to authenticated;

alter table public.transactions
  add column if not exists receipt jsonb;
alter table public.transactions drop constraint if exists transactions_receipt_check;
alter table public.transactions
  add constraint transactions_receipt_check check (internal.valid_receipt(receipt, user_id));

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
-- Receipts bucket (private; owner only; two-step sign-in for changes; no overwrites)
-- ---------------------------------------------------------------------------
do $$
begin
  if pg_catalog.to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found: bucket and policies skipped';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts', 'receipts', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do update
    set public = excluded.public, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists receipts_select on storage.objects;
  create policy receipts_select on storage.objects for select to authenticated
    using (bucket_id = 'receipts'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select internal.session_meets_mfa()));
  drop policy if exists receipts_insert on storage.objects;
  create policy receipts_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'receipts'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif)$'
      and (select internal.session_meets_mfa()));
  drop policy if exists receipts_delete on storage.objects;
  create policy receipts_delete on storage.objects for delete to authenticated
    using (bucket_id = 'receipts'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select internal.session_meets_mfa()));
end $$;
