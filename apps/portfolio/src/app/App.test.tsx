import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeDocument } from '../lib/normalize';
import { config, rawDocument } from '../test/fixture';
import { App } from './App';
import type { InitialState } from './state';

const doc = normalizeDocument(rawDocument)!;
const state = (patch: Partial<InitialState> = {}): InitialState => ({
  path: '/',
  mode: 'live',
  document: doc,
  config,
  fetchedAt: Date.now(),
  today: '2026-10-11',
  origin: 'https://sam.example.com',
  dashboardUrl: null,
  ...patch,
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('portfolio app', () => {
  it('hydrates the server-rendered page without mismatches', async () => {
    const initial = state();
    const container = document.createElement('div');
    container.innerHTML = renderToString(<App initial={initial} />);
    document.body.appendChild(container);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <App initial={initial} />);
    });
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector('h1')?.textContent).toContain('Sam Example');
    container.remove();
  });

  it('shows only sections with content, in order, and hides the ones you hide', () => {
    render(<App initial={state()} />);
    const nav = screen.getAllByRole('navigation', { name: 'Sections' })[0]!;
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Work', 'Stack', 'Experience', 'About', 'Credentials', 'Contact']);
    expect(screen.queryByText('Off the')).toBeNull();
  });

  it('never renders unsafe links from the document', () => {
    const { container } = render(<App initial={state()} />);
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.toLowerCase().startsWith('javascript'))).toBe(false);
  });

  it('filters skills and expands a description', () => {
    render(<App initial={state()} />);
    const stack = within(document.getElementById('stack')!);
    fireEvent.click(stack.getByRole('button', { name: /Frontend 1/ }));
    expect(stack.getByText('Angular')).toBeTruthy();
    expect(stack.queryByRole('button', { name: /Java/ })).toBeNull();
    fireEvent.click(stack.getByRole('button', { name: /All 3/ }));
    const java = stack.getByRole('button', { name: /Java/ });
    expect(java.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(java);
    expect(java.getAttribute('aria-expanded')).toBe('true');
    expect(stack.getByText('Daily driver.')).toBeTruthy();
  });

  it('shows a skill level only when one was set', () => {
    render(<App initial={state()} />);
    expect(
      screen.getAllByRole('img', { name: /of 5/ }).map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Advanced (4 of 5)']);
  });

  it('opens a project page from the work section and back', async () => {
    render(<App initial={state()} />);
    fireEvent.click(screen.getByRole('link', { name: 'First project' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('First project'),
    );
    expect(window.location.pathname).toBe('/projects/first-project');
    expect(screen.getByRole('link', { name: /Source code/ }).getAttribute('href')).toBe(
      'https://github.com/example/first',
    );
    expect(document.title).toBe('First project — Sam Example');
  });

  it('validates the contact form and sends it to the server', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('"sent"'));
    render(<App initial={state()} />);
    fireEvent.click(screen.getByRole('button', { name: /Send message/ }));
    expect(screen.getByText('Please add your name.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visitor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'v@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hello, a longer message.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send message/ }));
    await waitFor(() => expect(screen.getByText('Thank you, message sent.')).toBeTruthy());
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/portfolio_contact');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      p_handle: 'sample',
      p_name: 'Visitor',
      p_email: 'v@example.com',
      p_trap: '',
    });
  });

  it('explains rate limits from the server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('"limited"'));
    render(<App initial={state()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visitor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'v@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hello, a longer message.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send message/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Too many messages'),
    );
  });

  it('loads a preview from the link fragment, hides the token and disables the form', async () => {
    const token = 'a'.repeat(64);
    window.history.replaceState(null, '', `/preview#t=${token}`);
    const preview = {
      ...rawDocument,
      preview: true,
      previewExpiresAt: '2026-10-11T09:00:00Z',
      version: null,
    };
    preview.projects = [{ ...rawDocument.projects[0]!, draft: true }];
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(preview)));
    render(<App initial={state({ path: '/preview', mode: 'preview', document: null })} />);
    expect(screen.getByText('Loading the preview…')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('note').textContent).toContain('Not published'));
    expect(window.location.hash).toBe('');
    expect(JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body))).toEqual({
      p_token: token,
    });
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Send message/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('says when nothing is published', () => {
    render(<App initial={state({ mode: 'unpublished', document: null })} />);
    expect(screen.getByRole('heading', { name: 'Nothing is published here yet' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Dashboard/ })).toBeNull();
  });

  it('offers the way into the dashboard when one is set, even before publishing', () => {
    const { unmount } = render(<App initial={state({ dashboardUrl: '/dashboard' })} />);
    const links = screen.getAllByRole('link', { name: /Dashboard/, hidden: true });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dashboard', '/dashboard']);
    expect(links.every((link) => link.getAttribute('rel') === 'nofollow')).toBe(true);
    unmount();
    render(
      <App initial={state({ mode: 'unpublished', document: null, dashboardUrl: '/dashboard' })} />,
    );
    expect(screen.getByRole('link', { name: /Dashboard/ }).getAttribute('href')).toBe('/dashboard');
  });
});
