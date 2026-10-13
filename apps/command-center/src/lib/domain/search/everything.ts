import type { Fund, Goal, Stock } from '../investments';
import type { Note } from '../notes';
import type { Employer, Payslip } from '../salary';

/**
 * Search beyond entries: notes, funds, goals, shares, employers and payslips, by words.
 * Every word must appear (in any order, any case). Account-like numbers (folios, member
 * ids) are never searched or shown.
 */
export type SearchHit = {
  kind: 'note' | 'fund' | 'goal' | 'stock' | 'employer' | 'payslip';
  id: string;
  title: string;
  detail: string;
  /** Where the hit lives in the app. */
  href: string;
};

export type SearchSources = {
  notes: Note[];
  funds: Fund[];
  goals: Goal[];
  stocks: Stock[];
  employers: Employer[];
  payslips: Payslip[];
};

export const HIT_LABELS: Record<SearchHit['kind'], string> = {
  note: 'Notes',
  fund: 'Mutual funds',
  goal: 'Goals',
  stock: 'Stocks',
  employer: 'Employers',
  payslip: 'Payslips',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (month: string) =>
  `${MONTHS[Number(month.slice(5, 7)) - 1] ?? ''} ${month.slice(0, 4)}`.trim();
const MONTH_FULL = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const fold = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const snippet = (text: string, max = 80) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

/** Up to `limit` hits per kind, in the order the kinds are listed above. */
export function searchEverything(query: string, sources: SearchSources, limit = 5): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const matches = (...parts: (string | null | undefined)[]) => {
    const haystack = fold(parts.filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  };
  const take = (hits: SearchHit[]) => hits.slice(0, limit);
  const employerName = (id: string) => sources.employers.find((item) => item.id === id)?.name ?? '';

  return [
    ...take(
      sources.notes
        .filter((note) => !note.trashedAt)
        .filter((note) =>
          matches(
            note.title,
            note.body,
            ...(note.items ?? []).map((item) => item.text),
            ...note.labels,
          ),
        )
        .map((note) => ({
          kind: 'note' as const,
          id: note.id,
          title:
            note.title ||
            snippet(note.body || (note.items ?? []).map((i) => i.text).join(', '), 50) ||
            'Untitled note',
          detail: snippet(
            note.items ? (note.items ?? []).map((item) => item.text).join(', ') : note.body,
          ),
          href: '/dashboard/notes',
        })),
    ),
    ...take(
      sources.funds
        .filter((fund) => matches(fund.name, fund.fundHouse, fund.category, fund.note))
        .map((fund) => ({
          kind: 'fund' as const,
          id: fund.id,
          title: fund.name,
          detail: [fund.fundHouse, fund.category].filter(Boolean).join(' · '),
          href: '/dashboard/mutual-funds',
        })),
    ),
    ...take(
      sources.goals
        .filter((goal) => matches(goal.name))
        .map((goal) => ({
          kind: 'goal' as const,
          id: goal.id,
          title: goal.name,
          detail: `Target ${monthName(goal.targetDate.slice(0, 7))}`,
          href: '/dashboard/mutual-funds',
        })),
    ),
    ...take(
      sources.stocks
        .filter((stock) => matches(stock.symbol, stock.name, stock.sector, stock.note))
        .map((stock) => ({
          kind: 'stock' as const,
          id: stock.id,
          title: `${stock.symbol} · ${stock.name}`,
          detail: [stock.exchange, stock.sector].filter(Boolean).join(' · '),
          href: '/dashboard/stocks',
        })),
    ),
    ...take(
      sources.employers
        .filter((employer) => matches(employer.name, employer.note))
        .map((employer) => ({
          kind: 'employer' as const,
          id: employer.id,
          title: employer.name,
          detail: [employer.joinedOn?.slice(0, 4), employer.leftOn?.slice(0, 4) ?? 'now']
            .filter(Boolean)
            .join(' – '),
          href: '/dashboard/salary',
        })),
    ),
    ...take(
      [...sources.payslips]
        .sort((a, b) => b.month.localeCompare(a.month))
        .filter((slip) =>
          matches(
            employerName(slip.employerId),
            monthName(slip.month),
            MONTH_FULL[Number(slip.month.slice(5, 7)) - 1],
            slip.note,
            ...slip.earnings.map((line) => line.label),
            ...slip.deductions.map((line) => line.label),
          ),
        )
        .map((slip) => ({
          kind: 'payslip' as const,
          id: slip.id,
          title: `Payslip ${monthName(slip.month)}`,
          detail: employerName(slip.employerId),
          href: '/dashboard/salary',
        })),
    ),
  ];
}
