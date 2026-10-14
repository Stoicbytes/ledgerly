-- Security hardening after the October audit. Apply after 202610180018_reset_data.sql.
--
--   * Allowlisted accounts only, in the database: internal.session_meets_mfa() (the helper
--     behind every restrictive `*_mfa` policy, the receipt and portfolio-media Storage
--     policies and the portfolio publish/preview functions) now also requires that the
--     signed-in user's email is in internal.auth_allowlist. Until now only the Before User
--     Created hook checked the list; an account created while the hook was off, or by an
--     admin, could read and write its own rows. Same name, signature and grants, so every
--     existing policy picks the rule up without being rewritten.
--     BEFORE APPLYING: your own email must be in internal.auth_allowlist (it already must
--     be for the hook). An account whose email is not on the list sees nothing.
--   * Market data (mf_schemes, mf_nav_history, securities, security_prices,
--     market_refresh_runs) and audit_logs get the same restrictive `<table>_mfa` policy as
--     every user table: history is only stored for held schemes and stocks, so a
--     password-only session (aal1 while a verified second factor exists) could otherwise
--     list what the account holds. The market-refresh Edge Function uses the service role,
--     which bypasses Row Level Security, and the policies apply to `authenticated` only.
--   * Row Level Security forced on portfolio_messages, portfolio_preview_tokens and
--     portfolio_publications, like every other table (the definer functions run as the
--     table owner, which bypasses it, exactly as audit entries are written today).
--   * internal.valid_email() is stricter: letters, digits and . _ + - before the @, a plain
--     domain after it. No ? & = % / or spaces, so an address can never add parameters to a
--     mailto: link. Existing rows are not checked again.
--   * portfolio_contact() rate-limits by `cf-connecting-ip` only (set by the proxy in front
--     of the Supabase API, which replaces any value a client sends). The client-controlled
--     `x-forwarded-for` and `x-real-ip` fallbacks are gone; without a trusted address every
--     visitor shares one bucket (and the 100 per day limit per owner still applies).
--
-- Re-runnable: every statement replaces or drops-then-creates.
--
-- Rollback (restores the previous behaviour; no data is touched):
--   re-run the session_meets_mfa() definition from 202610080005_core_finance.sql;
--   drop policy if exists mf_schemes_mfa on public.mf_schemes; (and mf_nav_history_mfa,
--     securities_mfa, security_prices_mfa, market_refresh_runs_mfa, audit_logs_mfa)
--   alter table public.portfolio_messages no force row level security; (and
--     portfolio_preview_tokens, portfolio_publications)
--   re-run internal.valid_email() and public.portfolio_contact() from
--     202610120010_portfolio.sql.

-- ---------------------------------------------------------------------------
-- Allowlisted account and two-step sign-in, for every user-facing rule
-- ---------------------------------------------------------------------------

-- True when the session may touch the account's rows: the user's email is on the sign-up
-- allowlist, and the session passed two-step sign-in (aal2) if the account has a
-- verified second factor.
create or replace function internal.session_meets_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from auth.users u
      join internal.auth_allowlist a on a.email = pg_catalog.lower(pg_catalog.btrim(u.email))
      where u.id = auth.uid()
    )
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
    )
$$;
revoke all on function internal.session_meets_mfa() from public, anon;
grant execute on function internal.session_meets_mfa() to authenticated;

-- A reminder in the migration output when an account would lose access (no emails shown).
do $$
declare
  v_outside integer;
begin
  select pg_catalog.count(*) into v_outside
  from auth.users u
  where not exists (
    select 1 from internal.auth_allowlist a
    where a.email = pg_catalog.lower(pg_catalog.btrim(u.email)));
  if v_outside > 0 then
    raise warning '% account(s) are not in internal.auth_allowlist and can no longer read or write any data. Add your email: insert into internal.auth_allowlist (email) values (''you@example.com'');', v_outside;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Market data and audit_logs: the same restrictive policy as every user table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['mf_schemes', 'mf_nav_history', 'securities', 'security_prices',
    'market_refresh_runs', 'audit_logs'] loop
    execute pg_catalog.format('drop policy if exists %I on public.%I', t || '_mfa', t);
    execute pg_catalog.format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select internal.session_meets_mfa())) with check ((select internal.session_meets_mfa()))',
      t || '_mfa', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Forced Row Level Security on the last three tables without it
-- ---------------------------------------------------------------------------
alter table public.portfolio_messages force row level security;
alter table public.portfolio_preview_tokens force row level security;
alter table public.portfolio_publications force row level security;

-- ---------------------------------------------------------------------------
-- Email addresses: nothing that can change a mailto: link
-- ---------------------------------------------------------------------------
create or replace function internal.valid_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_email is not null
    and pg_catalog.char_length(p_email) <= 254
    and p_email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,63}$'
$$;

-- ---------------------------------------------------------------------------
-- Contact form: rate limit by the proxy-set address only
-- ---------------------------------------------------------------------------
create or replace function public.portfolio_contact(
  p_handle text,
  p_name text,
  p_email text,
  p_message text,
  p_trap text,
  p_elapsed_ms integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_headers jsonb;
  v_ip text;
  v_hash bytea;
  v_name text := pg_catalog.btrim(coalesce(p_name, ''));
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
begin
  select u.user_id into v_owner
  from public.portfolio_publications u
  where u.handle = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')))
    and not coalesce(u.document -> 'profile' -> 'hiddenSections' ? 'contact', false);
  if v_owner is null then
    return 'closed';
  end if;
  if pg_catalog.char_length(v_name) not between 1 and 100
    or not internal.valid_email(v_email)
    or pg_catalog.char_length(v_message) not between 10 and 4000 then
    return 'invalid';
  end if;
  -- Bots fill the hidden field or submit instantly: pretend it worked, keep nothing.
  if coalesce(p_trap, '') <> '' or coalesce(p_elapsed_ms, 0) < 2500 then
    return 'sent';
  end if;
  -- Many links in a short message is the usual spam shape.
  if (select pg_catalog.count(*) from pg_catalog.regexp_matches(v_message, 'https?://', 'g')) > 3 then
    return 'invalid';
  end if;

  begin
    v_headers := pg_catalog.current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;
  -- Only the address the API's proxy sets (it overwrites what a client sends). Headers a
  -- visitor can choose, like x-forwarded-for, would let them pick a fresh bucket each time.
  v_ip := pg_catalog.btrim(coalesce(v_headers ->> 'cf-connecting-ip', ''));
  if v_ip !~ '^[0-9A-Fa-f:.]{2,45}$' then
    v_ip := 'unknown';
  end if;
  v_hash := pg_catalog.sha256((select s.salt from internal.portfolio_salt s)
    || pg_catalog.convert_to(v_ip, 'UTF8'));

  delete from internal.portfolio_contact_attempts where at < pg_catalog.now() - interval '1 day';
  if (select pg_catalog.count(*) from internal.portfolio_contact_attempts a
      where a.ip_hash = v_hash and a.at > pg_catalog.now() - interval '10 minutes') >= 3
    or (select pg_catalog.count(*) from internal.portfolio_contact_attempts a
        where a.ip_hash = v_hash) >= 10
    or (select pg_catalog.count(*) from public.portfolio_messages m
        where m.user_id = v_owner and m.created_at > pg_catalog.now() - interval '1 day') >= 100 then
    return 'limited';
  end if;
  insert into internal.portfolio_contact_attempts (ip_hash) values (v_hash);
  insert into public.portfolio_messages (user_id, name, email, message)
  values (v_owner, v_name, v_email, v_message);
  return 'sent';
end;
$$;
revoke all on function public.portfolio_contact(text, text, text, text, text, integer)
  from public;
grant execute on function public.portfolio_contact(text, text, text, text, text, integer)
  to anon, authenticated;
