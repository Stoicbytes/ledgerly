/**
 * market-refresh: downloads public market data on the server and stores it in the
 * market tables (migration 0007). The app never fetches market data itself.
 *
 *   * Mutual fund NAVs: AMFI's daily NAV file (all schemes, official).
 *   * Share prices: the exchange end-of-day file (NSE bhavcopy; BSE if NSE is
 *     unavailable). End of day only: there is no free official live-quote service.
 *   * NAV history for charts: mfapi.in, only for schemes someone holds.
 *
 * Who may call it:
 *   * the daily schedule (pg_cron), with the MARKET_REFRESH_SECRET header;
 *   * a signed-in user (the app's "Update prices"), with their access token. Users
 *     cannot refresh more often than every 30 minutes; data already current is skipped.
 *
 * Deploy with JWT verification off (the function checks callers itself):
 *   supabase functions deploy market-refresh --no-verify-jwt
 * Logs never contain tokens, secrets or response bodies.
 */
import { handle } from "./handler.ts";

Deno.serve(handle);
