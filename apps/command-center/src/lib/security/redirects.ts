/**
 * Where to go after sign-in. `?redirect=` comes from the URL, so it is untrusted:
 * only same-origin dashboard paths made of plain segments are allowed. Anything else
 * (other hosts, `//host`, `javascript:`, backslashes, encoded tricks, queries) falls
 * back to the dashboard home.
 */
export const DEFAULT_AFTER_SIGN_IN = '/dashboard';

const DASHBOARD_PATH = /^\/dashboard(?:\/[a-z0-9-]+){0,3}\/?$/;

export function safeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return DEFAULT_AFTER_SIGN_IN;
  let path = raw;
  try {
    // One decode only: double-encoded input stays encoded and fails the pattern.
    path = decodeURIComponent(raw);
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
  return DASHBOARD_PATH.test(path)
    ? path.replace(/\/$/, '') || DEFAULT_AFTER_SIGN_IN
    : DEFAULT_AFTER_SIGN_IN;
}
