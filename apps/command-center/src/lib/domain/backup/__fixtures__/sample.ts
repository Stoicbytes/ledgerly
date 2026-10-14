import type { CloudData } from '@/lib/data/ledgerRepository';
import { emptySiteData, type SiteData } from '@/lib/domain/site';
import { sampleExtras } from './sampleExtras';

/** Test ids: u(1) → 00000000-0000-4000-8000-000000000001. */
export const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const at = Date.parse('2026-10-01T08:00:00Z');

/** One of every kind of record, as the cloud data holds them (all made-up values). */
export function sampleData(): CloudData {
  return {
    accounts: [
      { id: u(1), name: 'Cash', group: 'cash', openingBalance: 0, order: 0 },
      { id: u(2), name: 'Bank', group: 'bank', openingBalance: 500000, order: 1 },
    ],
    categories: [
      {
        id: u(10),
        kind: 'expense',
        parentId: null,
        name: 'Food',
        icon: 'food',
        tint: 1,
        budget: 900000,
        order: 0,
      },
      {
        id: u(11),
        kind: 'expense',
        parentId: u(10),
        name: 'Tea',
        icon: 'coffee',
        tint: 1,
        budget: null,
        order: 0,
      },
      {
        id: u(12),
        kind: 'income',
        parentId: null,
        name: 'Salary',
        icon: 'salary',
        tint: 2,
        budget: null,
        order: 1,
      },
    ],
    people: [{ id: u(20), name: 'Friend', order: 0 }],
    transactions: [
      {
        id: u(30),
        kind: 'expense',
        date: '2026-09-01',
        amount: 30000,
        accountId: u(1),
        toAccountId: null,
        fee: 0,
        categoryId: u(11),
        note: 'Tea for two',
        createdAt: at,
        splits: [{ personId: u(20), amount: 15000 }],
        personId: null,
        settles: [],
      },
      {
        id: u(31),
        kind: 'income',
        date: '2026-09-02',
        amount: 15000,
        accountId: u(2),
        toAccountId: null,
        fee: 0,
        categoryId: null,
        note: '',
        createdAt: at,
        splits: [],
        personId: u(20),
        settles: [u(30)],
      },
      {
        id: u(32),
        kind: 'transfer',
        date: '2026-09-03',
        amount: 100000,
        accountId: u(2),
        toAccountId: u(1),
        fee: 500,
        categoryId: null,
        note: 'ATM',
        createdAt: at,
        splits: [],
        personId: null,
        settles: [],
      },
      {
        id: u(33),
        kind: 'income',
        date: '2026-09-30',
        amount: 5000000,
        accountId: u(2),
        toAccountId: null,
        fee: 0,
        categoryId: u(12),
        note: 'Pay',
        createdAt: at,
        splits: [],
        personId: null,
        settles: [],
      },
    ],
    notes: [
      {
        id: u(40),
        title: 'List',
        body: '',
        items: [{ id: 'a', text: 'Milk', done: false }],
        color: 'mint',
        pinned: true,
        archived: false,
        labels: ['home'],
        remindOn: '2026-10-20',
        trashedAt: null,
        createdAt: at,
        updatedAt: at,
      },
    ],
    noteExtras: true,
    ...sampleExtras(),
  };
}

/** A small portfolio site with an image that is not restored. */
export function sampleSite(): SiteData {
  const site = emptySiteData();
  site.profile = {
    id: u(100),
    handle: 'sample-site',
    full_name: 'Sample Person',
    title: 'Engineer',
    availability: 'open',
    avatar: { path: 'x/a.png', small: null, width: 1, height: 1, alt: 'Me' },
  };
  site.rows.skill_group = [
    { id: u(101), name: 'Backend', description: '', visible: true, sort_order: 0 },
  ];
  site.rows.skill = [
    {
      id: u(102),
      group_id: u(101),
      name: 'SQL',
      icon: '',
      level: null,
      description: '',
      featured: false,
      visible: true,
      sort_order: 0,
    },
  ];
  return site;
}

/** No records at all (a fresh account with every migration applied). */
export const emptyData = (): CloudData => ({
  accounts: [],
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  noteExtras: true,
  recurring: [],
  goals: [],
  employers: [],
  payslips: [],
  pfEntries: [],
  portfolio: { funds: [], sips: [], fundTxns: [], stocks: [], trades: [] },
});
