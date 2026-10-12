import { readSupabaseConfig, UnsafeSupabaseConfigError } from '../supabaseConfig';

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.signature`;

describe('readSupabaseConfig', () => {
  it('runs in preview mode when nothing is configured', () => {
    expect(readSupabaseConfig(undefined, undefined)).toBeNull();
    expect(readSupabaseConfig('https://abc.supabase.co', '  ')).toBeNull();
  });

  it('accepts an HTTPS project with a publishable key', () => {
    expect(readSupabaseConfig('https://abc.supabase.co/', 'sb_publishable_123')).toEqual({
      url: 'https://abc.supabase.co',
      key: 'sb_publishable_123',
    });
    expect(readSupabaseConfig('https://abc.supabase.co', jwt({ role: 'anon' }))?.key).toBeTruthy();
  });

  it('allows plain HTTP only for a local Supabase', () => {
    expect(readSupabaseConfig('http://localhost:54321', 'sb_publishable_1')?.url).toBe(
      'http://localhost:54321',
    );
    expect(() => readSupabaseConfig('http://abc.supabase.co', 'sb_publishable_1')).toThrow(
      UnsafeSupabaseConfigError,
    );
  });

  it('refuses secret and service-role keys', () => {
    expect(() => readSupabaseConfig('https://abc.supabase.co', 'sb_secret_abc')).toThrow(
      /secret key/,
    );
    expect(() =>
      readSupabaseConfig('https://abc.supabase.co', jwt({ role: 'service_role' })),
    ).toThrow(/service-role/);
  });

  it('refuses a malformed URL', () => {
    expect(() => readSupabaseConfig('not a url', 'sb_publishable_1')).toThrow(/valid URL/);
  });
});
