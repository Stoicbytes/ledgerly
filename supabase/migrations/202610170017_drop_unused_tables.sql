-- Removes what the original 0004 created for an app that no longer exists: the profiles and
-- user_preferences tables (nothing reads or writes them) and the trigger that filled them
-- for every new account. Run after 202610170016_salary_pf.sql. On a project built from this
-- folder none of it exists, so the file changes nothing there.
--
-- Not reversible: the two tables are deleted with their rows. They hold no financial data
-- (a display name that was never set, theme and similar defaults).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists internal.handle_new_user();
drop table if exists public.user_preferences;
drop table if exists public.profiles;
