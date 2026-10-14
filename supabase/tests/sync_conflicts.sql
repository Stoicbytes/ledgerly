-- Tests for migration 0020 (sync_ledger_v2 conflict checks). Run on a database built by
-- fresh_install.sh:  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/sync_conflicts.sql
-- Everything runs in one transaction that is rolled back; a failed check raises an error.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'one@example.com'),
  ('00000000-0000-4000-8000-0000000000b2', 'two@example.com');
-- Since 0019 only allowlisted accounts can read or write.
insert into internal.auth_allowlist (email) values ('one@example.com'), ('two@example.com')
  on conflict do nothing;

create temporary table seen (name text primary key, value text);
grant all on seen to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","aal":"aal1"}', true);

-- A new row (no base) is inserted; the result names no conflicts and gives saved_at.
do $$
declare
  v jsonb;
begin
  v := public.sync_ledger_v2('{"accounts":[{"id":"10000000-0000-4000-8000-000000000001",
    "name":"Cash","account_group":"cash","opening_balance":0,"sort_order":0}]}');
  if v -> 'conflicts' <> '[]'::jsonb or v ->> 'saved_at' is null then
    raise exception 'insert: unexpected result %', v;
  end if;
  if (select updated_at from public.accounts) <> (v ->> 'saved_at')::timestamptz then
    raise exception 'insert: updated_at is not saved_at';
  end if;
  insert into seen values ('v1', v ->> 'saved_at');
end $$;

-- An update with the current base is saved.
do $$
declare
  v jsonb;
  base text := (select value from seen where name = 'v1');
begin
  v := public.sync_ledger_v2(pg_catalog.jsonb_build_object('accounts', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('id', '10000000-0000-4000-8000-000000000001', 'name', 'Wallet',
      'account_group', 'cash', 'opening_balance', 0, 'sort_order', 0, 'base_updated_at', base))));
  if v -> 'conflicts' <> '[]'::jsonb or (select name from public.accounts) <> 'Wallet' then
    raise exception 'update with current base: %', v;
  end if;
end $$;

-- A stale base (older than the row) is skipped and reported; the row keeps the newer value.
do $$
declare
  v jsonb;
begin
  v := public.sync_ledger_v2('{"accounts":[{"id":"10000000-0000-4000-8000-000000000001",
    "name":"Stale","account_group":"cash","opening_balance":0,"sort_order":0,
    "base_updated_at":"2000-01-01T00:00:00+00:00"}]}');
  if pg_catalog.jsonb_array_length(v -> 'conflicts') <> 1
    or v #>> '{conflicts,0,reason}' <> 'changed' or v #>> '{conflicts,0,list}' <> 'accounts'
    or (select name from public.accounts) <> 'Wallet' then
    raise exception 'stale base: %', v;
  end if;
end $$;

-- A transaction with splits: a stale update leaves its splits alone too.
do $$
declare
  v jsonb;
begin
  v := public.sync_ledger_v2('{"people":[{"id":"30000000-0000-4000-8000-000000000001","name":"P","sort_order":0}],
    "transactions":[{"id":"20000000-0000-4000-8000-000000000001","kind":"expense",
    "occurred_on":"2026-10-01","amount":1000,"account_id":"10000000-0000-4000-8000-000000000001",
    "fee":0,"note":"","splits":[{"person_id":"30000000-0000-4000-8000-000000000001","amount":500}],
    "settles":[]}]}');
  v := public.sync_ledger_v2('{"transactions":[{"id":"20000000-0000-4000-8000-000000000001",
    "kind":"expense","occurred_on":"2026-10-01","amount":9999,
    "account_id":"10000000-0000-4000-8000-000000000001","fee":0,"note":"","splits":[],
    "settles":[],"base_updated_at":"2000-01-01T00:00:00+00:00"}]}');
  if v #>> '{conflicts,0,reason}' <> 'changed'
    or (select amount from public.transactions) <> 1000
    or (select count(*) from public.transaction_splits) <> 1 then
    raise exception 'stale transaction touched its row or splits: %', v;
  end if;
end $$;

-- A row deleted elsewhere is not brought back by an update that carries a base.
do $$
declare
  v jsonb;
begin
  perform public.sync_ledger_v2('{"deleted":{"transactions":["20000000-0000-4000-8000-000000000001"]}}');
  if exists (select 1 from public.transactions) then
    raise exception 'normal delete did not delete';
  end if;
  v := public.sync_ledger_v2('{"transactions":[{"id":"20000000-0000-4000-8000-000000000001",
    "kind":"expense","occurred_on":"2026-10-01","amount":1000,
    "account_id":"10000000-0000-4000-8000-000000000001","fee":0,"note":"","splits":[],
    "settles":[],"base_updated_at":"2099-01-01T00:00:00+00:00"}]}');
  if v #>> '{conflicts,0,reason}' <> 'deleted' or exists (select 1 from public.transactions) then
    raise exception 'deleted row came back: %', v;
  end if;
end $$;

-- Rows without a base mix with conflicting ones: only the conflicting row is skipped.
do $$
declare
  v jsonb;
begin
  v := public.sync_ledger_v2('{"accounts":[
    {"id":"10000000-0000-4000-8000-000000000002","name":"Bank","account_group":"bank","opening_balance":0,"sort_order":1},
    {"id":"10000000-0000-4000-8000-000000000001","name":"Old","account_group":"cash","opening_balance":0,"sort_order":0,"base_updated_at":"2000-01-01T00:00:00Z"}]}');
  if pg_catalog.jsonb_array_length(v -> 'conflicts') <> 1
    or (select count(*) from public.accounts) <> 2
    or (select name from public.accounts where sort_order = 0) <> 'Wallet' then
    raise exception 'mixed batch: %', v;
  end if;
end $$;

-- The old name still works (void) and runs the same body.
select public.sync_ledger('{"notes":[{"id":"40000000-0000-4000-8000-000000000001","title":"T","body":"b"}]}');
do $$
begin
  if (select count(*) from public.notes) <> 1 then raise exception 'sync_ledger did not save'; end if;
end $$;

-- Another user: cannot update the first user's row by claiming it exists (reported as
-- deleted, nothing changes) and cannot overwrite it with a plain upsert either.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000b2","aal":"aal1"}', true);
do $$
declare
  v jsonb;
begin
  v := public.sync_ledger_v2('{"accounts":[{"id":"10000000-0000-4000-8000-000000000001",
    "name":"Taken","account_group":"cash","opening_balance":0,"sort_order":0,
    "base_updated_at":"2099-01-01T00:00:00Z"}]}');
  if v #>> '{conflicts,0,reason}' <> 'deleted' then
    raise exception 'other user: expected a deleted conflict, got %', v;
  end if;
  begin
    perform public.sync_ledger_v2('{"accounts":[{"id":"10000000-0000-4000-8000-000000000001",
      "name":"Taken","account_group":"cash","opening_balance":0,"sort_order":0}]}');
    raise exception 'other user: plain upsert was not refused';
  exception when unique_violation or insufficient_privilege then
    null; -- refused, as before 0020
  end;
  perform public.sync_ledger_v2('{"deleted":{"accounts":["10000000-0000-4000-8000-000000000001"]}}');
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","aal":"aal1"}', true);
do $$
begin
  if (select name from public.accounts where id = '10000000-0000-4000-8000-000000000001') <> 'Wallet' then
    raise exception 'the other user changed or deleted the first user''s row';
  end if;
end $$;

-- Not signed in: refused.
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  perform public.sync_ledger_v2('{}');
  raise exception 'anonymous call was not refused';
exception when insufficient_privilege then
  null;
end $$;

reset role;
select 'sync_conflicts: all checks passed' as result;
rollback;
