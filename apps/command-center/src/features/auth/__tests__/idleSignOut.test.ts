import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { useDevicePrefs } from '@/state/devicePrefs';
import { useIdleSignOut } from '../useIdleSignOut';
import { useSession } from '../sessionStore';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => '/expenses',
  Link: () => null,
}));
jest.mock('@/lib/data/authRepository', () => ({ signOut: jest.fn() }));
jest.mock('@/features/sync/cloudSync', () => ({ flushCloudSync: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  useDevicePrefs.setState({ idleChoice: '15', keepSignedIn: false });
});
afterEach(() => jest.useRealTimers());

describe('idle sign-out', () => {
  it('waits while a change is unsaved, keeps trying, and signs out once saved', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(false);
    const hook = await renderHook(() => useIdleSignOut());
    await act(() => jest.advanceTimersByTimeAsync(15 * 60_000 + 15_000));
    expect(signOut).not.toHaveBeenCalled();
    expect(hook.result.current.unsaved).toBe(true);
    expect(useSession.getState().status).toBe('signedIn');
    const tries = jest.mocked(flushCloudSync).mock.calls.length;
    jest.mocked(flushCloudSync).mockResolvedValue(true);
    await act(() => jest.advanceTimersByTimeAsync(15_000));
    expect(jest.mocked(flushCloudSync).mock.calls.length).toBeGreaterThan(tries);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { reason: 'idle', redirect: '/expenses' },
    });
  });
});
