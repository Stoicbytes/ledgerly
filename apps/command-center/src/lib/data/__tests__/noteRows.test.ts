import { noteFromRemote, noteRow } from '../ledgerRows';

describe('note rows', () => {
  it('reads and writes the reminder and deletion date (migration 0015)', () => {
    const note = noteFromRemote({
      id: 'n1',
      title: 'Renew',
      body: 'insurance',
      color: 'mint',
      labels: ['home'],
      remind_on: '2026-11-01',
      trashed_at: '2026-10-12T10:00:00+00:00',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    });
    expect(note).toMatchObject({
      remindOn: '2026-11-01',
      trashedAt: Date.parse('2026-10-12T10:00:00Z'),
    });
    expect(noteRow(note)).toMatchObject({
      remind_on: '2026-11-01',
      trashed_at: '2026-10-12T10:00:00.000Z',
    });
  });

  it('treats a database without migration 0015 as no reminder and not deleted', () => {
    const note = noteFromRemote({ id: 'n2', title: 'Plain' });
    expect(note).toMatchObject({ remindOn: null, trashedAt: null, color: 'default' });
    expect(noteRow(note)).toMatchObject({ remind_on: null, trashed_at: null });
  });
});
