import { frequentCategories } from '../frequent';
import type { Category, Transaction } from '../types';

const category = (id: string, parentId: string | null = null, kind = 'expense'): Category =>
  ({ id, name: id, kind, parentId, icon: 'tag', tint: 0, budget: null, order: 0 }) as Category;
const categories = [
  category('food'),
  category('tea', 'food'),
  category('fuel'),
  category('rent'),
  category('fun'),
  category('gym'),
  category('books'),
  category('pay', null, 'income'),
];
let n = 0;
const entry = (categoryId: string, date: string, kind = 'expense'): Transaction =>
  ({ id: `t${(n += 1)}`, kind, date, categoryId, amount: 100, accountId: 'cash' }) as Transaction;

describe('frequentCategories', () => {
  const today = '2026-10-14';
  const recent = [
    ...['tea', 'tea', 'tea', 'fuel', 'fuel', 'rent', 'fun', 'gym', 'books'].map((id, index) =>
      entry(id, `2026-10-${String(index + 1).padStart(2, '0')}`),
    ),
    entry('rent', '2026-01-01'),
    entry('rent', '2026-01-02'),
    entry('pay', '2026-10-01', 'income'),
    entry('deleted', '2026-10-02'),
  ];

  it('ranks the last 90 days by use, then by the latest use, up to six', () => {
    expect(frequentCategories(recent, categories, 'expense', today).map((c) => c.id)).toEqual([
      'tea',
      'fuel',
      'books',
      'gym',
      'fun',
      'rent',
    ]);
  });

  it('counts subcategories for their parent when subcategories are off', () => {
    const ids = frequentCategories(recent, categories, 'expense', today, {
      withSubcategories: false,
    }).map((c) => c.id);
    expect(ids[0]).toBe('food');
    expect(ids).not.toContain('tea');
  });

  it('shows nothing until four categories have been used', () => {
    expect(frequentCategories(recent.slice(0, 6), categories, 'expense', today)).toEqual([]);
    expect(frequentCategories(recent, categories, 'income', today)).toEqual([]);
  });
});
