import { isCurrencyWord, parsePrintedAmount } from './amount';
import { headingSection, normaliseLabel, type Section } from './labels';
import type { TextLine } from './types';

/** A printed label with this month's amount, and the part of the payslip it was under. */
export type Pair = { label: string; amount: number; section: Section | null };

type Token =
  | { kind: 'label'; text: string; x: number; end: number }
  | { kind: 'amount'; value: number; x: number; end: number };
type Role = 'current' | 'total' | 'ytd' | 'rate' | 'other';
type Column = { role: Role; x: number; end: number };

const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[,.]?$/i;

/** A line as labels and amounts; words far apart (another column) start a new label. */
function tokenize(line: TextLine): Token[] {
  const tokens: Token[] = [];
  let afterMonth = false;
  line.words.forEach((word, i) => {
    const previous = tokens[tokens.length - 1];
    const text = word.text.replace(/:$/, '');
    if (!text || /^[:|\-–]$/.test(text)) return;
    // "Loan 0012:" ends a label: a number before a colon is part of it.
    const value = isCurrencyWord(text) || word.text.endsWith(':') ? null : parsePrintedAmount(text);
    const isDatePart = afterMonth && /^\d{2,4}$/.test(text);
    afterMonth = MONTH.test(text);
    // "31 Aug 2026" is a date, not amounts.
    if (afterMonth && previous?.kind === 'amount' && /^\d{1,2}$/.test(line.words[i - 1].text)) {
      tokens.pop();
      tokens.push({
        kind: 'label',
        text: line.words[i - 1].text,
        x: previous.x,
        end: previous.end,
      });
    }
    if (value !== null && !isDatePart) {
      tokens.push({ kind: 'amount', value, x: word.x, end: word.end });
      return;
    }
    if (isCurrencyWord(text)) return;
    const last = tokens[tokens.length - 1];
    if (last?.kind === 'label' && word.x - last.end < Math.max(word.size, 6) * 2) {
      tokens[tokens.length - 1] = { ...last, text: `${last.text} ${text}`, end: word.end };
    } else tokens.push({ kind: 'label', text, x: word.x, end: word.end });
  });
  return tokens;
}

function roleOf(text: string): Role | null {
  const t = normaliseLabel(text);
  if (/\b(ytd|year to date|cumulative|till date|upto|up to|todate)\b/.test(t)) return 'ytd';
  if (/\b(full|rate|standard|fixed|master|monthly rate|entitled)\b/.test(t)) return 'rate';
  if (/^total\b/.test(t)) return 'total';
  if (/\b(current|this month|actual|earned|paid|amount|month|value|rs|inr)\b/.test(t))
    return 'current';
  if (/\barrears?\b/.test(t)) return 'other';
  return null;
}

const centre = (item: { x: number; end: number }) => (item.x + item.end) / 2;

/** This month's amount among a row's amounts, by the column each sits under. */
function pick(amounts: Token[], columns: Column[]): number | null {
  if (amounts.length === 0 || amounts[0].kind !== 'amount') return null;
  const roles = amounts.map((amount) => {
    const near = [...columns].sort(
      (a, b) => Math.abs(centre(a) - centre(amount)) - Math.abs(centre(b) - centre(amount)),
    )[0];
    return near && Math.abs(centre(near) - centre(amount)) < 90 ? near.role : null;
  });
  const value = (i: number) => (amounts[i].kind === 'amount' ? amounts[i].value : 0);
  for (const role of ['total', 'current'] as const) {
    const i = roles.indexOf(role);
    if (i >= 0) return value(i);
  }
  const plain = roles.findIndex((role) => role !== 'ytd' && role !== 'rate');
  if (plain >= 0) return value(plain);
  // Only a YTD or rate figure: this month's column is blank.
  return columns.some((column) => column.role === 'current') ? null : value(0);
}

/**
 * Labels paired with amounts across a payslip's lines. Headings set the part ("Earnings",
 * "Deductions", "Employer contribution"); a heading row with both Earnings and Deductions
 * splits the page into two sides; column headings tell this month's amount from YTD.
 */
export function readPairs(lines: TextLine[]): Pair[] {
  const pairs: Pair[] = [];
  let section: Section | null = null;
  let split: number | null = null;
  let columns: Column[] = [];
  for (const line of lines) {
    const tokens = tokenize(line);
    if (!tokens.some((token) => token.kind === 'amount')) {
      const labels = tokens.flatMap((token) => (token.kind === 'label' ? [token] : []));
      const headings = labels.flatMap((token) => {
        const found = headingSection(token.text);
        return found ? [{ found, x: token.x }] : [];
      });
      const roles = labels.flatMap((token) => {
        const role = roleOf(token.text);
        return role && !headingSection(token.text) ? [{ role, x: token.x, end: token.end }] : [];
      });
      if (!headings.length && roles.length < 2) continue;
      const deductions = headings.find((item) => item.found === 'deductions');
      const earnings = headings.find((item) => item.found === 'earnings');
      split = earnings && deductions && deductions.x > earnings.x ? deductions.x - 5 : null;
      section = split !== null ? null : (headings[0]?.found ?? section);
      if (roles.length || headings.length) columns = roles;
      continue;
    }
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.kind !== 'label') continue;
      const amounts: Token[] = [];
      while (tokens[i + 1]?.kind === 'amount') amounts.push(tokens[++i]);
      const side = split === null ? section : token.x >= split ? 'deductions' : 'earnings';
      const sideColumns =
        split === null ? columns : columns.filter((c) => c.x >= split! === token.x >= split!);
      const amount = pick(amounts, sideColumns);
      if (amount !== null)
        pairs.push({ label: token.text.replace(/[:\-–\s]+$/, ''), amount, section: side });
    }
  }
  return pairs;
}
