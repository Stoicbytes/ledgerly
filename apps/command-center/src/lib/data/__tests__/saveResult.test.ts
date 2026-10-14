import { saveChanges } from '../ledgerRepository';
import { callRpc, RpcError } from '../rpc';
import { parseSaveResult, versionsFromRemote } from '../saveResult';

jest.mock('../rpc', () => ({ ...jest.requireActual('../rpc'), callRpc: jest.fn() }));

describe('save results', () => {
  it('reads conflicts and the saved time of migration 0020', () => {
    expect(
      parseSaveResult({
        conflicts: [
          { list: 'accounts', id: 'a1', reason: 'deleted' },
          { list: 'nope', id: 'x' },
        ],
        saved_at: '2026-10-14T10:00:00.123456+00:00',
      }),
    ).toEqual({
      checked: true,
      conflicts: [{ list: 'accounts', id: 'a1', reason: 'deleted' }],
      savedAt: '2026-10-14T10:00:00.123456+00:00',
    });
    expect(parseSaveResult(null)).toEqual({ checked: false, conflicts: [], savedAt: null });
  });

  it('reads the version of each loaded row', () => {
    expect(
      versionsFromRemote({ accounts: [{ id: 'a1', updated_at: 'T1' }], notes: [{ id: 'n1' }] }),
    ).toMatchObject({ accounts: { a1: 'T1' }, notes: {} });
  });

  it('falls back to sync_ledger when migration 0020 is missing, and stays there', async () => {
    jest.mocked(callRpc).mockRejectedValueOnce(new RpcError(404, 'PGRST202'));
    jest.mocked(callRpc).mockResolvedValue(null);
    expect(await saveChanges({ accounts: [] })).toMatchObject({ checked: false });
    expect(jest.mocked(callRpc).mock.calls.map((call) => call[0])).toEqual([
      'sync_ledger_v2',
      'sync_ledger',
    ]);
    await saveChanges({ accounts: [] });
    expect(jest.mocked(callRpc).mock.calls.at(-1)?.[0]).toBe('sync_ledger');
  });
});
