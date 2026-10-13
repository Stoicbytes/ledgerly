/** Small text helpers for the CV: plain text from Markdown, and dates the way CVs write them. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Markdown (bold, italic, links, lists, quotes, code) as plain text on one line. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first sentences of a text, up to `maxWords` words, ending on a full sentence. */
export function firstSentences(text: string, maxWords: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [];
  let out = '';
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim();
    if (out && next.split(/\s+/).length > maxWords) break;
    out = next;
  }
  return out;
}

/** "2024-01-15" → "Jan 2024"; empty for anything else. */
export function monthYear(value: unknown): string {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})/.exec(value) : null;
  if (!match) return '';
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : match[1];
}

/** "Jan 2024 – Present", "Jan 2020 – Mar 2023", or one side alone. */
export function dateRange(start: unknown, end: unknown, ongoing = 'Present'): string {
  const from = monthYear(start);
  const to = monthYear(end) || (from ? ongoing : '');
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** A link as people type it on a CV: "linkedin.com/in/name" (no https://, no trailing /). */
export const displayUrl = (url: string) =>
  url
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/+$/, '');

/** Strings in order, trimmed, without empties or repeats (ignoring case). */
export function unique(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}
