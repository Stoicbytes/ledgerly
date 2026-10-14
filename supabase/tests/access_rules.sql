-- Access rules, checked on a database built by fresh_install.sh (stub + every migration).
-- Run: psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/access_rules.sql
-- Any failed expectation raises an exception (and psql exits non-zero). Changes are rolled
-- back at the end, so the database is left as it was.
--
-- Accounts (as the API would see them, through role + JWT claims):
--   owner     allowlisted, verified second factor (needs aal2)
--   other     allowlisted, no second factor
--   outsider  not on the allowlist (created while the sign-up hook was off, say)
--   anon      a visitor with the publishable key only
\set QUIET on
\o /dev/null
begin;

-- ---------------------------------------------------------------------------
-- Helpers (temporary: gone with the session)
-- ---------------------------------------------------------------------------
create function pg_temp.expect(p_ok boolean, p_what text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'access rule failed: %', p_what;
  end if;
end $$;

-- Rows the current role can see in every table of schema public (permission denied = 0).
create function pg_temp.visible() returns table (tbl text, n bigint)
language plpgsql as $$
declare
  t text;
begin
  for t in select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by 1 loop
    tbl := t;
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      n := 0;
    end;
    return next;
  end loop;
end $$;

create function pg_temp.act(p_user uuid, p_aal text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role":"anon"}'
      else json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text end,
    false);
end $$;

do $$
begin
  execute format('grant usage on schema %I to anon, authenticated', pg_my_temp_schema()::regnamespace);
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (as the superuser, which bypasses Row Level Security)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'Owner@Example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'other@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'outsider@example.com');
insert into internal.auth_allowlist (email) values ('owner@example.com'), ('other@example.com');
insert into auth.mfa_factors (user_id, status) values
  ('00000000-0000-4000-8000-00000000000a', 'verified'),
  ('00000000-0000-4000-8000-00000000000b', 'unverified');

insert into public.accounts (user_id, name, account_group)
select u, 'Cash', 'cash' from (values
  ('00000000-0000-4000-8000-00000000000a'::uuid), ('00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-00000000000c')) v(u);
insert into public.notes (user_id, title)
select u, 'Note' from (values
  ('00000000-0000-4000-8000-00000000000a'::uuid), ('00000000-0000-4000-8000-00000000000b')) v(u);
insert into public.mf_schemes (scheme_code, name, nav, nav_date)
values (100001, 'Sample Index Fund', 10.5, current_date);
insert into public.mf_nav_history (scheme_code, nav_date, nav) values (100001, current_date, 10.5);
insert into public.securities (isin, symbol, exchange, close, price_date)
values ('INE000A01011', 'SAMPLE', 'NSE', 10000, current_date);
insert into public.security_prices (isin, trade_date, close) values ('INE000A01011', current_date, 10000);
insert into public.market_refresh_runs (source, status) values ('amfi', 'ok');
insert into public.mf_funds (user_id, scheme_code, name)
values ('00000000-0000-4000-8000-00000000000a', 100001, 'Sample Index Fund');
insert into public.portfolio_profile (user_id, handle, full_name)
values ('00000000-0000-4000-8000-00000000000a', 'sample-site', 'Sample Person');
insert into storage.objects (bucket_id, name) values
  ('receipts', '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-000000000001.jpg');

-- ---------------------------------------------------------------------------
-- Catalog: every public table forces RLS and has a restrictive <table>_mfa policy.
-- No exceptions today; add one here (with the reason) only if a table truly needs it.
-- ---------------------------------------------------------------------------
select pg_temp.expect(not exists (
  select 1 from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not (c.relrowsecurity and c.relforcerowsecurity)),
  'every public table has Row Level Security enabled and forced');
select pg_temp.expect(not exists (
  select 1 from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and not exists (
      select 1 from pg_policy p
      where p.polrelid = c.oid and p.polname = c.relname || '_mfa' and not p.polpermissive
        and p.polroles = array['authenticated'::regrole]::oid[] and p.polcmd = '*')),
  'every public table has a restrictive <table>_mfa policy for authenticated');
-- Nothing in public is granted to anon except the three public portfolio functions.
select pg_temp.expect(not exists (
  select 1 from information_schema.role_table_grants
  where grantee in ('anon', 'PUBLIC') and table_schema = 'public'),
  'anon has no table privileges in public');
select pg_temp.expect((
  select array_agg(p.proname::text order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute'))
  = array['portfolio_contact', 'portfolio_preview', 'portfolio_public'],
  'anon may execute only the public portfolio functions');

select pg_temp.expect(not has_schema_privilege('anon', 'internal', 'usage'),
  'anon cannot reach the internal schema');

-- ---------------------------------------------------------------------------
-- owner, password only (aal1) while a verified factor exists: nothing at all
-- ---------------------------------------------------------------------------
set role authenticated;
select pg_temp.act('00000000-0000-4000-8000-00000000000a', 'aal1');
select pg_temp.expect(n = 0, 'owner aal1 sees no rows in ' || tbl) from pg_temp.visible();
select pg_temp.expect(
  (select bool_and(jsonb_typeof(v) <> 'array' or v = '[]') from jsonb_each(public.load_ledger()) e(k, v)),
  'owner aal1: load_ledger is empty');
select pg_temp.expect(public.load_market() -> 'schemes' = '[]'::jsonb
  and public.load_market() -> 'runs' = '[]'::jsonb, 'owner aal1: load_market is empty');
select pg_temp.expect(public.search_funds('sample') = '[]'::jsonb, 'owner aal1: fund search is empty');
select pg_temp.expect((select count(*) from storage.objects) = 0, 'owner aal1: no receipt files');
do $$
begin
  insert into public.notes (title) values ('aal1 write');
  raise exception 'access rule failed: owner aal1 could insert a note';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.portfolio_publish();
  raise exception 'access rule failed: owner aal1 could publish';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- owner after the code (aal2): own rows only, market data for what they hold
-- ---------------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-00000000000a', 'aal2');
select pg_temp.expect((select count(*) from public.accounts) = 1, 'owner aal2 sees one account');
select pg_temp.expect((select bool_and(user_id = auth.uid()) from public.accounts)
  and (select bool_and(user_id = auth.uid()) from public.notes), 'owner aal2 sees own rows only');
select pg_temp.expect(jsonb_array_length(public.load_ledger() -> 'accounts') = 1
  and jsonb_array_length(public.load_ledger() -> 'mf_funds') = 1, 'owner aal2: load_ledger has their rows');
select pg_temp.expect(jsonb_array_length(public.load_market() -> 'schemes') = 1,
  'owner aal2: load_market has the held scheme');
select pg_temp.expect((select count(*) from storage.objects) = 1, 'owner aal2 sees their receipt');
select pg_temp.expect((select bool_and(actor_id = auth.uid()) is not false from public.audit_logs),
  'owner aal2: audit entries are their own only');
insert into public.notes (title) values ('aal2 write');
select pg_temp.expect(public.portfolio_publish() ->> 'handle' = 'sample-site', 'owner aal2 can publish');

-- ---------------------------------------------------------------------------
-- other (allowlisted, no factor): own rows only, never the owner's
-- ---------------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-00000000000b', 'aal1');
select pg_temp.expect((select count(*) from public.accounts) = 1
  and (select bool_and(user_id = auth.uid()) from public.accounts), 'other sees only their account');
select pg_temp.expect((select count(*) from public.mf_funds) = 0
  and (select count(*) from public.portfolio_profile) = 0
  and (select count(*) from public.portfolio_publications) = 0
  and (select count(*) from storage.objects) = 0
  and (select count(*) from public.audit_logs where actor_id is distinct from auth.uid()) = 0,
  'other sees none of the owner''s rows');
do $$
begin
  insert into public.notes (user_id, title)
  values ('00000000-0000-4000-8000-00000000000a', 'forged');
  raise exception 'access rule failed: other could write a row for the owner';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- outsider (not allowlisted; even with aal2): nothing, no writes
-- ---------------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-00000000000c', 'aal2');
select pg_temp.expect(n = 0, 'outsider sees no rows in ' || tbl) from pg_temp.visible();
select pg_temp.expect(
  (select bool_and(jsonb_typeof(v) <> 'array' or v = '[]') from jsonb_each(public.load_ledger()) e(k, v)),
  'outsider: load_ledger is empty');
do $$
begin
  insert into public.accounts (name, account_group) values ('Mine', 'cash');
  raise exception 'access rule failed: outsider could insert an account';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('receipts', '00000000-0000-4000-8000-00000000000c/00000000-0000-4000-8000-000000000002.jpg');
  raise exception 'access rule failed: outsider could upload a receipt';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- anon: no tables, no private functions; the published site and contact form work
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select pg_temp.act(null, null);
select pg_temp.expect(n = 0, 'anon sees no rows in ' || tbl) from pg_temp.visible();
do $$
begin
  perform public.load_ledger();
  raise exception 'access rule failed: anon could call load_ledger';
exception when insufficient_privilege then null;
end $$;
select pg_temp.expect(public.portfolio_public('sample-site') ->> 'version' = '1',
  'anon reads the published portfolio');
select pg_temp.expect(public.portfolio_public('nobody') is null, 'anon: unknown handle is null');

-- Contact form: the bucket follows cf-connecting-ip only; a new x-forwarded-for or
-- x-real-ip on every request must not give a fresh bucket.
select set_config('request.headers', json_build_object(
    'x-forwarded-for', '198.51.100.' || i, 'x-real-ip', '192.0.2.' || i)::text, false),
  pg_temp.expect(public.portfolio_contact('sample-site', 'Visitor', 'visitor@example.com',
    'Hello, a test message.', '', 5000) = 'sent', 'contact message ' || i || ' is sent')
from generate_series(1, 3) i;
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.99","x-real-ip":"192.0.2.99"}', false);
select pg_temp.expect(public.portfolio_contact('sample-site', 'Visitor', 'visitor@example.com',
  'Hello, a test message.', '', 5000) = 'limited', 'spoofed forwarding headers do not reset the limit');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.7"}', false);
select pg_temp.expect(public.portfolio_contact('sample-site', 'Visitor', 'visitor@example.com',
  'Hello, a test message.', '', 5000) = 'sent', 'a proxy-set address has its own bucket');
select pg_temp.expect(public.portfolio_contact('sample-site', 'Visitor', 'v?cc=x@example.com',
  'Hello, a test message.', '', 5000) = 'invalid', 'an address with ? is refused');
reset role;

-- ---------------------------------------------------------------------------
-- Email rule (no characters that can change a mailto: link)
-- ---------------------------------------------------------------------------
select pg_temp.expect(internal.valid_email(e), 'valid: ' || e)
from unnest(array['a@b.co', 'first.last+tag@mail.example.org', 'x_y-z@sub-domain.example.in']) e;
select pg_temp.expect(not internal.valid_email(e), 'invalid: ' || e)
from unnest(array['a@b', 'a b@c.com', 'a@b.com?cc=x@y.com', 'a&b@c.com', 'a=b@c.com',
  'a%40b@c.com', 'a/b@c.com', 'a@b.c', '<a>@b.com', '"a"@b.com']) e;

\o
\pset tuples_only on
select 'access rules: all checks passed';
rollback;
