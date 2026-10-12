import { getAuth } from './supabaseClient';
import { supabaseConfig } from './supabaseConfig';

/** The database functions the app may call (anything else is refused before sending). */
export type RpcName =
  | 'load_ledger'
  | 'sync_ledger'
  | 'load_market'
  | 'search_funds'
  | 'search_securities'
  | 'nav_on'
  | 'load_stock_benchmark'
  | 'set_stock_benchmark'
  | 'portfolio_load'
  | 'portfolio_save'
  | 'portfolio_delete'
  | 'portfolio_reorder'
  | 'portfolio_mark_message'
  | 'portfolio_media_paths'
  | 'portfolio_publish'
  | 'portfolio_unpublish'
  | 'portfolio_preview_token';

/** The Edge Functions the app may call. */
export type FunctionName = 'market-refresh';

/** A failed call. Holds only the HTTP status and Postgres error code: never the payload. */
export class RpcError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Request failed (${status}${code ? ` ${code}` : ''})`);
    this.name = 'RpcError';
  }

  /** Worth retrying later (offline, server busy, session refresh), not a rejected change. */
  get retryable(): boolean {
    return (
      this.status === 0 ||
      this.status === 401 ||
      this.status === 408 ||
      this.status === 429 ||
      this.status >= 500
    );
  }
}

/**
 * Calls a Postgres function through Supabase's Data API as the signed-in user, so Row
 * Level Security applies. A small fetch instead of the full client library keeps the
 * bundle lean; only the publishable key and the user's access token are sent.
 */
export async function callRpc<T>(name: RpcName, args: Record<string, unknown> = {}): Promise<T> {
  return post<T>(`rest/v1/rpc/${name}`, args, RPC_TIMEOUT_MS);
}

/**
 * A request that hangs is abandoned (and reported as retryable) instead of leaving
 * "Saving…" on screen for minutes. Retrying a save is safe: sync_ledger upserts by id.
 */
const RPC_TIMEOUT_MS = 30_000;
/** The price function downloads files from AMFI and the exchanges first. */
const FUNCTION_TIMEOUT_MS = 150_000;

/**
 * Calls one of the project's Edge Functions as the signed-in user (the function checks
 * the token itself). A 404 means the function has not been deployed.
 */
export async function callFunction<T>(name: FunctionName, body: Record<string, unknown> = {}) {
  return post<T>(`functions/v1/${name}`, body, FUNCTION_TIMEOUT_MS);
}

async function signedInSession() {
  const auth = getAuth();
  if (!auth || !supabaseConfig) throw new RpcError(0, 'not_configured');
  try {
    return (await auth.getSession()).data.session;
  } catch {
    throw new RpcError(0, 'no_session');
  }
}

/** The signed-in user's access token and id (refreshed by Supabase Auth when needed). */
export async function currentSession(): Promise<{ token: string; userId: string }> {
  const session = await signedInSession();
  const userId = session?.user?.id;
  if (!session?.access_token || !userId) throw new RpcError(401, 'no_session');
  return { token: session.access_token, userId };
}

async function post<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const token = (await signedInSession())?.access_token;
  if (!token || !supabaseConfig) throw new RpcError(401, 'no_session');
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${supabaseConfig.url}/${path}`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new RpcError(0, controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let code: string | undefined;
    try {
      code = ((await response.json()) as { code?: string }).code;
    } catch {
      // No JSON body.
    }
    throw new RpcError(response.status, code);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
