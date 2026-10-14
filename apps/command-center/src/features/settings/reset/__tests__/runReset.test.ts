import { flushCloudSync, hasUnsavedChanges, reloadCloudData } from '@/features/sync/cloudSync';
import { resetData } from '@/lib/data/resetRepository';
import { RpcError } from '@/lib/data/rpc';
import { resetErrorMessage, runReset } from '../runReset';
import type { ResetOption } from '../resetScopes';

jest.mock('@/features/sync/cloudSync', () => ({
  flushCloudSync: jest.fn(),
  hasUnsavedChanges: jest.fn(),
  reloadCloudData: jest.fn(),
}));
jest.mock('@/lib/data/resetRepository', () => ({
  ...jest.requireActual('@/lib/data/resetRepository'),
  resetData: jest.fn(),
}));

const option = {
  title: 'Stocks',
  scope: 'stocks',
  clearLocally: jest.fn(),
} as unknown as ResetOption;

describe('reset messages', () => {
  it('says nothing was deleted only when the database refused', () => {
    expect(resetErrorMessage(new RpcError(400, '22023'))).toMatch(/Nothing was deleted/);
    expect(resetErrorMessage(new RpcError(403, '42501'))).toMatch(/Nothing was deleted/);
  });

  it('says the outcome is unknown after a timeout or lost connection', () => {
    for (const error of [
      new RpcError(0, 'timeout'),
      new RpcError(0, 'network'),
      new RpcError(504),
    ]) {
      expect(resetErrorMessage(error)).toBe(
        "We couldn't confirm the reset; reload to see your data.",
      );
    }
  });

  it('reports a reset that went through even when loading again fails', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(true);
    jest.mocked(hasUnsavedChanges).mockReturnValue(false);
    jest.mocked(resetData).mockResolvedValue({ stocks: 2 });
    jest.mocked(reloadCloudData).mockRejectedValue(new RpcError(0, 'network'));
    expect(await runReset(option, true)).toBe(
      'Stocks reset: 2 items deleted. Reload to see your data.',
    );
  });
});
