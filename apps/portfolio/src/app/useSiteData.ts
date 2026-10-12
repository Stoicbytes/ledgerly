import { useEffect, useState } from 'react';
import { fetchPreview, fetchPublished } from '../lib/api';
import { normalizeDocument } from '../lib/normalize';
import type { PortfolioDocument } from '../lib/types';
import type { InitialState, Mode } from './state';

/**
 * The document the page shows. It starts with what the server rendered; the browser
 * then re-checks a page that may be out of date (so a visitor never keeps seeing old
 * content), retries when the server could not reach the database, and loads previews.
 */
export type SiteData = {
  mode: Mode;
  document: PortfolioDocument | null;
  /** Preview link missing, expired or not loading. */
  problem: 'missing' | 'expired' | 'failed' | null;
};

const STALE_MS = 30_000;
const TOKEN_KEY = 'portfolio-preview-token';

/** The preview token travels in the URL fragment (never sent to servers) and is then hidden. */
function readPreviewToken(): string | null {
  const match = /(?:^#|&)t=([0-9a-f]{64})(?:&|$)/.exec(window.location.hash);
  if (match?.[1]) {
    try {
      sessionStorage.setItem(TOKEN_KEY, match[1]);
    } catch {
      // Private mode: the link still works until the page is reloaded.
    }
    window.history.replaceState(null, '', window.location.pathname);
    return match[1];
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function useSiteData(initial: InitialState): SiteData {
  const [data, setData] = useState<SiteData>({
    mode: initial.mode,
    document: initial.document,
    problem: null,
  });

  useEffect(() => {
    const config = initial.config;
    if (!config) return;
    let cancelled = false;
    if (initial.mode === 'preview') {
      const token = readPreviewToken();
      if (!token) {
        const timer = setTimeout(
          () => setData((current) => ({ ...current, problem: 'missing' })),
          0,
        );
        return () => clearTimeout(timer);
      }
      fetchPreview(config, token)
        .then((raw) => {
          if (cancelled) return;
          const document = normalizeDocument(raw);
          setData({ mode: 'preview', document, problem: document ? null : 'expired' });
        })
        .catch(() => !cancelled && setData((current) => ({ ...current, problem: 'failed' })));
      return () => {
        cancelled = true;
      };
    }
    const stale = Date.now() - initial.fetchedAt > STALE_MS;
    if (initial.mode === 'offline' || (initial.mode === 'live' && stale)) {
      fetchPublished(config)
        .then((raw) => {
          if (cancelled) return;
          const document = normalizeDocument(raw);
          setData((current) => {
            if (!document) return { mode: 'unpublished', document: null, problem: null };
            if (current.document && current.document.version === document.version) return current;
            return { mode: 'live', document, problem: null };
          });
        })
        .catch(() => {
          // Keep showing what the server rendered.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return data;
}
