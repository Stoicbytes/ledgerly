-- Phase 3.2: two RPCs the Command Center uses to load and save the ledger and notes.
-- Apply after 202610080005_core_finance.sql. Rollback:
-- supabase/rollbacks/202610080006_ledger_sync_down.sql.
--
-- Both are SECURITY INVOKER: they run as the signed-in user, so every row still goes
-- through RLS (own rows only, aal2 once two-step sign-in is on) and every CHECK and
-- trigger from 0005. They add no access the tables do not already grant; they only let
-- the app read everything in one request and apply a batch of changes atomically.

-- Everything the app shows, as one JSON document (no row limit, one round trip).
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
      from public.notes n), '[]')
  )
$$;
revoke all on function public.load_ledger() from public, anon;
grant execute on function public.load_ledger() to authenticated;

-- Applies one batch of changes in a single transaction: all of it or none of it.
-- Shape (every key optional):
--   { accounts: [...], categories: [...], people: [...],
--     transactions: [{ ..., splits: [{ person_id, amount }], settles: [expense_id] }],
--     notes: [...],
--     deleted: { transactions: [id], categories: [id], people: [id], accounts: [id],
--                notes: [id] } }
-- Rows are upserted by id; a transaction's splits and settles are replaced as a whole.
-- Owner is always the caller (user_id is never read from the payload).
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
  foreach v_key in array array['accounts', 'categories', 'people', 'transactions', 'notes'] loop
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

  -- Deletes last: entries before the categories, people and accounts they used.
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
end;
$$;
revoke all on function public.sync_ledger(jsonb) from public, anon;
grant execute on function public.sync_ledger(jsonb) to authenticated;
