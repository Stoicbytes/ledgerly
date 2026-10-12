import { suggestNotes } from '../notes';
import type { Transaction } from '../types';

const entry = (
  id: string,
  note: string,
  categoryId: string,
  date: string,
  kind: Transaction['kind'] = 'expense',
): Transaction => ({
  id,
  kind,
  date,
  amount: 100,
  accountId: 'cash',
  toAccountId: null,
  fee: 0,
  categoryId,
  note,
  createdAt: 0,
});

const history = [
  entry('1', 'Morning tea', 'tea', '2026-10-01'),
  entry('2', 'morning tea', 'tea', '2026-10-05'),
  entry('3', 'Tea with team', 'tea', '2026-09-10'),
  entry('4', 'Biriyani', 'eating-out', '2026-10-02'),
  entry('5', 'Instant tea powder', 'groceries', '2026-08-01'),
  entry('6', 'Salary', 'salary', '2026-10-01', 'income'),
  entry('7', '  ', 'tea', '2026-10-06'),
];

describe('suggestNotes', () => {
  it('ranks prefix matches above word and substring matches, once per note', () => {
    const notes = suggestNotes(history, { query: 'te', kind: 'expense', categoryId: null });
    expect(notes.map((item) => item.note)).toEqual([
      'Tea with team',
      'morning tea',
      'Instant tea powder',
    ]);
    // Grouped case-insensitively, newest spelling, with its usual category.
    expect(notes[1]).toEqual({ note: 'morning tea', categoryId: 'tea', count: 2 });
  });

  it('puts notes from the chosen category first', () => {
    const notes = suggestNotes(history, { query: '', kind: 'expense', categoryId: 'eating-out' });
    expect(notes[0].note).toBe('Biriyani');
  });

  it('keeps income and expense notes apart, skips blanks and the exact text typed', () => {
    expect(suggestNotes(history, { query: 'sal', kind: 'expense', categoryId: null })).toEqual([]);
    expect(suggestNotes(history, { query: 'sal', kind: 'income', categoryId: null })[0].note).toBe(
      'Salary',
    );
    expect(suggestNotes(history, { query: 'biriyani', kind: 'expense', categoryId: null })).toEqual(
      [],
    );
  });

  it('suggests the most used notes when nothing is typed', () => {
    const notes = suggestNotes(history, { query: '', kind: 'expense', categoryId: null, limit: 2 });
    expect(notes.map((item) => item.note)).toEqual(['morning tea', 'Biriyani']);
  });
});
