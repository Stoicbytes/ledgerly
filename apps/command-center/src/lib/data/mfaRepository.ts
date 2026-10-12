import type { AuthResult } from './authRepository';
import { getAuth } from './supabaseClient';

/**
 * Two-step sign-in (TOTP) through Supabase Auth MFA. As with the password calls,
 * screens get plain results with user-safe messages; the TOTP secret is returned
 * only to the enrolment screen and is never logged.
 */
export type TotpFactor = { id: string; name: string; verified: boolean };

export type Enrollment = {
  factorId: string;
  /** SVG markup of the QR code (black on transparent). */
  qrSvg: string;
  /** The same secret as text, for apps that cannot scan. */
  secret: string;
};

const NOT_CONFIGURED: { ok: false; message: string } = {
  ok: false,
  message: 'Sign-in is not set up for this deployment yet.',
};
const GENERIC = 'Something went wrong. Check your connection and try again.';

/** Maps an MFA error to a message that is safe to show. */
export function mfaMessage(status: number | undefined, code: string | undefined): string {
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (code === 'mfa_verification_failed' || code === 'mfa_challenge_expired' || status === 422) {
    return 'That code did not work. Enter the current 6-digit code from your app.';
  }
  return GENERIC;
}

/** True when this session signed in with a password but still owes the 6-digit code. */
export async function needsSecondStep(): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;
  try {
    const { data } = await auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === 'aal1' && data.nextLevel === 'aal2';
  } catch {
    // If the level cannot be read, ask for the code rather than let the session through.
    return true;
  }
}

export async function listTotpFactors(): Promise<TotpFactor[] | null> {
  const auth = getAuth();
  if (!auth) return [];
  try {
    const { data, error } = await auth.mfa.listFactors();
    if (error || !data) return null;
    return data.all
      .filter((factor) => factor.factor_type === 'totp')
      .map((factor) => ({
        id: factor.id,
        name: factor.friendly_name ?? 'Authenticator app',
        verified: factor.status === 'verified',
      }));
  } catch {
    return null;
  }
}

/** Starts enrolment, first removing any half-finished one so a retry never collides. */
export async function startTotpEnrollment(): Promise<
  { ok: true; enrollment: Enrollment } | { ok: false; message: string }
> {
  const auth = getAuth();
  if (!auth) return NOT_CONFIGURED;
  try {
    const existing = await listTotpFactors();
    for (const factor of existing ?? []) {
      if (!factor.verified) await auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error || !data) return { ok: false, message: mfaMessage(error?.status, error?.code) };
    return {
      ok: true,
      enrollment: {
        factorId: data.id,
        qrSvg: withViewBox(svgFromDataUri(data.totp.qr_code)),
        secret: data.totp.secret,
      },
    };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

/** Checks a 6-digit code against a factor: finishes enrolment, or the sign-in second step. */
export async function verifyTotp(factorId: string, code: string): Promise<AuthResult> {
  const auth = getAuth();
  if (!auth) return NOT_CONFIGURED;
  try {
    const { error } = await auth.mfa.challengeAndVerify({ factorId, code });
    return error ? { ok: false, message: mfaMessage(error.status, error.code) } : { ok: true };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

/** The second step at sign-in, against the account's verified factor. */
export async function verifySignInCode(code: string): Promise<AuthResult> {
  const factors = await listTotpFactors();
  const factor = factors?.find((item) => item.verified);
  if (!factor) return { ok: false, message: GENERIC };
  return verifyTotp(factor.id, code);
}

export async function removeFactor(factorId: string): Promise<AuthResult> {
  const auth = getAuth();
  if (!auth) return NOT_CONFIGURED;
  try {
    const { error } = await auth.mfa.unenroll({ factorId });
    if (!error) return { ok: true };
    if (error.code === 'insufficient_aal') {
      return { ok: false, message: 'Sign in again with your code, then try once more.' };
    }
    return { ok: false, message: mfaMessage(error.status, error.code) };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

/** Ends every session except this one (other browsers, phones). */
export async function signOutOtherDevices(): Promise<AuthResult> {
  const auth = getAuth();
  if (!auth) return NOT_CONFIGURED;
  try {
    const { error } = await auth.signOut({ scope: 'others' });
    return error ? { ok: false, message: GENERIC } : { ok: true };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

/** Supabase returns the QR code as an SVG data URI; the app draws the markup itself. */
export function svgFromDataUri(uri: string): string {
  const comma = uri.indexOf(',');
  const body = uri.startsWith('data:') && comma >= 0 ? uri.slice(comma + 1) : uri;
  if (uri.slice(0, comma).includes(';base64')) return globalThis.atob(body);
  return body.trimStart().startsWith('<') ? body : decodeURIComponent(body);
}

/**
 * Supabase's QR SVG sets only width and height, so it would not scale to the size
 * the app draws it at. Adds the matching viewBox when it is missing.
 */
export function withViewBox(svg: string): string {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!open || /\bviewBox=/i.test(open)) return svg;
  const width = /\bwidth="([\d.]+)(?:px)?"/i.exec(open)?.[1];
  const height = /\bheight="([\d.]+)(?:px)?"/i.exec(open)?.[1];
  if (!width || !height) return svg;
  return svg.replace(open, open.replace(/<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`));
}
