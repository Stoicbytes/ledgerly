/**
 * PREVIEW DATA — NOT YOUR FINANCES.
 *
 * When the app is not signed in (no Supabase settings), screens run on generated
 * sample data so the design can be tried: the expense ledger, notes and the
 * investment portfolio (features/investments/state/seedPortfolio.ts). Fund and
 * company names are fictional. Every such screen shows the SampleDataBadge.
 * Signed in, the user's own data replaces all of it.
 */
export const SAMPLE_DATA_LABEL = 'Sample data';
export const SAMPLE_DATA_DESCRIPTION = 'Design preview with sample data — not your real finances.';

/** Editable preview (expense manager): works like the real thing, but nothing is stored. */
export const PREVIEW_STORE_LABEL = 'Preview · not saved';
export const PREVIEW_STORE_DESCRIPTION =
  'Preview with sample data. Entries you add or change stay in this tab only and are lost when the page reloads.';

/** The plan label under the user's name in the header. */
export const PLAN_LABEL = 'Personal';
