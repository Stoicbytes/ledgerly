import { callRpc, RpcError } from './rpc';

/** What a reset clears (migration 0018, public.reset_data). */
export type ResetScope = 'expense_entries' | 'expenses_all' | 'mutual_funds' | 'stocks';

export class ResetUnavailableError extends Error {
  constructor() {
    super('The reset needs database migration 0018.');
    this.name = 'ResetUnavailableError';
  }
}

/** Deletes that part of the signed-in user's data; returns rows removed per table. */
export async function resetData(scope: ResetScope): Promise<Record<string, number>> {
  try {
    return await callRpc<Record<string, number>>('reset_data', { p_scope: scope });
  } catch (error) {
    // PostgREST answers 404 (PGRST202) for a function that does not exist yet.
    if (error instanceof RpcError && error.status === 404) throw new ResetUnavailableError();
    throw error;
  }
}
