import {
  mfaMessage,
  needsSecondStep,
  startTotpEnrollment,
  svgFromDataUri,
  withViewBox,
  verifySignInCode,
} from '../mfaRepository';
import { getAuth } from '../supabaseClient';

jest.mock('../supabaseClient', () => ({ getAuth: jest.fn() }));

const mfa = {
  getAuthenticatorAssuranceLevel: jest.fn(),
  listFactors: jest.fn(),
  enroll: jest.fn(),
  unenroll: jest.fn(),
  challengeAndVerify: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getAuth).mockReturnValue({ mfa } as unknown as ReturnType<typeof getAuth>);
});

const factor = (id: string, status: 'verified' | 'unverified') => ({
  id,
  status,
  factor_type: 'totp',
  friendly_name: 'Phone',
});

describe('needsSecondStep', () => {
  it('is true only for a password session of an account with a verified factor', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
    });
    expect(await needsSecondStep()).toBe(true);
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
    });
    expect(await needsSecondStep()).toBe(false);
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
    });
    expect(await needsSecondStep()).toBe(false);
  });

  it('asks for the code when the level cannot be read', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockRejectedValue(new Error('offline'));
    expect(await needsSecondStep()).toBe(true);
  });

  it('never asks in preview mode', async () => {
    jest.mocked(getAuth).mockReturnValue(null);
    expect(await needsSecondStep()).toBe(false);
  });
});

describe('enrolment and verification', () => {
  it('removes a half-finished factor before starting again', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { all: [factor('old', 'unverified'), factor('keep', 'verified')] },
    });
    mfa.unenroll.mockResolvedValue({ error: null });
    mfa.enroll.mockResolvedValue({
      data: { id: 'new', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD' } },
      error: null,
    });
    const result = await startTotpEnrollment();
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' });
    expect(result).toEqual({
      ok: true,
      enrollment: { factorId: 'new', qrSvg: '<svg/>', secret: 'ABCD' },
    });
  });

  it('verifies the sign-in code against the verified factor', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { all: [factor('pending', 'unverified'), factor('phone', 'verified')] },
    });
    mfa.challengeAndVerify.mockResolvedValue({ error: null });
    expect(await verifySignInCode('123456')).toEqual({ ok: true });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'phone', code: '123456' });
  });

  it('turns a wrong code into a safe message', async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [factor('phone', 'verified')] } });
    mfa.challengeAndVerify.mockResolvedValue({
      error: { status: 422, code: 'mfa_verification_failed' },
    });
    expect(await verifySignInCode('000000')).toEqual({
      ok: false,
      message: 'That code did not work. Enter the current 6-digit code from your app.',
    });
  });
});

describe('helpers', () => {
  it('maps rate limits and unknown errors', () => {
    expect(mfaMessage(429, undefined)).toMatch(/Too many attempts/);
    expect(mfaMessage(500, 'unexpected_failure')).toMatch(/Something went wrong/);
  });

  it('adds a viewBox so the QR code scales', () => {
    expect(withViewBox('<svg width="200" height="200" xmlns="x"><rect/></svg>')).toBe(
      '<svg viewBox="0 0 200 200" width="200" height="200" xmlns="x"><rect/></svg>',
    );
    const scaled = '<svg viewBox="0 0 10 10" width="200" height="200"/>';
    expect(withViewBox(scaled)).toBe(scaled);
  });

  it('reads plain, URL-encoded and base64 SVG data URIs', () => {
    expect(svgFromDataUri('data:image/svg+xml;utf-8,<svg a="1"/>')).toBe('<svg a="1"/>');
    expect(svgFromDataUri('data:image/svg+xml,%3Csvg%2F%3E')).toBe('<svg/>');
    expect(svgFromDataUri(`data:image/svg+xml;base64,${btoa('<svg/>')}`)).toBe('<svg/>');
  });
});
