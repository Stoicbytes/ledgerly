// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rawDocument } from '../test/fixture';
import { dashboardUrl, readConfig, siteOrigin, UnsafeConfigError } from './config';
import { jsonForScript } from './escape';
import { duration, monthsBetween, period } from './format';
import { parseInline, parseMarkdown, toPlainText } from './markdown';
import { normalizeDocument } from './normalize';
import { parseRoute } from './routes';
import { buildHead } from './seo';

describe('markdown subset', () => {
  it('reads paragraphs, lists, headings, quotes and code', () => {
    const blocks = parseMarkdown(
      '## Title\n\nOne\ntwo\n\n- a\n- b\n\n1. x\n\n> quote\n\n```\ncode\n```',
    );
    expect(blocks.map((b) => b.type)).toEqual(['h', 'p', 'ul', 'ol', 'quote', 'code']);
    expect(blocks[1]).toEqual({
      type: 'p',
      children: [{ type: 'text', text: 'One' }, { type: 'br' }, { type: 'text', text: 'two' }],
    });
  });

  it('keeps only safe links', () => {
    const nodes = parseInline(
      '[ok](https://a.example) [no](javascript:alert(1)) [self](/projects/x)',
    );
    expect(nodes.filter((n) => n.type === 'link').map((n) => (n as { href: string }).href)).toEqual(
      ['https://a.example/', '/projects/x'],
    );
    expect(nodes.some((n) => n.type === 'text' && n.text === 'no')).toBe(true);
  });

  it('gives plain text for descriptions', () => {
    expect(toPlainText('**Hi** there\n\n- one\n- two')).toBe('Hi there one; two');
    expect(toPlainText('word '.repeat(100), 20).length).toBeLessThanOrEqual(20);
  });
});

describe('document parsing', () => {
  const doc = normalizeDocument(rawDocument)!;

  it('drops unsafe links and keeps the rest', () => {
    expect(doc.links.map((l) => l.label)).toEqual(['GitHub']);
    expect(doc.projects).toHaveLength(2);
    expect(doc.skillGroups[0]!.skills.map((s) => s.name)).toEqual(['Java', 'SQL']);
  });

  it('refuses media outside the expected paths and documents without a name', () => {
    const bad = normalizeDocument({
      ...rawDocument,
      profile: {
        ...rawDocument.profile,
        avatar: { path: 'https://evil.example/x.png', width: 1, height: 1 },
      },
    });
    expect(bad!.profile.avatar).toBeNull();
    expect(normalizeDocument({ profile: { name: '' } })).toBeNull();
    expect(normalizeDocument('nonsense')).toBeNull();
  });

  it('keeps a plain email and drops one that could add mailto: parameters', () => {
    expect(doc.profile.email).toBe('sam@example.com');
    const bad = normalizeDocument({
      ...rawDocument,
      profile: { ...rawDocument.profile, email: 'sam@example.com?cc=x@example.com' },
    });
    expect(bad!.profile.email).toBe('');
  });

  it('never invents numbers for counters', () => {
    const d = normalizeDocument({ ...rawDocument, facts: [{ kind: 'stat', label: 'Years' }] })!;
    expect(d.facts).toEqual([]);
  });
});

describe('settings', () => {
  const base = {
    SUPABASE_URL: 'https://p.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    PORTFOLIO_HANDLE: 'sam',
  };
  it('accepts the publishable key and refuses secrets', () => {
    expect(readConfig(base)).toEqual({
      supabaseUrl: 'https://p.supabase.co',
      key: 'sb_publishable_x',
      handle: 'sam',
    });
    expect(() => readConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' })).toThrow(
      UnsafeConfigError,
    );
    const serviceJwt = `x.${btoa(JSON.stringify({ role: 'service_role' }))}.y`;
    expect(() => readConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: serviceJwt })).toThrow(
      UnsafeConfigError,
    );
    expect(() => readConfig({ ...base, SUPABASE_URL: 'http://p.supabase.co' })).toThrow(
      UnsafeConfigError,
    );
    expect(() => readConfig({ ...base, PORTFOLIO_HANDLE: 'Not valid' })).toThrow(UnsafeConfigError);
    expect(readConfig({})).toBeNull();
  });
  it("falls back to the dashboard's own Supabase settings", () => {
    const shared = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://p.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      PORTFOLIO_HANDLE: 'sam',
    };
    expect(readConfig(shared)?.key).toBe('sb_publishable_x');
    expect(readConfig({ ...shared, SUPABASE_URL: '' })?.supabaseUrl).toBe('https://p.supabase.co');
    expect(() =>
      readConfig({ ...shared, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' }),
    ).toThrow(UnsafeConfigError);
  });
  it('links to the dashboard only by a local path or an https address', () => {
    expect(dashboardUrl({ DASHBOARD_URL: '/dashboard' })).toBe('/dashboard');
    expect(dashboardUrl({ DASHBOARD_URL: 'https://app.example.com/dashboard' })).toBe(
      'https://app.example.com/dashboard',
    );
    expect(dashboardUrl({ DASHBOARD_URL: '//evil.example' })).toBeNull();
    expect(dashboardUrl({ DASHBOARD_URL: 'javascript:alert(1)' })).toBeNull();
    expect(dashboardUrl({ DASHBOARD_URL: 'http://app.example.com' })).toBeNull();
    expect(dashboardUrl({})).toBeNull();
  });
  it('uses SITE_URL for canonical links when it is https', () => {
    expect(siteOrigin({ SITE_URL: 'https://me.example/path' }, 'https://x.vercel.app/a')).toBe(
      'https://me.example',
    );
    expect(siteOrigin({ SITE_URL: 'ftp://nope' }, 'https://x.vercel.app/a')).toBe(
      'https://x.vercel.app',
    );
  });
});

describe('formatting and routes', () => {
  it('counts months like a CV', () => {
    expect(monthsBetween('2024-05-30', '2025-08-19', '2026-01-01')).toBe(16);
    expect(duration(16)).toBe('1 yr 4 mos');
    expect(duration(12)).toBe('1 yr');
    expect(period('2024-05-30', null)).toBe('May 2024 — Present');
  });
  it('recognises pages', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/projects/a-b/')).toEqual({ name: 'project', slug: 'a-b' });
    expect(parseRoute('/projects/../x')).toEqual({ name: 'notFound' });
    expect(parseRoute('/preview')).toEqual({ name: 'preview' });
  });
});

describe('page head', () => {
  const doc = normalizeDocument(rawDocument)!;
  it('escapes text and carries structured data', () => {
    const head = buildHead({
      document: doc,
      route: { name: 'project', slug: 'second-project' },
      origin: 'https://sam.example.com',
      config: null,
      noindex: false,
    });
    expect(head).toContain('<title>Second &lt;/script&gt; project — Sam Example</title>');
    expect(head).toContain(
      '<link rel="canonical" href="https://sam.example.com/projects/second-project" />',
    );
    expect(head).not.toContain('</script> project');
  });
  it('marks pages that must not be indexed', () => {
    const head = buildHead({
      document: doc,
      route: { name: 'home' },
      origin: 'https://x',
      config: null,
      noindex: true,
    });
    expect(head).toContain('noindex');
    expect(head).not.toContain('canonical');
    expect(head).not.toContain('ld+json');
  });
  it('makes embedded JSON safe inside a script tag', () => {
    expect(jsonForScript({ a: '</script><!--' })).toBe('{"a":"\\u003c/script\\u003e\\u003c!--"}');
  });
});
