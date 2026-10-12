-- The public developer portfolio, managed from the dashboard. Apply after
-- 202610110009_fund_isin.sql.
--
--   * Working copy: portfolio_profile and one table per kind of content (links, facts,
--     skill groups and skills, projects, experience, education, extra sections). Same
--     template as the ledger: own rows only, two-step sign-in, checks for every rule,
--     audit by column name. Each item has `visible` (off = draft, never public).
--   * Publishing: portfolio_publish() stores a snapshot in portfolio_publications. A
--     trigger builds the document on the server from your visible items (whatever the
--     request sends is replaced), so the public site can only show what you published.
--     The public site reads only that snapshot (portfolio_public): nothing changes for
--     visitors until you publish.
--   * Preview: portfolio_preview_token() saves a snapshot of the working copy, drafts
--     included, behind a random 20-minute link; portfolio_preview() returns it for a valid
--     link only. Only the link's hash is stored.
--   * Contact form: portfolio_contact() validates, rate-limits by a salted hash of the
--     visitor's IP and stores the message for the owner (no email is sent).
--   * Media: the public bucket `portfolio-media`. Files live under the owner's id; only
--     the owner (two-step sign-in) can add or delete them; files are never overwritten.
--
-- Rollback (deletes the portfolio and its messages; files stay in Storage until removed
-- from the dashboard or the Storage page):
--   drop function if exists public.portfolio_load(), public.portfolio_save(text, jsonb),
--     public.portfolio_delete(text, uuid), public.portfolio_reorder(text, uuid[]),
--     public.portfolio_mark_message(uuid, boolean), public.portfolio_publish(),
--     public.portfolio_unpublish(), public.portfolio_preview_token(),
--     public.portfolio_public(text), public.portfolio_preview(text),
--     public.portfolio_contact(text, text, text, text, text, integer),
--     public.portfolio_media_paths(), internal.portfolio_document(uuid, boolean),
--     internal.portfolio_prepare_publication(), internal.portfolio_prepare_preview();
--   drop table if exists public.portfolio_messages, public.portfolio_publications,
--     public.portfolio_preview_tokens,
--     public.portfolio_sections, public.portfolio_education, public.portfolio_experience,
--     public.portfolio_projects, public.portfolio_skills, public.portfolio_skill_groups,
--     public.portfolio_facts, public.portfolio_links, public.portfolio_profile,
--     internal.portfolio_contact_attempts, internal.portfolio_salt;
--   drop policy if exists portfolio_media_select on storage.objects; (and _insert, _delete)

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------

-- https links (or mailto:) only: no javascript:, data: or plain http on a public page.
create or replace function internal.valid_link(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url is not null
    and pg_catalog.char_length(p_url) <= 500
    and (p_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[^[:space:]<>"]*)?$'
      or p_url ~ '^mailto:[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$')
$$;

create or replace function internal.valid_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_email is not null
    and pg_catalog.char_length(p_email) <= 254
    and p_email ~ '^[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$'
$$;

-- A list of short texts: at most p_items entries, each 1 to p_len characters.
create or replace function internal.valid_text_list(p_list text[], p_items integer, p_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_list is not null
    and coalesce(pg_catalog.cardinality(p_list), 0) <= p_items
    and not exists (
      select 1 from pg_catalog.unnest(p_list) as v
      where v is null or pg_catalog.char_length(pg_catalog.btrim(v)) not between 1 and p_len
    )
$$;

-- An uploaded image: {path, small, width, height, alt}. Paths sit in the owner's folder
-- and are random ids, so one user's row can never point at another user's files.
create or replace function internal.valid_media(p_media jsonb, p_user uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_media is null or (
    pg_catalog.jsonb_typeof(p_media) = 'object'
    and (p_media ->> 'path') ~ ('^' || p_user::text || '/[0-9a-f-]{36}\.(webp|jpg|jpeg|png|avif)$')
    and (p_media -> 'small' is null or pg_catalog.jsonb_typeof(p_media -> 'small') = 'null'
      or (p_media ->> 'small') ~ ('^' || p_user::text || '/[0-9a-f-]{36}-sm\.(webp|jpg|jpeg|png|avif)$'))
    and pg_catalog.jsonb_typeof(p_media -> 'width') = 'number'
    and pg_catalog.jsonb_typeof(p_media -> 'height') = 'number'
    and (p_media ->> 'width')::numeric between 1 and 12000
    and (p_media ->> 'height')::numeric between 1 and 12000
    and pg_catalog.char_length(coalesce(p_media ->> 'alt', '')) <= 200
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_media) k
         where k not in ('path', 'small', 'width', 'height', 'alt')) = 0
  )
$$;

-- An uploaded PDF (the résumé): {path, name, size}.
create or replace function internal.valid_file(p_file jsonb, p_user uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_file is null or (
    pg_catalog.jsonb_typeof(p_file) = 'object'
    and (p_file ->> 'path') ~ ('^' || p_user::text || '/[0-9a-f-]{36}\.pdf$')
    and pg_catalog.char_length(coalesce(p_file ->> 'name', '')) between 1 and 120
    and pg_catalog.jsonb_typeof(p_file -> 'size') = 'number'
    and (p_file ->> 'size')::numeric between 1 and 5242880
    and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_file) k
         where k not in ('path', 'name', 'size')) = 0
  )
$$;

-- Project images: up to 12 images, each with a caption and whether it is a diagram.
create or replace function internal.valid_gallery(p_gallery jsonb, p_user uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_gallery) = 'array'
    and pg_catalog.jsonb_array_length(p_gallery) <= 12
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_gallery) g
      where not internal.valid_media(g - 'caption' - 'kind', p_user)
        or g -> 'path' is null
        or pg_catalog.char_length(coalesce(g ->> 'caption', '')) > 200
        or coalesce(g ->> 'kind', 'screenshot') not in ('screenshot', 'diagram')
    )
$$;

-- Items of an extra section: up to 12 of {title, detail, url}.
create or replace function internal.valid_section_items(p_items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_items) = 'array'
    and pg_catalog.jsonb_array_length(p_items) <= 12
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_items) i
      where pg_catalog.jsonb_typeof(i) <> 'object'
        or pg_catalog.char_length(pg_catalog.btrim(coalesce(i ->> 'title', ''))) not between 1 and 80
        or pg_catalog.char_length(coalesce(i ->> 'detail', '')) > 300
        or (coalesce(i ->> 'url', '') <> '' and not internal.valid_link(i ->> 'url'))
        or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(i) k
            where k not in ('title', 'detail', 'url')) > 0
    )
$$;

revoke all on function internal.valid_link(text), internal.valid_email(text),
  internal.valid_text_list(text[], integer, integer), internal.valid_media(jsonb, uuid),
  internal.valid_file(jsonb, uuid), internal.valid_gallery(jsonb, uuid),
  internal.valid_section_items(jsonb) from public, anon;
grant execute on function internal.valid_link(text), internal.valid_email(text),
  internal.valid_text_list(text[], integer, integer), internal.valid_media(jsonb, uuid),
  internal.valid_file(jsonb, uuid), internal.valid_gallery(jsonb, uuid),
  internal.valid_section_items(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Working copy
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null default gen_random_uuid() unique,
  -- The public address of the portfolio document (letters, digits, dashes).
  handle text unique check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  site_url text check (site_url is null or (internal.valid_link(site_url) and site_url like 'https://%')),
  full_name text not null default '' check (pg_catalog.char_length(full_name) <= 80),
  title text not null default '' check (pg_catalog.char_length(title) <= 120),
  headline text not null default '' check (pg_catalog.char_length(headline) <= 160),
  rotating_words text[] not null default '{}' check (internal.valid_text_list(rotating_words, 8, 40)),
  intro text not null default '' check (pg_catalog.char_length(intro) <= 600),
  about text not null default '' check (pg_catalog.char_length(about) <= 6000),
  location text not null default '' check (pg_catalog.char_length(location) <= 80),
  timezone text not null default ''
    check (timezone = '' or timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2}$'),
  public_email text not null default '' check (public_email = '' or internal.valid_email(public_email)),
  availability text not null default 'hidden' check (availability in ('open', 'busy', 'hidden')),
  availability_note text not null default '' check (pg_catalog.char_length(availability_note) <= 80),
  avatar jsonb check (internal.valid_media(avatar, user_id)),
  resume jsonb check (internal.valid_file(resume, user_id)),
  og_image jsonb check (internal.valid_media(og_image, user_id)),
  seo_title text not null default '' check (pg_catalog.char_length(seo_title) <= 70),
  seo_description text not null default '' check (pg_catalog.char_length(seo_description) <= 200),
  hidden_sections text[] not null default '{}'
    check (hidden_sections <@ array['about', 'skills', 'projects', 'experience', 'education',
      'beyond', 'contact']::text[]),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
select internal.secure_user_table('portfolio_profile', true);

create table if not exists public.portfolio_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'website' check (kind in ('github', 'linkedin', 'x', 'website',
    'email', 'youtube', 'medium', 'devto', 'stackoverflow', 'instagram', 'other')),
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 40),
  url text not null check (internal.valid_link(url)),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
select internal.secure_user_table('portfolio_links', true);

-- Numbers for the counters (stat), short highlights and career milestones.
create table if not exists public.portfolio_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stat', 'highlight', 'milestone')),
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 80),
  detail text not null default '' check (pg_catalog.char_length(detail) <= 400),
  value numeric(12, 2) check (value is null or value between 0 and 1000000000),
  suffix text not null default '' check (pg_catalog.char_length(suffix) <= 12),
  when_label text not null default '' check (pg_catalog.char_length(when_label) <= 40),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  -- A counter only shows a number you entered.
  check (kind <> 'stat' or value is not null)
);
select internal.secure_user_table('portfolio_facts', true);

create table if not exists public.portfolio_skill_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 60),
  description text not null default '' check (pg_catalog.char_length(description) <= 300),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
create unique index if not exists portfolio_skill_groups_name_key
  on public.portfolio_skill_groups (user_id, pg_catalog.lower(pg_catalog.btrim(name)));
select internal.secure_user_table('portfolio_skill_groups', true);

create table if not exists public.portfolio_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 60),
  -- One of the site's built-in icons (empty: the name's initials).
  icon text not null default '' check (icon = '' or icon ~ '^[a-z0-9-]{1,30}$'),
  -- Shown only when you set it (1 learning … 5 expert); never guessed.
  level smallint check (level is null or level between 1 and 5),
  description text not null default '' check (pg_catalog.char_length(description) <= 300),
  featured boolean not null default false,
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  foreign key (group_id, user_id)
    references public.portfolio_skill_groups (id, user_id) on delete cascade
);
create index if not exists portfolio_skills_group_idx on public.portfolio_skills (group_id);
select internal.secure_user_table('portfolio_skills', true);

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and pg_catalog.char_length(slug) <= 60),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 100),
  tagline text not null default '' check (pg_catalog.char_length(tagline) <= 160),
  summary text not null default '' check (pg_catalog.char_length(summary) <= 600),
  body text not null default '' check (pg_catalog.char_length(body) <= 12000),
  category text not null default '' check (pg_catalog.char_length(category) <= 40),
  status text not null default 'completed'
    check (status in ('live', 'in_progress', 'completed', 'archived', 'concept')),
  role text not null default '' check (pg_catalog.char_length(role) <= 80),
  period text not null default '' check (pg_catalog.char_length(period) <= 40),
  tech text[] not null default '{}' check (internal.valid_text_list(tech, 24, 40)),
  features text[] not null default '{}' check (internal.valid_text_list(features, 12, 200)),
  challenges text not null default '' check (pg_catalog.char_length(challenges) <= 6000),
  architecture text not null default '' check (pg_catalog.char_length(architecture) <= 6000),
  repo_url text check (repo_url is null or internal.valid_link(repo_url)),
  live_url text check (live_url is null or internal.valid_link(live_url)),
  docs_url text check (docs_url is null or internal.valid_link(docs_url)),
  cover jsonb check (internal.valid_media(cover, user_id)),
  gallery jsonb not null default '[]' check (internal.valid_gallery(gallery, user_id)),
  featured boolean not null default false,
  accent text not null default 'ember'
    check (accent in ('ember', 'ion', 'lime', 'violet', 'rose', 'sand')),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  unique (user_id, slug)
);
select internal.secure_user_table('portfolio_projects', true);

create table if not exists public.portfolio_experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null check (pg_catalog.char_length(pg_catalog.btrim(company)) between 1 and 100),
  client text not null default '' check (pg_catalog.char_length(client) <= 100),
  role text not null check (pg_catalog.char_length(pg_catalog.btrim(role)) between 1 and 100),
  location text not null default '' check (pg_catalog.char_length(location) <= 80),
  employment_type text not null default '' check (pg_catalog.char_length(employment_type) <= 40),
  started_on date not null,
  -- Empty while it is your current role.
  ended_on date check (ended_on is null or ended_on >= started_on),
  summary text not null default '' check (pg_catalog.char_length(summary) <= 2000),
  responsibilities text[] not null default '{}'
    check (internal.valid_text_list(responsibilities, 12, 400)),
  achievements text[] not null default '{}' check (internal.valid_text_list(achievements, 8, 400)),
  tech text[] not null default '{}' check (internal.valid_text_list(tech, 24, 40)),
  highlights text[] not null default '{}' check (internal.valid_text_list(highlights, 8, 400)),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
select internal.secure_user_table('portfolio_experience', true);

create table if not exists public.portfolio_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'certification'
    check (kind in ('degree', 'certification', 'course', 'award')),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 140),
  issuer text not null default '' check (pg_catalog.char_length(issuer) <= 120),
  started_on date,
  ended_on date check (ended_on is null or started_on is null or ended_on >= started_on),
  issued_on date,
  expires_on date check (expires_on is null or issued_on is null or expires_on >= issued_on),
  credential_url text check (credential_url is null or internal.valid_link(credential_url)),
  grade text not null default '' check (pg_catalog.char_length(grade) <= 40),
  description text not null default '' check (pg_catalog.char_length(description) <= 1000),
  image jsonb check (internal.valid_media(image, user_id)),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
select internal.secure_user_table('portfolio_education', true);

-- "Beyond the code": interests, writing, experiments or anything else.
create table if not exists public.portfolio_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'custom' check (kind in ('interests', 'writing', 'experiments', 'custom')),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 80),
  body text not null default '' check (pg_catalog.char_length(body) <= 4000),
  items jsonb not null default '[]' check (internal.valid_section_items(items)),
  visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);
select internal.secure_user_table('portfolio_sections', true);

-- ---------------------------------------------------------------------------
-- Published snapshot, preview tokens, contact messages
-- ---------------------------------------------------------------------------

-- One row per published portfolio. The document is always rebuilt by the trigger below
-- from the owner's visible items; owners can publish (insert/update) and unpublish
-- (delete) their own row. RLS is enabled but not forced, so portfolio_public() (security
-- definer, owned by the table owner) can read every published portfolio.
create table if not exists public.portfolio_publications (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  handle text not null unique,
  document jsonb not null default '{}' check (pg_catalog.octet_length(document::text) <= 1000000),
  version integer not null default 1 check (version >= 1),
  published_at timestamptz not null default pg_catalog.now()
);
alter table public.portfolio_publications enable row level security;
revoke all on table public.portfolio_publications from public, anon, authenticated;
grant select, insert, update, delete on table public.portfolio_publications to authenticated;
do $$
declare
  v text;
begin
  foreach v in array array['select', 'insert', 'update', 'delete'] loop
    execute pg_catalog.format('drop policy if exists %I on public.portfolio_publications',
      'portfolio_publications_' || v);
  end loop;
end $$;
create policy portfolio_publications_select on public.portfolio_publications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy portfolio_publications_insert on public.portfolio_publications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy portfolio_publications_update on public.portfolio_publications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy portfolio_publications_delete on public.portfolio_publications
  for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists portfolio_publications_mfa on public.portfolio_publications;
create policy portfolio_publications_mfa on public.portfolio_publications
  as restrictive for all to authenticated
  using ((select internal.session_meets_mfa())) with check ((select internal.session_meets_mfa()));

-- Preview links: the hash of a random token and a snapshot of the working copy (drafts
-- included), built by the trigger below. Read only through portfolio_preview().
create table if not exists public.portfolio_preview_tokens (
  token_hash bytea primary key check (pg_catalog.octet_length(token_hash) = 32),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document jsonb not null default '{}' check (pg_catalog.octet_length(document::text) <= 1000000),
  expires_at timestamptz not null default pg_catalog.now() + interval '20 minutes',
  created_at timestamptz not null default pg_catalog.now()
);
create index if not exists portfolio_preview_tokens_user_idx
  on public.portfolio_preview_tokens (user_id, created_at desc);
alter table public.portfolio_preview_tokens enable row level security;
revoke all on table public.portfolio_preview_tokens from public, anon, authenticated;
grant select, insert, delete on table public.portfolio_preview_tokens to authenticated;
drop policy if exists portfolio_preview_tokens_select on public.portfolio_preview_tokens;
create policy portfolio_preview_tokens_select on public.portfolio_preview_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists portfolio_preview_tokens_insert on public.portfolio_preview_tokens;
create policy portfolio_preview_tokens_insert on public.portfolio_preview_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists portfolio_preview_tokens_delete on public.portfolio_preview_tokens;
create policy portfolio_preview_tokens_delete on public.portfolio_preview_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists portfolio_preview_tokens_mfa on public.portfolio_preview_tokens;
create policy portfolio_preview_tokens_mfa on public.portfolio_preview_tokens
  as restrictive for all to authenticated
  using ((select internal.session_meets_mfa())) with check ((select internal.session_meets_mfa()));

-- Messages from the contact form. Inserted only by portfolio_contact() (security
-- definer); the owner reads, marks and deletes them.
create table if not exists public.portfolio_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 100),
  email text not null check (internal.valid_email(email)),
  message text not null check (pg_catalog.char_length(pg_catalog.btrim(message)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);
create index if not exists portfolio_messages_user_idx
  on public.portfolio_messages (user_id, created_at desc);
alter table public.portfolio_messages enable row level security;
revoke all on table public.portfolio_messages from public, anon, authenticated;
grant select, delete on table public.portfolio_messages to authenticated;
grant update (read_at) on table public.portfolio_messages to authenticated;
drop policy if exists portfolio_messages_select on public.portfolio_messages;
create policy portfolio_messages_select on public.portfolio_messages
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists portfolio_messages_update on public.portfolio_messages;
create policy portfolio_messages_update on public.portfolio_messages
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists portfolio_messages_delete on public.portfolio_messages;
create policy portfolio_messages_delete on public.portfolio_messages
  for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists portfolio_messages_mfa on public.portfolio_messages;
create policy portfolio_messages_mfa on public.portfolio_messages
  as restrictive for all to authenticated
  using ((select internal.session_meets_mfa())) with check ((select internal.session_meets_mfa()));

-- Rate limiting: a salted hash of the visitor's IP, kept for a day. Never the IP itself.
create table if not exists internal.portfolio_salt (
  id boolean primary key default true check (id),
  salt bytea not null
);
insert into internal.portfolio_salt (salt)
values (pg_catalog.decode(pg_catalog.replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'))
on conflict (id) do nothing;
revoke all on table internal.portfolio_salt from public, anon, authenticated;

create table if not exists internal.portfolio_contact_attempts (
  ip_hash bytea not null,
  at timestamptz not null default pg_catalog.now()
);
create index if not exists portfolio_contact_attempts_idx
  on internal.portfolio_contact_attempts (ip_hash, at);
create index if not exists portfolio_contact_attempts_at_idx
  on internal.portfolio_contact_attempts (at);
revoke all on table internal.portfolio_contact_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The public document (camelCase, as the site reads it)
-- ---------------------------------------------------------------------------
create or replace function internal.portfolio_document(p_user uuid, p_drafts boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'profile', (
      select pg_catalog.jsonb_build_object(
        'handle', p.handle, 'siteUrl', p.site_url, 'name', p.full_name, 'title', p.title,
        'headline', p.headline, 'rotatingWords', pg_catalog.to_jsonb(p.rotating_words),
        'intro', p.intro, 'about', p.about, 'location', p.location, 'timezone', p.timezone,
        'email', p.public_email, 'availability', p.availability,
        'availabilityNote', p.availability_note, 'avatar', p.avatar, 'resume', p.resume,
        'ogImage', p.og_image, 'seoTitle', p.seo_title, 'seoDescription', p.seo_description,
        'hiddenSections', pg_catalog.to_jsonb(p.hidden_sections))
      from public.portfolio_profile p where p.user_id = p_user),
    'links', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', l.id, 'kind', l.kind, 'label', l.label, 'url', l.url, 'draft', not l.visible)
        order by l.sort_order, l.created_at)
      from public.portfolio_links l where l.user_id = p_user and (l.visible or p_drafts)), '[]'),
    'facts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'label', f.label, 'detail', f.detail, 'value', f.value,
        'suffix', f.suffix, 'when', f.when_label, 'draft', not f.visible)
        order by f.sort_order, f.created_at)
      from public.portfolio_facts f where f.user_id = p_user and (f.visible or p_drafts)), '[]'),
    'skillGroups', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', g.id, 'name', g.name, 'description', g.description, 'draft', not g.visible,
        'skills', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', s.id, 'name', s.name, 'icon', s.icon, 'level', s.level,
            'description', s.description, 'featured', s.featured, 'draft', not s.visible)
            order by s.sort_order, s.created_at)
          from public.portfolio_skills s
          where s.group_id = g.id and s.user_id = p_user and (s.visible or p_drafts)), '[]'))
        order by g.sort_order, g.created_at)
      from public.portfolio_skill_groups g
      where g.user_id = p_user and (g.visible or p_drafts)), '[]'),
    'projects', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'slug', r.slug, 'title', r.title, 'tagline', r.tagline,
        'summary', r.summary, 'body', r.body, 'category', r.category, 'status', r.status,
        'role', r.role, 'period', r.period, 'tech', pg_catalog.to_jsonb(r.tech),
        'features', pg_catalog.to_jsonb(r.features), 'challenges', r.challenges,
        'architecture', r.architecture, 'repoUrl', r.repo_url, 'liveUrl', r.live_url,
        'docsUrl', r.docs_url, 'cover', r.cover, 'gallery', r.gallery,
        'featured', r.featured, 'accent', r.accent, 'draft', not r.visible)
        order by r.sort_order, r.created_at)
      from public.portfolio_projects r where r.user_id = p_user and (r.visible or p_drafts)), '[]'),
    'experience', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', e.id, 'company', e.company, 'client', e.client, 'role', e.role,
        'location', e.location, 'employmentType', e.employment_type,
        'start', e.started_on, 'end', e.ended_on, 'summary', e.summary,
        'responsibilities', pg_catalog.to_jsonb(e.responsibilities),
        'achievements', pg_catalog.to_jsonb(e.achievements),
        'tech', pg_catalog.to_jsonb(e.tech), 'highlights', pg_catalog.to_jsonb(e.highlights),
        'draft', not e.visible)
        order by e.sort_order, e.created_at)
      from public.portfolio_experience e where e.user_id = p_user and (e.visible or p_drafts)), '[]'),
    'education', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'title', d.title, 'issuer', d.issuer,
        'start', d.started_on, 'end', d.ended_on, 'issued', d.issued_on,
        'expires', d.expires_on, 'url', d.credential_url, 'grade', d.grade,
        'description', d.description, 'image', d.image, 'draft', not d.visible)
        order by d.sort_order, d.created_at)
      from public.portfolio_education d where d.user_id = p_user and (d.visible or p_drafts)), '[]'),
    'sections', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'title', x.title, 'body', x.body, 'items', x.items,
        'draft', not x.visible)
        order by x.sort_order, x.created_at)
      from public.portfolio_sections x where x.user_id = p_user and (x.visible or p_drafts)), '[]')
  )
$$;
revoke all on function internal.portfolio_document(uuid, boolean) from public, anon;
grant execute on function internal.portfolio_document(uuid, boolean) to authenticated;

-- Runs as the person publishing (Row Level Security applies): the document is always
-- the server's own build of their visible items, never what the request carried.
create or replace function internal.portfolio_prepare_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_handle text;
  v_name text;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.handle, p.full_name into v_handle, v_name
  from public.portfolio_profile p where p.user_id = new.user_id;
  if v_handle is null or pg_catalog.btrim(coalesce(v_name, '')) = '' then
    raise exception 'Add your name and the site address first' using errcode = '22023';
  end if;
  new.handle := v_handle;
  new.document := internal.portfolio_document(new.user_id, false);
  new.published_at := pg_catalog.now();
  new.version := case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
  return new;
end;
$$;
revoke all on function internal.portfolio_prepare_publication() from public, anon, authenticated;
drop trigger if exists prepare_publication on public.portfolio_publications;
create trigger prepare_publication before insert or update on public.portfolio_publications
  for each row execute function internal.portfolio_prepare_publication();
drop trigger if exists audit_row on public.portfolio_publications;
create trigger audit_row after insert or update or delete on public.portfolio_publications
  for each row execute function internal.audit_row();

create or replace function internal.portfolio_prepare_preview()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  new.document := internal.portfolio_document(new.user_id, true);
  new.created_at := pg_catalog.now();
  new.expires_at := pg_catalog.now() + interval '20 minutes';
  return new;
end;
$$;
revoke all on function internal.portfolio_prepare_preview() from public, anon, authenticated;
drop trigger if exists prepare_preview on public.portfolio_preview_tokens;
create trigger prepare_preview before insert on public.portfolio_preview_tokens
  for each row execute function internal.portfolio_prepare_preview();

-- ---------------------------------------------------------------------------
-- Dashboard functions (as the signed-in user: Row Level Security applies)
-- ---------------------------------------------------------------------------

-- Everything the editor needs, and whether the working copy differs from what is live.
create or replace function public.portfolio_load()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'profile', (select pg_catalog.to_jsonb(p) from public.portfolio_profile p),
    'links', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_links t), '[]'),
    'facts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_facts t), '[]'),
    'skill_groups', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_skill_groups t), '[]'),
    'skills', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_skills t), '[]'),
    'projects', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_projects t), '[]'),
    'experience', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_experience t), '[]'),
    'education', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_education t), '[]'),
    'sections', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.sort_order, t.created_at) from public.portfolio_sections t), '[]'),
    'messages', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.created_at desc)
      from (select * from public.portfolio_messages order by created_at desc limit 200) m), '[]'),
    'publication', (
      select pg_catalog.jsonb_build_object('handle', u.handle, 'version', u.version,
        'published_at', u.published_at,
        'dirty', u.document is distinct from internal.portfolio_document(u.user_id, false))
      from public.portfolio_publications u where u.user_id = (select auth.uid()))
  )
$$;

-- The editable columns of each kind (everything else is set by the database).
create or replace function internal.portfolio_columns(p_kind text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'profile' then array['handle', 'site_url', 'full_name', 'title', 'headline',
      'rotating_words', 'intro', 'about', 'location', 'timezone', 'public_email',
      'availability', 'availability_note', 'avatar', 'resume', 'og_image', 'seo_title',
      'seo_description', 'hidden_sections']
    when 'link' then array['kind', 'label', 'url', 'visible']
    when 'fact' then array['kind', 'label', 'detail', 'value', 'suffix', 'when_label', 'visible']
    when 'skill_group' then array['name', 'description', 'visible']
    when 'skill' then array['group_id', 'name', 'icon', 'level', 'description', 'featured', 'visible']
    when 'project' then array['slug', 'title', 'tagline', 'summary', 'body', 'category', 'status',
      'role', 'period', 'tech', 'features', 'challenges', 'architecture', 'repo_url', 'live_url',
      'docs_url', 'cover', 'gallery', 'featured', 'accent', 'visible']
    when 'experience' then array['company', 'client', 'role', 'location', 'employment_type',
      'started_on', 'ended_on', 'summary', 'responsibilities', 'achievements', 'tech',
      'highlights', 'visible']
    when 'education' then array['kind', 'title', 'issuer', 'started_on', 'ended_on', 'issued_on',
      'expires_on', 'credential_url', 'grade', 'description', 'image', 'visible']
    when 'section' then array['kind', 'title', 'body', 'items', 'visible']
  end
$$;

create or replace function internal.portfolio_table(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'profile' then 'portfolio_profile'
    when 'link' then 'portfolio_links'
    when 'fact' then 'portfolio_facts'
    when 'skill_group' then 'portfolio_skill_groups'
    when 'skill' then 'portfolio_skills'
    when 'project' then 'portfolio_projects'
    when 'experience' then 'portfolio_experience'
    when 'education' then 'portfolio_education'
    when 'section' then 'portfolio_sections'
    when 'message' then 'portfolio_messages'
  end
$$;
revoke all on function internal.portfolio_columns(text), internal.portfolio_table(text)
  from public, anon;
grant execute on function internal.portfolio_columns(text), internal.portfolio_table(text)
  to authenticated;

-- Adds or changes one item (or the profile) and returns the saved row. Keys the
-- dashboard does not send keep their defaults; unknown keys are ignored.
create or replace function public.portfolio_save(p_kind text, p_row jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text := internal.portfolio_table(p_kind);
  v_cols text[] := internal.portfolio_columns(p_kind);
  v_given text[];
  v_list text;
  v_values text;
  v_sets text;
  v_saved jsonb;
  v_scope text := '';
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_cols is null or p_kind = 'message' then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_row) is distinct from 'object' then
    raise exception 'Expected an object' using errcode = '22023';
  end if;
  select pg_catalog.array_agg(c order by o) into v_given
  from pg_catalog.unnest(v_cols) with ordinality as u (c, o)
  where p_row ? c;
  if v_given is null then
    raise exception 'Nothing to save' using errcode = '22023';
  end if;
  v_list := (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.unnest(v_given) c);
  v_values := (select pg_catalog.string_agg('r.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.unnest(v_given) c);
  v_sets := (select pg_catalog.string_agg(pg_catalog.format('%1$I = excluded.%1$I', c), ', ')
             from pg_catalog.unnest(v_given) c);

  if p_kind = 'profile' then
    execute pg_catalog.format(
      'insert into public.portfolio_profile as t (user_id, %1$s)
       select auth.uid(), %2$s from pg_catalog.jsonb_populate_record(null::public.portfolio_profile, $1) r
       on conflict (user_id) do update set %3$s
       returning pg_catalog.to_jsonb(t.*)', v_list, v_values, v_sets)
    using p_row into v_saved;
    return v_saved;
  end if;

  if p_kind = 'skill' then
    v_scope := ' and s.group_id = r.group_id';
  end if;
  -- New items go to the end of their list.
  execute pg_catalog.format(
    'insert into public.%1$I as t (id, sort_order, %2$s)
     select coalesce(r.id, gen_random_uuid()),
       coalesce((select pg_catalog.max(s.sort_order) + 1 from public.%1$I s where true%5$s), 0),
       %3$s
     from pg_catalog.jsonb_populate_record(null::public.%1$I, $1) r
     on conflict (id) do update set %4$s
     returning pg_catalog.to_jsonb(t.*)', v_table, v_list, v_values, v_sets, v_scope)
  using p_row into v_saved;
  return v_saved;
end;
$$;

create or replace function public.portfolio_delete(p_kind text, p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text := internal.portfolio_table(p_kind);
begin
  if v_table is null or p_kind = 'profile' then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  execute pg_catalog.format('delete from public.%I where id = $1', v_table) using p_id;
end;
$$;

-- Saves a new order: p_ids in the order they should appear.
create or replace function public.portfolio_reorder(p_kind text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text := internal.portfolio_table(p_kind);
begin
  if v_table is null or p_kind in ('profile', 'message') then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  if pg_catalog.cardinality(p_ids) > 500 then
    raise exception 'Too many items' using errcode = '22023';
  end if;
  execute pg_catalog.format(
    'update public.%I t set sort_order = o.n - 1
     from pg_catalog.unnest($1) with ordinality as o (id, n)
     where t.id = o.id and t.sort_order is distinct from o.n - 1', v_table) using p_ids;
end;
$$;

create or replace function public.portfolio_mark_message(p_id uuid, p_read boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.portfolio_messages
  set read_at = case when p_read then coalesce(read_at, pg_catalog.now()) end
  where id = p_id
$$;

-- Every file the working copy or the live site uses (so unused uploads can be removed).
create or replace function public.portfolio_media_paths()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  with docs as (
    select internal.portfolio_document((select auth.uid()), true) as d
    union all
    select u.document from public.portfolio_publications u
  ), found as (
    select pg_catalog.jsonb_path_query(docs.d, 'lax $.**.path') as v from docs
    union all
    select pg_catalog.jsonb_path_query(docs.d, 'lax $.**.small') from docs
  )
  select coalesce(pg_catalog.array_agg(distinct found.v #>> '{}'), '{}')
  from found
  where pg_catalog.jsonb_typeof(found.v) = 'string'
$$;

-- ---------------------------------------------------------------------------
-- Publishing and preview (as the signed-in user; the triggers build the documents)
-- ---------------------------------------------------------------------------
create or replace function public.portfolio_publish()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.portfolio_publications%rowtype;
begin
  if (select auth.uid()) is null or not internal.session_meets_mfa() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.portfolio_publications as u (user_id, handle)
  values ((select auth.uid()), '')
  on conflict (user_id) do update set handle = excluded.handle
  returning * into v_row;
  return pg_catalog.jsonb_build_object('handle', v_row.handle, 'version', v_row.version,
    'published_at', v_row.published_at, 'dirty', false);
end;
$$;

-- Takes the site offline (the working copy stays).
create or replace function public.portfolio_unpublish()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not internal.session_meets_mfa() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.portfolio_publications where user_id = (select auth.uid());
end;
$$;

-- A preview link valid for 20 minutes (the five newest are kept). Only its hash is stored.
create or replace function public.portfolio_preview_token()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_token text := pg_catalog.replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if (select auth.uid()) is null or not internal.session_meets_mfa() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.portfolio_preview_tokens t
  where t.expires_at < pg_catalog.now()
     or t.token_hash in (select k.token_hash from public.portfolio_preview_tokens k
                         order by k.created_at desc offset 4);
  insert into public.portfolio_preview_tokens (token_hash)
  values (pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')));
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public functions (anyone, through the publishable key)
-- ---------------------------------------------------------------------------

-- The published portfolio for a handle, or null.
create or replace function public.portfolio_public(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select u.document || pg_catalog.jsonb_build_object(
    'version', u.version, 'publishedAt', u.published_at)
  from public.portfolio_publications u
  where u.handle = pg_catalog.lower(pg_catalog.btrim(p_handle))
    and pg_catalog.char_length(p_handle) <= 40
$$;

-- The working copy, drafts included, for a valid preview link; otherwise null.
create or replace function public.portfolio_preview(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select t.document || pg_catalog.jsonb_build_object(
    'version', null, 'publishedAt', t.created_at, 'preview', true,
    'previewExpiresAt', t.expires_at)
  from public.portfolio_preview_tokens t
  where p_token ~ '^[0-9a-f]{64}$'
    and t.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'))
    and t.expires_at > pg_catalog.now()
$$;

-- The contact form. Returns 'sent', 'invalid', 'limited' or 'closed'.
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
  v_ip := coalesce(v_headers ->> 'cf-connecting-ip',
    pg_catalog.btrim(pg_catalog.split_part(v_headers ->> 'x-forwarded-for', ',', 1)),
    v_headers ->> 'x-real-ip', 'unknown');
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.portfolio_load(), public.portfolio_save(text, jsonb),
  public.portfolio_delete(text, uuid), public.portfolio_reorder(text, uuid[]),
  public.portfolio_mark_message(uuid, boolean), public.portfolio_media_paths(),
  public.portfolio_publish(), public.portfolio_unpublish(), public.portfolio_preview_token(),
  public.portfolio_public(text), public.portfolio_preview(text),
  public.portfolio_contact(text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.portfolio_load(), public.portfolio_save(text, jsonb),
  public.portfolio_delete(text, uuid), public.portfolio_reorder(text, uuid[]),
  public.portfolio_mark_message(uuid, boolean), public.portfolio_media_paths(),
  public.portfolio_publish(), public.portfolio_unpublish(), public.portfolio_preview_token()
  to authenticated;
grant execute on function public.portfolio_public(text), public.portfolio_preview(text),
  public.portfolio_contact(text, text, text, text, text, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Media bucket (public read; owner-only writes, two-step sign-in, no overwrites)
-- ---------------------------------------------------------------------------
do $$
begin
  if pg_catalog.to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found: bucket and policies skipped';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('portfolio-media', 'portfolio-media', true, 5242880,
    array['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'application/pdf'])
  on conflict (id) do update
    set public = excluded.public, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists portfolio_media_select on storage.objects;
  create policy portfolio_media_select on storage.objects for select to authenticated
    using (bucket_id = 'portfolio-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text);
  drop policy if exists portfolio_media_insert on storage.objects;
  create policy portfolio_media_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'portfolio-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-sm)?\.(webp|jpg|jpeg|png|avif|pdf)$'
      and (select internal.session_meets_mfa()));
  drop policy if exists portfolio_media_delete on storage.objects;
  create policy portfolio_media_delete on storage.objects for delete to authenticated
    using (bucket_id = 'portfolio-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select internal.session_meets_mfa()));
end $$;
