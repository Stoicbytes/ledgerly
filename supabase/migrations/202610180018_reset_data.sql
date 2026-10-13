-- Reset options in Settings: deletes one part of the signed-in user's data in a single
-- transaction, so a large ledger is cleared at once (the app's normal sync sends at most
-- 5,000 rows per list). Run after 202610170017_drop_unused_tables.sql.
--
--   * reset_data('expense_entries'): entries and recurring entries. Splits and repayment
--     links go with their entries (on delete cascade); payslips keep their figures and only
--     lose the link to their income entry (on delete set null). Accounts, categories,
--     budgets and people stay.
--   * reset_data('expenses_all'): the above, then people, categories and accounts too.
--   * reset_data('mutual_funds'): funds (their transactions and SIPs go with them) and goals.
--   * reset_data('stocks'): shares and their trades. The chosen benchmark stays.
--
-- Security invoker: Row Level Security still applies (own rows only, two-step sign-in
-- required), and the audit triggers record every deleted row. Each delete also names the
-- user, so the function cannot reach anyone else's rows even if a policy were wrong.
-- Returns how many rows each table lost.
--
-- Rollback (removes the function; deleted data is not restored):
--   drop function if exists public.reset_data(text);

create or replace function public.reset_data(p_scope text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_counts jsonb := '{}';
  v_rows integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_scope is null
    or p_scope not in ('expense_entries', 'expenses_all', 'mutual_funds', 'stocks') then
    raise exception 'Unknown reset' using errcode = '22023';
  end if;

  if p_scope in ('expense_entries', 'expenses_all') then
    delete from public.recurring_entries where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('recurring_entries', v_rows);
    delete from public.transactions where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('transactions', v_rows);
  end if;

  if p_scope = 'expenses_all' then
    delete from public.people where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('people', v_rows);
    -- Subcategories go with their parents (on delete cascade).
    delete from public.categories where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('categories', v_rows);
    delete from public.accounts where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('accounts', v_rows);
  end if;

  if p_scope = 'mutual_funds' then
    delete from public.mf_funds where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('mf_funds', v_rows);
    delete from public.investment_goals where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('investment_goals', v_rows);
  end if;

  if p_scope = 'stocks' then
    delete from public.stocks where user_id = v_user;
    get diagnostics v_rows = row_count;
    v_counts := v_counts || pg_catalog.jsonb_build_object('stocks', v_rows);
  end if;

  return v_counts;
end;
$$;
revoke all on function public.reset_data(text) from public, anon;
grant execute on function public.reset_data(text) to authenticated;
