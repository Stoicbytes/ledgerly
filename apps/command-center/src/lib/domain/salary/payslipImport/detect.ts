import { detectEmployer } from './employer';
import { classifyLabel } from './labels';
import { detectMonth, detectPaidOn } from './month';
import { readPairs } from './pairs';
import type { DetectedPayslip, ImportField, TextLine } from './types';

const textOf = (line: TextLine) => line.words.map((word) => word.text).join(' ');
/** A label kept as printed, unless it carries a long number (an account, a policy…). */
const safeLabel = (label: string) =>
  /\d{5}|[a-z]{5}\d{4}[a-z]/i.test(label) ? null : label.trim();

/** Reads one payslip from its lines of text (one page, or a whole short file). */
export function detectPayslip(lines: TextLine[]): DetectedPayslip {
  const texts = lines.map(textOf);
  const month = detectMonth(texts);
  const employer = detectEmployer(lines);
  const unsure = new Set<ImportField>();
  if (month?.confidence !== 'high') unsure.add('month');
  if (employer?.confidence !== 'high') unsure.add('employer');
  const slip: DetectedPayslip = {
    month: month?.month ?? null,
    paidOn: detectPaidOn(texts),
    employerName: employer?.name ?? null,
    earnings: [],
    deductions: [],
    epfEmployee: 0,
    vpf: 0,
    tds: 0,
    employerEpf: null,
    employerEps: null,
    printed: { gross: null, deductions: null, net: null },
    unsure: [],
  };
  const seen = new Set<string>();
  for (const pair of readPairs(lines)) {
    const { kind, guessed } = classifyLabel(pair.label, pair.section);
    const label = safeLabel(pair.label);
    if (!label) continue;
    // The same line printed twice (a summary box and the table) counts once.
    const key = `${kind}|${label.toLowerCase()}|${pair.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    switch (kind) {
      case 'gross':
        slip.printed.gross ??= pair.amount;
        break;
      case 'totalDeductions':
        slip.printed.deductions ??= pair.amount;
        break;
      case 'net':
        slip.printed.net ??= pair.amount;
        break;
      case 'epfEmployee':
      case 'vpf':
      case 'tds':
        slip[kind] += pair.amount;
        break;
      case 'employerEpf':
      case 'employerEps':
        slip[kind] = (slip[kind] ?? 0) + pair.amount;
        break;
      case 'earning':
      case 'deduction': {
        if (!pair.amount) break;
        const side = kind === 'earning' ? 'earnings' : 'deductions';
        slip[side].push({ label, amount: pair.amount });
        if (guessed) unsure.add(side);
        break;
      }
    }
  }
  slip.unsure = [...unsure];
  return slip;
}

/**
 * One payslip per file, or one per page when a file holds several months (a year of
 * payslips saved as one PDF): each page then names a different month.
 */
export function detectPayslips(pages: TextLine[][]): DetectedPayslip[] {
  const filled = pages.filter((page) => page.length);
  if (filled.length > 1) {
    const each = filled.map(detectPayslip);
    const months = new Set(each.map((slip) => slip.month));
    if (each.every((slip) => slip.month && slip.earnings.length) && months.size === each.length) {
      return each;
    }
  }
  return [detectPayslip(filled.flat())];
}
