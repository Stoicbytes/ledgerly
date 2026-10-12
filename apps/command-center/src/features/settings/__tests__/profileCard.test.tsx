import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/sessionStore';
import { requestEmailChange, updateDisplayName } from '@/lib/data/authRepository';
import { renderWithProviders } from '@/test/render';
import { ProfileCard } from '../ProfileCard';

jest.mock('@/lib/data/authRepository', () => ({
  updateDisplayName: jest.fn(),
  requestEmailChange: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSession.getState().setSignedIn('old@example.com', null);
});

describe('ProfileCard', () => {
  it('saves the display name', async () => {
    jest.mocked(updateDisplayName).mockResolvedValue({ ok: true });
    await renderWithProviders(<ProfileCard index={0} />);
    await fireEvent.changeText(screen.getByLabelText('Display name'), 'Arjun');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    expect(updateDisplayName).toHaveBeenCalledWith('Arjun');
    expect(screen.getByText('Name saved.')).toBeTruthy();
  });

  it('starts an email change and explains the confirmation', async () => {
    jest.mocked(requestEmailChange).mockResolvedValue({ ok: true });
    await renderWithProviders(<ProfileCard index={0} />);
    expect(screen.getByRole('button', { name: 'Change email' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('New sign-in email'), 'new@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Change email' }));
    expect(requestEmailChange).toHaveBeenCalledWith('new@example.com');
    expect(screen.getByText(/Check new@example.com .* old@example.com/)).toBeTruthy();
  });

  it('shows why an email change failed', async () => {
    jest
      .mocked(requestEmailChange)
      .mockResolvedValue({ ok: false, message: 'That email is already used by another account.' });
    await renderWithProviders(<ProfileCard index={0} />);
    await fireEvent.changeText(screen.getByLabelText('New sign-in email'), 'taken@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Change email' }));
    expect(screen.getByText('That email is already used by another account.')).toBeTruthy();
  });
});
