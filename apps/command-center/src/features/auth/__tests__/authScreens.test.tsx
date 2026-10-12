import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderWithProviders } from '@/test/render';
import {
  requestPasswordReset,
  signInWithPassword,
  updatePassword,
} from '@/lib/data/authRepository';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { ResetPasswordScreen } from '../ResetPasswordScreen';
import { SignInScreen } from '../SignInScreen';
import { useSession } from '../sessionStore';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string | { pathname: string; params: object } }) => {
    const { Text } = jest.requireActual('react-native');
    const target =
      typeof href === 'string' ? href : `${href.pathname}?${JSON.stringify(href.params)}`;
    return <Text>{`redirect:${target}`}</Text>;
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/data/authRepository', () => ({
  signInWithPassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  updatePassword: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  useSession.setState({ status: 'signedOut', email: null, recovery: false });
});

describe('SignInScreen', () => {
  it('signs in and goes to the safe redirect target', async () => {
    mockParams = { redirect: '/dashboard/expenses' };
    jest.mocked(signInWithPassword).mockResolvedValue({ ok: true });
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(signInWithPassword).toHaveBeenCalledWith('me@example.com', 'correct horse');
    // The session listener marks the user signed in; the screen then redirects.
    await act(() => useSession.getState().setSignedIn('me@example.com'));
    expect(screen.getByText('redirect:/dashboard/expenses')).toBeTruthy();
  });

  it('asks for the 6-digit code when two-step sign-in is on', async () => {
    mockParams = { redirect: '/dashboard/notes' };
    useSession.setState({ status: 'needsCode', email: 'me@example.com' });
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('redirect:/verify-code?{"redirect":"/dashboard/notes"}')).toBeTruthy();
  });

  it('explains an idle sign-out', async () => {
    mockParams = { reason: 'idle' };
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('You were signed out after a period without activity.')).toBeTruthy();
  });

  it('ignores an unsafe redirect', async () => {
    mockParams = { redirect: 'https://evil.example' };
    jest.mocked(signInWithPassword).mockResolvedValue({ ok: true });
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await act(() => useSession.getState().setSignedIn('me@example.com'));
    expect(screen.getByText('redirect:/dashboard')).toBeTruthy();
  });

  it('shows the generic error and clears the password on failure', async () => {
    jest
      .mocked(signInWithPassword)
      .mockResolvedValue({ ok: false, message: 'That email and password do not match.' });
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('That email and password do not match.')).toBeTruthy();
    expect(screen.getByLabelText('Password').props.value).toBe('');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('asks for both fields before calling Supabase', async () => {
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('explains preview mode when no project is configured', async () => {
    useSession.setState({ status: 'preview' });
    await renderWithProviders(<SignInScreen />);
    expect(screen.getByText('Sign-in is not set up')).toBeTruthy();
  });
});

describe('ForgotPasswordScreen', () => {
  it('gives the same reply whether or not the account exists', async () => {
    jest.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'anyone@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText(/If an account exists for that email/)).toBeTruthy();
  });
});

describe('ResetPasswordScreen', () => {
  it('refuses to show the form without a recovery session', async () => {
    await renderWithProviders(<ResetPasswordScreen />);
    expect(screen.getByText('Link not valid')).toBeTruthy();
  });

  it('checks length and match, then saves the new password', async () => {
    useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: true });
    jest.mocked(updatePassword).mockResolvedValue({ ok: true });
    await renderWithProviders(<ResetPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('New password'), 'a long passphrase');
    await fireEvent.changeText(screen.getByLabelText('Repeat new password'), 'a long passphrase');
    await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
    expect(updatePassword).toHaveBeenCalledWith('a long passphrase');
    expect(router.replace).toHaveBeenCalledWith('/dashboard');
    expect(useSession.getState().recovery).toBe(false);
  });
});
