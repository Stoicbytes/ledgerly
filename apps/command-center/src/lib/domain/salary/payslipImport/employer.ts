import type { Employer } from '../types';
import { isIdentityLabel } from './labels';
import type { Confidence, TextLine } from './types';

const SUFFIX =
  /^(.*?\b(?:pvt\.?\s*ltd|private\s+limited|limited|ltd|llp|inc|llc|corporation|corp|gmbh|plc)\b\.?)/i;
const BUSINESS =
  /\b(technologies|technology|tech|solutions|services|systems|software|labs|consulting|consultants|industries|enterprises|bank|group|company|infotech|analytics|retail|pharma|motors|finance|digital)\b/i;
const NOT_A_NAME =
  /pay\s*slip|salary\s*slip|wage\s*slip|statement|month|period|employee|designation|department|confidential|\d{6}|^\W*$/i;
const EXPLICIT = /^(?:company|employer|organi[sz]ation|establishment)(?:\s+name)?\s*[:\-]\s*(.+)$/i;

const lineText = (line: TextLine) => line.words.map((word) => word.text).join(' ');
const clean = (name: string) =>
  name
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:\-–|]+$/, '')
    .trim();
/** Long digit runs are never part of a name kept here. */
const plausible = (name: string) => name.length >= 3 && name.length <= 80 && !/\d{6}/.test(name);

/**
 * The employer's name, usually the heading at the top of the first page: a line with
 * "Company: …", or one ending in Pvt Ltd / LLP / Inc… (high confidence), else the largest
 * text near the top (low).
 */
export function detectEmployer(lines: TextLine[]): { name: string; confidence: Confidence } | null {
  const top = lines.filter((line) => line.page === 0).slice(0, 12);
  for (const line of lines.slice(0, 40)) {
    const explicit = EXPLICIT.exec(lineText(line));
    if (explicit && plausible(clean(explicit[1])))
      return { name: clean(explicit[1]), confidence: 'high' };
  }
  const candidates = top.filter((line) => {
    const text = lineText(line);
    return !NOT_A_NAME.test(text) && !isIdentityLabel(text) && /[a-z]{2}/i.test(text);
  });
  for (const line of top) {
    const text = lineText(line);
    const suffix = isIdentityLabel(text) ? null : SUFFIX.exec(text);
    if (suffix && plausible(clean(suffix[1])))
      return { name: clean(suffix[1]), confidence: 'high' };
  }
  for (const line of candidates) {
    const text = clean(lineText(line));
    if (BUSINESS.test(text) && plausible(text)) return { name: text, confidence: 'high' };
  }
  const size = (line: TextLine) => Math.max(...line.words.map((word) => word.size));
  const largest = [...candidates].sort((a, b) => size(b) - size(a))[0];
  const name = largest ? clean(lineText(largest)) : '';
  return plausible(name) ? { name, confidence: 'low' } : null;
}

/** "Example Tech Pvt. Ltd." and "EXAMPLE TECH PRIVATE LIMITED" compare equal. */
export function normaliseEmployerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bprivate\b/g, 'pvt')
    .replace(/\blimited\b/g, 'ltd')
    .replace(/\bcorporation\b/g, 'corp')
    .replace(/\bincorporated\b/g, 'inc')
    .replace(/\bcompany\b/g, 'co')
    .replace(/^the\b/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const core = (name: string) =>
  normaliseEmployerName(name)
    .replace(/\b(pvt|ltd|llp|inc|llc|corp|co|gmbh|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The existing employer a printed name refers to, if any. */
export function matchEmployer(name: string, employers: readonly Employer[]): Employer | null {
  const full = normaliseEmployerName(name);
  const exact = employers.find((item) => normaliseEmployerName(item.name) === full);
  if (exact) return exact;
  const short = core(name);
  return (short && employers.find((item) => core(item.name) === short)) || null;
}
