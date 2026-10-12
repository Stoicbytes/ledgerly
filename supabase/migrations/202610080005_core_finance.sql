-- Phase 3.1: the expense manager and notes as real tables (plan §7 and §24, migration
-- 0005). Apply after 202610080004_auth_hardening.sql. Rollback:
-- supabase/rollbacks/202610080005_core_finance_down.sql.
--
-- Every user-owned table follows the same template:
--   * user_id defaults to the caller, cannot change after insert, and is part of every
--     reference (composite foreign keys), so a row can never point at another user's row
--   * RLS enabled and forced, one policy per verb, own rows only
--   * a RESTRICTIVE policy that requires two-step sign-in (aal2) for accounts that have
--     it turned on; the legacy app never reads these tables, so nothing breaks
--   * CHECK constraints for every rule the app validates (never trust the client)
--   * audit entries (which columns changed, never the values)
--   * updated_at maintained by a trigger
-- Money is integer paise (bigint); dates are local calendar dates.
-- Receipt photos are not stored yet (private storage arrives with Phase 5).

-- ---------------------------------------------------------------------------
-- Shared helpers (internal schema from 0004)
-- ---------------------------------------------------------------------------

-- True when the session may touch financial rows: always for accounts without a
-- verified second factor, otherwise only after the code was entered (aal2).
create or replace function internal.session_meets_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
$$;
revoke all on function internal.session_meets_mfa() from public, anon;
grant usage on schema internal to authenticated;
grant execute on function internal.session_meets_mfa() to authenticated;

create or replace function internal.keep_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function internal.keep_user_id() from public, anon, authenticated;

-- AFTER trigger: one audit entry per row change, naming the changed columns only.
create or replace function internal.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else pg_catalog.to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else pg_catalog.to_jsonb(new) end;
  v_row jsonb := case when tg_op = 'DELETE' then v_old else v_new end;
  v_changed text[];
begin
  select coalesce(pg_catalog.array_agg(k order by k), '{}') into v_changed
  from pg_catalog.jsonb_object_keys(v_old || v_new) as k
  where k not in ('user_id', 'created_at', 'updated_at')
    and (v_old -> k) is distinct from (v_new -> k);
  perform internal.log_audit(
    tg_table_name || '.' || pg_catalog.lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'transaction_id', v_row ->> 'repayment_id'),
    v_changed
  );
  return null;
end;
$$;
revoke all on function internal.audit_row() from public, anon, authenticated;

-- Applies the RLS template, triggers and grants to one user-owned table.
create or replace function internal.secure_user_table(p_table text, p_has_updated_at boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := pg_catalog.quote_ident(p_table);
begin
  execute pg_catalog.format('alter table public.%s enable row level security', t);
  execute pg_catalog.format('alter table public.%s force row level security', t);
  execute pg_catalog.format('revoke all on table public.%s from public, anon, authenticated', t);
  execute pg_catalog.format(
    'grant select, insert, update, delete on table public.%s to authenticated', t);

  execute pg_catalog.format('drop policy if exists %I on public.%s', p_table || '_select', t);
  execute pg_catalog.format(
    'create policy %I on public.%s for select to authenticated using ((select auth.uid()) = user_id)',
    p_table || '_select', t);
  execute pg_catalog.format('drop policy if exists %I on public.%s', p_table || '_insert', t);
  execute pg_catalog.format(
    'create policy %I on public.%s for insert to authenticated with check ((select auth.uid()) = user_id)',
    p_table || '_insert', t);
  execute pg_catalog.format('drop policy if exists %I on public.%s', p_table || '_update', t);
  execute pg_catalog.format(
    'create policy %I on public.%s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
    p_table || '_update', t);
  execute pg_catalog.format('drop policy if exists %I on public.%s', p_table || '_delete', t);
  execute pg_catalog.format(
    'create policy %I on public.%s for delete to authenticated using ((select auth.uid()) = user_id)',
    p_table || '_delete', t);
  execute pg_catalog.format('drop policy if exists %I on public.%s', p_table || '_mfa', t);
  execute pg_catalog.format(
    'create policy %I on public.%s as restrictive for all to authenticated using ((select internal.session_meets_mfa())) with check ((select internal.session_meets_mfa()))',
    p_table || '_mfa', t);

  execute pg_catalog.format('drop trigger if exists keep_user_id on public.%s', t);
  execute pg_catalog.format(
    'create trigger keep_user_id before update on public.%s for each row execute function internal.keep_user_id()', t);
  execute pg_catalog.format('drop trigger if exists audit_row on public.%s', t);
  execute pg_catalog.format(
    'create trigger audit_row after insert or update or delete on public.%s for each row execute function internal.audit_row()', t);
  if p_has_updated_at then
    execute pg_catalog.format('drop trigger if exists touch_updated_at on public.%s', t);
    execute pg_catalog.format(
      'create trigger touch_updated_at before update on public.%s for each row execute function internal.touch_updated_at()', t);
  end if;
end;
$$;
revoke all on function internal.secure_user_table(text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 60),
  account_group text not null
    check (account_group in ('cash', 'bank', 'card', 'wallet', 'investment', 'loan')),
  -- Signed: negative means money owed (cards, loans). Limit: ±₹1,000 crore.
  opening_balance bigint not null default 0
    check (opening_balance between -1000000000000 and 1000000000000),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
create unique index if not exists accounts_user_name_key
  on public.accounts (user_id, pg_catalog.lower(pg_catalog.btrim(name)));
select internal.secure_user_table('accounts', true);

-- ---------------------------------------------------------------------------
-- categories (one level of subcategories; budgets on top-level expense categories)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  parent_id uuid,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 40),
  icon text not null default 'other' check (icon ~ '^[a-z0-9-]{1,40}$'),
  tint smallint not null default 0 check (tint between 0 and 31),
  -- Monthly budget in paise.
  budget bigint check (budget is null or budget between 0 and 1000000000000),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (parent_id is distinct from id),
  check (budget is null or (parent_id is null and kind = 'expense')),
  -- Deleting a category deletes its subcategories; the app moves their entries first.
  foreign key (parent_id, user_id) references public.categories (id, user_id) on delete cascade
);
create unique index if not exists categories_user_name_key
  on public.categories (user_id, kind, parent_id, pg_catalog.lower(pg_catalog.btrim(name)))
  nulls not distinct;
create index if not exists categories_parent_idx on public.categories (parent_id);

-- A subcategory's parent must be top-level and of the same kind.
create or replace function internal.check_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.categories p
    where p.id = new.parent_id and p.user_id = new.user_id
      and p.parent_id is null and p.kind = new.kind
  ) then
    raise exception 'A subcategory needs a top-level parent of the same kind'
      using errcode = '23514';
  end if;
  if new.parent_id is null and exists (
    select 1 from public.categories c where c.parent_id = new.id and c.kind <> new.kind
  ) then
    raise exception 'A category with subcategories cannot change type' using errcode = '23514';
  end if;
  if new.parent_id is not null and exists (
    select 1 from public.categories c where c.parent_id = new.id
  ) then
    raise exception 'A category with subcategories cannot become a subcategory'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function internal.check_category_parent() from public, anon, authenticated;
drop trigger if exists check_category_parent on public.categories;
create trigger check_category_parent before insert or update of parent_id, kind
  on public.categories for each row execute function internal.check_category_parent();
select internal.secure_user_table('categories', true);

-- ---------------------------------------------------------------------------
-- people (who shares expenses)
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 30),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
create unique index if not exists people_user_name_key
  on public.people (user_id, pg_catalog.lower(pg_catalog.btrim(name)));
select internal.secure_user_table('people', true);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  occurred_on date not null check (occurred_on between date '1900-01-01' and date '2100-12-31'),
  amount bigint not null check (amount between 1 and 1000000000000),
  account_id uuid not null,
  to_account_id uuid,
  fee bigint not null default 0 check (fee between 0 and 1000000000000),
  category_id uuid,
  note text not null default '' check (pg_catalog.char_length(note) <= 500),
  -- Income from a person = a repayment (not counted as income).
  person_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (
    (kind = 'transfer' and to_account_id is not null and to_account_id <> account_id
      and category_id is null and person_id is null)
    or (kind <> 'transfer' and to_account_id is null and fee = 0)
  ),
  check (person_id is null or (kind = 'income' and category_id is null)),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete set null (category_id),
  foreign key (person_id, user_id) references public.people (id, user_id) on delete restrict
);
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index if not exists transactions_account_idx on public.transactions (account_id);
create index if not exists transactions_to_account_idx on public.transactions (to_account_id);
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_person_idx on public.transactions (person_id);
select internal.secure_user_table('transactions', true);

-- A category must match the entry's kind.
create or replace function internal.check_transaction_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.kind = new.kind
  ) then
    raise exception 'The category does not match the entry type' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function internal.check_transaction_category() from public, anon, authenticated;
drop trigger if exists check_transaction_category on public.transactions;
create trigger check_transaction_category before insert or update of category_id, kind
  on public.transactions for each row execute function internal.check_transaction_category();

-- ---------------------------------------------------------------------------
-- transaction_splits: what each person owes you on an expense
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_splits (
  transaction_id uuid not null,
  person_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount bigint not null check (amount between 1 and 1000000000000),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (transaction_id, person_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id)
    on delete cascade,
  foreign key (person_id, user_id) references public.people (id, user_id) on delete restrict
);
create index if not exists transaction_splits_person_idx on public.transaction_splits (person_id);
select internal.secure_user_table('transaction_splits', false);

-- Splits belong to expenses and never add up to more than the amount. Checked at the end
-- of the transaction, so an expense and its splits can be saved in any order.
create or replace function internal.check_splits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Fired from both tables: a split row names its expense, an expense row is the expense.
  v_id uuid := coalesce(pg_catalog.to_jsonb(new) ->> 'transaction_id', pg_catalog.to_jsonb(new) ->> 'id')::uuid;
  v_kind text;
  v_amount bigint;
  v_shared bigint;
begin
  select t.kind, t.amount into v_kind, v_amount from public.transactions t where t.id = v_id;
  if not found then return null; end if;
  select coalesce(sum(s.amount), 0) into v_shared from public.transaction_splits s
    where s.transaction_id = v_id;
  if v_shared > 0 and v_kind <> 'expense' then
    raise exception 'Only expenses can be split' using errcode = '23514';
  end if;
  if v_shared > v_amount then
    raise exception 'Shares add up to more than the expense' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function internal.check_splits() from public, anon, authenticated;
drop trigger if exists check_splits on public.transaction_splits;
create constraint trigger check_splits after insert or update on public.transaction_splits
  deferrable initially deferred for each row execute function internal.check_splits();
drop trigger if exists check_splits on public.transactions;
create constraint trigger check_splits after update of amount, kind on public.transactions
  deferrable initially deferred for each row execute function internal.check_splits();

-- ---------------------------------------------------------------------------
-- repayment_settles: which expenses a repayment was for
-- ---------------------------------------------------------------------------
create table if not exists public.repayment_settles (
  repayment_id uuid not null,
  expense_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (repayment_id, expense_id),
  check (repayment_id <> expense_id),
  foreign key (repayment_id, user_id) references public.transactions (id, user_id)
    on delete cascade,
  foreign key (expense_id, user_id) references public.transactions (id, user_id)
    on delete cascade
);
create index if not exists repayment_settles_expense_idx on public.repayment_settles (expense_id);
select internal.secure_user_table('repayment_settles', false);

-- ---------------------------------------------------------------------------
-- notes (Google Keep style)
-- ---------------------------------------------------------------------------
create or replace function internal.valid_checklist(p_items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_items is null or (
    pg_catalog.jsonb_typeof(p_items) = 'array'
    and pg_catalog.jsonb_array_length(p_items) <= 200
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_items) as item
      where pg_catalog.jsonb_typeof(item) is distinct from 'object'
        or pg_catalog.jsonb_typeof(item -> 'id') is distinct from 'string'
        or pg_catalog.jsonb_typeof(item -> 'text') is distinct from 'string'
        or pg_catalog.jsonb_typeof(item -> 'done') is distinct from 'boolean'
        or pg_catalog.char_length(item ->> 'text') > 300
    )
  )
$$;

create or replace function internal.valid_labels(p_labels text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.cardinality(p_labels) <= 10
    and not exists (
      select 1 from pg_catalog.unnest(p_labels) as label
      where label is null or pg_catalog.char_length(pg_catalog.btrim(label)) not between 1 and 30
    )
$$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (pg_catalog.char_length(title) <= 120),
  body text not null default '' check (pg_catalog.char_length(body) <= 20000),
  -- null = text note; otherwise [{ id, text, done }]
  items jsonb check (internal.valid_checklist(items)),
  color text not null default 'default' check (color in (
    'default', 'coral', 'peach', 'sand', 'mint', 'sage', 'fog', 'storm', 'dusk', 'blossom',
    'clay', 'chalk')),
  pinned boolean not null default false,
  archived boolean not null default false,
  labels text[] not null default '{}' check (internal.valid_labels(labels)),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
select internal.secure_user_table('notes', true);
