import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useSession } from '@/features/auth/sessionStore';
import { discardUnsavedChanges, flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { renderWithProviders } from '@/test/render';
import { AccountCard } from '../AccountCard';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/data/authRepository', () => ({ signOut: jest.fn() }));
jest.mock('@/features/sync/cloudSync', () => ({
  flushCloudSync: jest.fn(),
  discardUnsavedChanges: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  jest.mocked(flushCloudSync).mockResolvedValue(true);
});

describe('AccountCard sign-out', () => {
  it('sends waiting changes, then signs out', async () => {
    await renderWithProviders(<AccountCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(flushCloudSync).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
    expect(discardUnsavedChanges).not.toHaveBeenCalled();
  });

  it('asks before losing changes that could not be sent', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(false);
    await renderWithProviders(<AccountCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByText('Some changes are not saved yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out anyway' }));
    expect(discardUnsavedChanges).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });
});
