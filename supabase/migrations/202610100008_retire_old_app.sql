-- Retire the old app's data: the owner chose to start the Command Center from scratch
-- (October 2026) instead of importing it. Apply after 202610090007_investments.sql.
--
-- PERMANENTLY DELETES the old app's saved workspaces (public.user_workspaces) and its profile
-- page (public.public_portfolios), with the functions that wrote them. Nothing in the Command
-- Center reads them. Take a backup first (Database → Backups) if you might want them again.
--
-- Not touched: the Command Center's own tables (0005–0007), accounts and sign-in, audit_logs.
-- No rollback: the data is gone once this runs.

-- Functions the old app called (every signature it ever had).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('save_user_workspace', 'save_public_portfolio')
  loop
    execute pg_catalog.format('drop function %s', f.signature);
  end loop;
end
$$;

drop table if exists public.public_portfolios;
drop table if exists public.user_workspaces;
drop table if exists internal.portfolio_owners;
