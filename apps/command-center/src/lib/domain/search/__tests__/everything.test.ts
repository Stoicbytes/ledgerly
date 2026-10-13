import type { Fund, Goal, Stock } from '../../investments';
import type { Note } from '../../notes';
import type { Employer, Payslip } from '../../salary';
import { searchEverything, type SearchSources } from '..';

const note = (over: Partial<Note>): Note => ({
  id: 'n1',
  title: '',
  body: '',
  items: null,
  color: 'default' as Note['color'],
  pinned: false,
  archived: false,
  labels: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});
const sources = (): SearchSources => ({
  notes: [
    note({ id: 'n1', title: 'Car insurance', body: 'Renew with Acko before March' }),
    note({ id: 'n2', items: [{ id: 'i', text: 'Buy milk', done: false }] }),
    note({ id: 'n3', title: 'Old insurance', trashedAt: 1 }),
  ],
  funds: [
    {
      id: 'f1',
      name: 'Parag Parikh Flexi Cap Fund',
      fundHouse: 'PPFAS',
      category: 'Equity Scheme - Flexi Cap Fund',
      folio: '9876543',
      note: '',
    } as Fund,
  ],
  goals: [
    {
      id: 'g1',
      name: 'House down payment',
      targetAmount: 1,
      targetDate: '2030-03-01',
      expectedReturn: 10,
      createdAt: 0,
    } as Goal,
  ],
  stocks: [
    {
      id: 's1',
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      exchange: 'NSE',
      sector: 'IT',
      note: '',
    } as Stock,
  ],
  employers: [
    {
      id: 'e1',
      name: 'Fintech Ltd',
      joinedOn: '2022-01-10',
      leftOn: null,
      note: '',
      createdAt: 0,
    } as Employer,
  ],
  payslips: [
    {
      id: 'p1',
      employerId: 'e1',
      month: '2026-04',
      earnings: [{ label: 'Basic', amount: 1 }],
      deductions: [{ label: 'Professional tax', amount: 1 }],
      note: '',
    } as unknown as Payslip,
  ],
});

describe('searching beyond entries', () => {
  it('finds notes (not deleted ones), funds, goals, shares, employers and payslips', () => {
    expect(searchEverything('insurance', sources()).map((hit) => hit.id)).toEqual(['n1']);
    expect(searchEverything('milk', sources())[0]).toMatchObject({
      kind: 'note',
      title: 'Buy milk',
    });
    expect(searchEverything('flexi cap', sources())[0]).toMatchObject({
      kind: 'fund',
      href: '/dashboard/mutual-funds',
    });
    expect(searchEverything('house', sources())[0]).toMatchObject({
      kind: 'goal',
      detail: 'Target Mar 2030',
    });
    expect(searchEverything('tcs', sources())[0]).toMatchObject({
      title: 'TCS · Tata Consultancy Services',
    });
    expect(searchEverything('fintech', sources()).map((hit) => hit.kind)).toEqual([
      'employer',
      'payslip',
    ]);
    expect(searchEverything('april professional', sources())[0]).toMatchObject({
      title: 'Payslip Apr 2026',
      detail: 'Fintech Ltd',
    });
  });

  it('needs every word, ignores case and accents, and never matches folio numbers', () => {
    expect(searchEverything('ACKO renew', sources())).toHaveLength(1);
    expect(searchEverything('acko march milk', sources())).toEqual([]);
    expect(searchEverything('9876543', sources())).toEqual([]);
    expect(searchEverything('   ', sources())).toEqual([]);
  });
});
