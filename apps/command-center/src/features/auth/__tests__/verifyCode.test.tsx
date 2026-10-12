import { act, fireEvent, screen } from '@testing-library/react-native';
import { signOut } from '@/lib/data/authRepository';
import { verifySignInCode } from '@/lib/data/mfaRepository';
import { renderWithProviders } from '@/test/render';
import { useSession } from '../sessionStore';
import { VerifyCodeScreen } from '../VerifyCodeScreen';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/lib/data/authRepository', () => ({ signOut: jest.fn() }));
jest.mock('@/lib/data/mfaRepository', () => ({ verifySignInCode: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  useSession.setState({ status: 'needsCode', email: 'me@example.com', recovery: false });
});

describe('VerifyCodeScreen', () => {
  it('checks the format before calling Supabase', async () => {
    await renderWithProviders(<VerifyCodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '12a456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeTruthy();
    expect(verifySignInCode).not.toHaveBeenCalled();
  });

  it('verifies the code (spaces allowed) and then opens the safe target', async () => {
    mockParams = { redirect: '/dashboard/notes' };
    jest.mocked(verifySignInCode).mockResolvedValue({ ok: true });
    await renderWithProviders(<VerifyCodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123 456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(verifySignInCode).toHaveBeenCalledWith('123456');
    await act(() => useSession.getState().setSignedIn('me@example.com'));
    expect(screen.getByText('redirect:/dashboard/notes')).toBeTruthy();
  });

  it('shows the error and clears the code when it is wrong', async () => {
    jest
      .mocked(verifySignInCode)
      .mockResolvedValue({ ok: false, message: 'That code did not work.' });
    await renderWithProviders(<VerifyCodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '000000');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText('That code did not work.')).toBeTruthy();
    expect(screen.getByLabelText('6-digit code').props.value).toBe('');
  });

  it('ignores an unsafe redirect and returns a reset link to the reset form', async () => {
    useSession.setState({ status: 'signedIn' });
    mockParams = { redirect: '//evil.example' };
    const first = await renderWithProviders(<VerifyCodeScreen />);
    expect(screen.getByText('redirect:/dashboard')).toBeTruthy();
    await first.unmount();
    mockParams = { then: 'reset' };
    await renderWithProviders(<VerifyCodeScreen />);
    expect(screen.getByText('redirect:/reset-password')).toBeTruthy();
  });

  it('sends a signed-out visitor to sign in, and can switch account', async () => {
    await renderWithProviders(<VerifyCodeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different account' }));
    expect(signOut).toHaveBeenCalled();
    expect(screen.getByText('redirect:/sign-in')).toBeTruthy();
  });
});
