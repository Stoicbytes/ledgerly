import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fromRemote } from '@/lib/data/ledgerRepository';
import { saveTextFile } from '@/lib/files/saveTextFile';
import { renderWithProviders } from '@/test/render';
import { ExportCard } from '../ExportCard';
import { buildExport, exportFileName } from '../exportAll';

jest.mock('@/lib/files/saveTextFile', () => ({ saveTextFile: jest.fn(async () => undefined) }));
jest.mock('@/lib/data/siteRepository', () => ({
  loadSite: jest.fn(async () => ({ profile: { headline: 'x' } })),
}));

describe('export everything', () => {
  it('puts every kind of data in one versioned file, receipts as paths only', () => {
    const data = fromRemote({
      accounts: [
        { id: 'a', name: 'Bank', account_group: 'bank', opening_balance: 0, sort_order: 0 },
      ],
      transactions: [
        {
          id: 't',
          kind: 'expense',
          occurred_on: '2026-10-01',
          amount: 100,
          account_id: 'a',
          note: '',
          created_at: '2026-10-01T00:00:00Z',
          receipt: { path: 'u/r.jpg', width: 1, height: 1, mime_type: 'image/jpeg', bytes: 1 },
        },
      ],
      employers: [],
      payslips: [],
      pf_entries: [],
    });
    const file = buildExport(data, { site: true }, new Date('2026-10-13T10:00:00Z'));
    expect(file).toMatchObject({
      app: 'Ledgerly',
      format: 'ledgerly-export',
      version: 1,
      exportedAt: '2026-10-13T10:00:00.000Z',
    });
    expect(file.data.transactions[0]).toMatchObject({ id: 't', receipt: 'u/r.jpg' });
    expect(file.data.transactions[0]).not.toHaveProperty('photo');
    expect(Object.keys(file.data)).toEqual(
      expect.arrayContaining([
        'accounts',
        'notes',
        'funds',
        'stocks',
        'employers',
        'payslips',
        'pfEntries',
        'portfolioSite',
      ]),
    );
    expect(exportFileName(new Date('2026-10-13T10:00:00Z'))).toBe(
      'ledgerly-export-2026-10-13.json',
    );
  });

  it('saves the file as JSON from Settings', async () => {
    await renderWithProviders(<ExportCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(saveTextFile).toHaveBeenCalled());
    const [text, name, type] = jest.mocked(saveTextFile).mock.calls[0];
    expect(JSON.parse(text).data.portfolioSite).toEqual({ profile: { headline: 'x' } });
    expect(name).toMatch(/^ledgerly-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(type).toBe('application/json');
    expect(await screen.findByText(/Export ready/)).toBeTruthy();
  });
});
