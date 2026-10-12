import type { Transaction } from '@/lib/domain/expenses';
import { buildChanges, fromRemote, type CloudData } from '../ledgerRepository';
import { receiptPhoto, receiptRow } from '../receiptRows';

const receipt = {
  path: 'user-1/0b6e3c1a-2f4d-4c55-9a77-1f2e3d4c5b6a.jpg',
  width: 300,
  height: 400,
  mime_type: 'image/jpeg',
  bytes: 2000,
};
const transaction = {
  id: 't1',
  kind: 'expense',
  occurred_on: '2026-10-01',
  amount: 100,
  account_id: 'a1',
  fee: 0,
  note: '',
  created_at: '2026-10-01T00:00:00Z',
};

describe('receipts in the ledger', () => {
  it('reads a stored receipt as a photo fetched on demand', () => {
    const data = fromRemote({ transactions: [{ ...transaction, receipt }] });
    expect(data.transactions[0].photo).toEqual({
      uri: '',
      path: receipt.path,
      width: 300,
      height: 400,
      mimeType: 'image/jpeg',
      bytes: 2000,
    });
    expect(
      fromRemote({ transactions: [{ ...transaction, receipt: null }] }).transactions[0],
    ).not.toHaveProperty('photo');
    expect(receiptPhoto({ width: 1 })).toBeNull();
    expect(receiptPhoto('x')).toBeNull();
  });

  it('saves only an uploaded photo, in the database names', () => {
    const photo = receiptPhoto(receipt);
    expect(receiptRow(photo)).toEqual(receipt);
    expect(receiptRow({ ...photo!, path: null, uri: 'blob:x' })).toBeNull();
    expect(receiptRow(null)).toBeNull();
  });

  it('sends a transaction whose photo was added, replaced or removed', () => {
    const base = (): CloudData => fromRemote({ transactions: [{ ...transaction, receipt }] });
    const next = base();
    const t = next.transactions[0] as Transaction;
    next.transactions[0] = { ...t, photo: { ...t.photo!, uri: 'blob:local' } };
    expect(buildChanges(base(), next)).toBeNull();
    next.transactions[0] = { ...t, photo: null };
    expect(buildChanges(base(), next)?.transactions).toEqual([
      expect.objectContaining({ id: 't1', receipt: null }),
    ]);
    next.transactions[0] = { ...t, photo: { ...t.photo!, path: 'user-1/other.png' } };
    expect(buildChanges(base(), next)?.transactions).toEqual([
      expect.objectContaining({ receipt: expect.objectContaining({ path: 'user-1/other.png' }) }),
    ]);
  });
});
