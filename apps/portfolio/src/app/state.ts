import type { SiteConfig } from '../lib/config';
import type { PortfolioDocument } from '../lib/types';

/**
 * What the server rendered with, embedded in the page so the browser starts from the
 * same state (hydration) instead of fetching again.
 *   live         the published portfolio
 *   preview      a dashboard preview link (drafts included; the browser fetches it)
 *   unpublished  nothing is published at this address yet
 *   unconfigured the site's settings are missing
 *   offline      the database could not be reached; the browser retries
 */
export type Mode = 'live' | 'preview' | 'unpublished' | 'unconfigured' | 'offline';

export type InitialState = {
  path: string;
  mode: Mode;
  document: PortfolioDocument | null;
  config: SiteConfig | null;
  /** When the document was read (ms), so the browser knows whether to look again. */
  fetchedAt: number;
  /** The server's date (YYYY-MM-DD): durations render the same on both sides. */
  today: string;
  origin: string;
  /** The owner's way into the dashboard (sign-in), when the site is set up with one. */
  dashboardUrl: string | null;
};

export const STATE_ELEMENT_ID = 'portfolio-state';
