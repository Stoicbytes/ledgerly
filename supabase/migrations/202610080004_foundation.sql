-- Foundation: what every later migration relies on. Run this first on a new project.
--
--   * internal schema (not exposed through the Data API) for server-only objects
--   * sign-up allowlist + Before User Created Auth Hook function
--   * append-only audit_logs that record which columns changed, never the values
--   * internal.touch_updated_at() and internal.log_audit(), used by the tables in 0005+
--
-- After applying: Dashboard → Authentication → Hooks → "Before User Created" →
-- Postgres function internal.before_user_created, then add the owner's email to
-- internal.auth_allowlist. See SUPABASE_SETUP.md.
--
-- Projects created before Ledgerly already have all of this from the original migration
-- 0004 (which also created the unused profiles and user_preferences tables). Running this
-- file there changes nothing: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- internal schema
-- ---------------------------------------------------------------------------
create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
-- The Auth server runs hooks as supabase_auth_admin; it needs only the allowlist.
grant usage on schema internal to supabase_auth_admin;

create or replace function internal.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function internal.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up allowlist and the Before User Created hook
-- ---------------------------------------------------------------------------
create table if not exists internal.auth_allowlist (
  email text primary key
    check (email = pg_catalog.lower(pg_catalog.btrim(email)) and email like '%_@_%'),
  note text check (note is null or pg_catalog.char_length(note) <= 200),
  created_at timestamptz not null default pg_catalog.now()
);
revoke all on table internal.auth_allowlist from public, anon, authenticated;
grant select on table internal.auth_allowlist to supabase_auth_admin;

-- Returns {} to allow the sign-up, or an error object the Auth server returns as 403.
-- The message is the same for every rejection so it reveals nothing about the list.
create or replace function internal.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(event -> 'user' ->> 'email'));
begin
  if v_email is not null and v_email <> ''
    and exists (select 1 from internal.auth_allowlist a where a.email = v_email) then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'error', pg_catalog.jsonb_build_object(
      'http_code', 403,
      'message', 'Sign-ups are closed for this app.'
    )
  );
end;
$$;
revoke all on function internal.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function internal.before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- audit_logs: who did what to which record, never the values
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  -- No foreign key: the history outlives the account and must never be rewritten.
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity text not null check (pg_catalog.char_length(entity) between 1 and 64),
  entity_id text check (entity_id is null or pg_catalog.char_length(entity_id) <= 128),
  changed_fields text[] not null default '{}'
    check (pg_catalog.cardinality(changed_fields) <= 64),
  created_at timestamptz not null default pg_catalog.now()
);
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
revoke all on table public.audit_logs from public, anon, authenticated;
grant select on table public.audit_logs to authenticated;

drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs for select to authenticated
  using ((select auth.uid()) = actor_id);

create or replace function internal.reject_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;
revoke all on function internal.reject_audit_change() from public, anon, authenticated;

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function internal.reject_audit_change();
drop trigger if exists audit_logs_no_truncate on public.audit_logs;
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function internal.reject_audit_change();

-- Called only from other definer functions; clients cannot write audit entries.
create or replace function internal.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_changed_fields text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, changed_fields)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_changed_fields, '{}'));
end;
$$;
revoke all on function internal.log_audit(text, text, text, text[]) from public, anon, authenticated;
