import { chunkChanges, halves, toOps, withBases } from '../batches';

const rows = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

describe('batches', () => {
  it('keeps a normal save in one part', () => {
    const changes = { accounts: rows('a', 3), deleted: { notes: ['n1'] } };
    expect(chunkChanges(changes)).toEqual([changes]);
  });

  it('splits by list first, parents before entries, deletes last', () => {
    const [first, second] = halves({
      transactions: rows('t', 2),
      accounts: rows('a', 2),
      deleted: { notes: ['n1'] },
    })!;
    expect(first.accounts).toHaveLength(2);
    expect(first.transactions).toBeUndefined();
    expect(second.transactions).toHaveLength(2);
    expect(second.deleted?.notes).toEqual(['n1']);
    expect(halves({ accounts: rows('a', 1) })).toBeNull();
  });

  it('saves top-level categories before subcategories', () => {
    const ops = toOps({
      categories: [
        { id: 'sub', parent_id: 'top' },
        { id: 'top', parent_id: null },
      ],
    });
    expect(ops.map((op) => op.id)).toEqual(['top', 'sub']);
  });

  it('marks only rows the database already has with their version', () => {
    const marked = withBases({ accounts: rows('a', 2) }, { accounts: { a0: 'T1' } });
    expect(marked.accounts).toEqual([{ id: 'a0', base_updated_at: 'T1' }, { id: 'a1' }]);
  });
});
