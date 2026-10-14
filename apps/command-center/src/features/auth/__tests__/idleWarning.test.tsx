import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/sessionStore';
import { discardUnsavedChanges, flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { renderWithProviders } from '@/test/render';
import { IdleWarning } from '../IdleWarning';

jest.mock('@/lib/data/authRepository', () => ({ signOut: jest.fn() }));
jest.mock('@/features/sync/cloudSync', () => ({
  flushCloudSync: jest.fn(),
  discardUnsavedChanges: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
});

describe('IdleWarning', () => {
  it('signs out now only once everything is saved', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(false);
    await renderWithProviders(<IdleWarning visible unsaved={false} onStay={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out now' }));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByText('Some changes are not saved yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out anyway' }));
    expect(discardUnsavedChanges).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it('stays up while an idle sign-out waits for an unsaved change', async () => {
    const onStay = jest.fn();
    await renderWithProviders(<IdleWarning visible={false} unsaved onStay={onStay} />);
    expect(screen.getByText('Some changes are not saved yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(onStay).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
