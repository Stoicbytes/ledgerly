import { authCodeFrom } from '../authLinks';

describe('authCodeFrom', () => {
  it('reads the code of reset and email-change links opened in the app', () => {
    expect(authCodeFrom('ledgerly://reset-password?code=abc12345-6789')).toBe('abc12345-6789');
    expect(authCodeFrom('ledgerly:///reset-password?code=abcdefgh')).toBe('abcdefgh');
    expect(authCodeFrom('ledgerly://dashboard/settings?code=abcdefgh&type=email')).toBe('abcdefgh');
  });

  it('ignores other paths, missing or odd codes, and no link at all', () => {
    expect(authCodeFrom(null)).toBeNull();
    expect(authCodeFrom('ledgerly://dashboard?code=abcdefgh')).toBeNull();
    expect(authCodeFrom('ledgerly://reset-password')).toBeNull();
    expect(authCodeFrom('ledgerly://reset-password?code=short')).toBeNull();
    expect(authCodeFrom('ledgerly://reset-password?code=<script>alert(1)</script>')).toBeNull();
  });
});
