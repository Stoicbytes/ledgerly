import { DEFAULT_AFTER_SIGN_IN, safeRedirect } from '../redirects';

describe('safeRedirect', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/expenses', '/dashboard/expenses'],
    ['/dashboard/expenses/stats/', '/dashboard/expenses/stats'],
    ['%2Fdashboard%2Faccounts', '/dashboard/accounts'],
  ])('allows the dashboard path %s', (raw, expected) => {
    expect(safeRedirect(raw)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'https://evil.example/dashboard',
    '//evil.example/dashboard',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/dashboard/../sign-in',
    '/dashboard?next=https://evil.example',
    '/dashboard#x',
    '/dashboardx',
    '/sign-in',
    '%252Fdashboard',
    '/dashboard/%2F%2Fevil',
    '/dashboard/' + 'a'.repeat(300),
    ['/dashboard'],
  ])('rejects %p', (raw) => {
    expect(safeRedirect(raw)).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});
