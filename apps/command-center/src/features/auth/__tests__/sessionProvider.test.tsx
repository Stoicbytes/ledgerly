import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { currentSession, onAuthChange } from '@/lib/data/authRepository';
import { needsSecondStep } from '@/lib/data/mfaRepository';
import { SessionProvider } from '../SessionProvider';
import { useSession } from '../sessionStore';

jest.mock('@/lib/data/supabaseClient', () => ({ isSupabaseConfigured: () => true }));
jest.mock('@/lib/data/authRepository', () => ({
  displayNameOf: jest.requireActual('@/lib/data/authRepository').displayNameOf,
  currentSession: jest.fn(),
  onAuthChange: jest.fn(),
  setAutoRefresh: jest.fn(),
}));
jest.mock('@/lib/data/mfaRepository', () => ({ needsSecondStep: jest.fn() }));

type Listener = (event: string, session: { user: { email: string } } | null) => void;
let listener: Listener = () => undefined;
const session = { user: { email: 'me@example.com' } };

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'loading', email: null, recovery: false });
  jest.mocked(onAuthChange).mockImplementation((next) => {
    listener = next as unknown as Listener;
    return () => undefined;
  });
});

const mount = () =>
  render(
    <SessionProvider>
      <Text>app</Text>
    </SessionProvider>,
  );

describe('SessionProvider', () => {
  it('keeps the dashboard closed until the second step is done', async () => {
    jest.mocked(currentSession).mockResolvedValue(session as never);
    jest.mocked(needsSecondStep).mockResolvedValue(true);
    await mount();
    await waitFor(() => expect(useSession.getState().status).toBe('needsCode'));
    // The verified code upgrades the session; the listener then reports it.
    jest.mocked(needsSecondStep).mockResolvedValue(false);
    await act(async () => listener('MFA_CHALLENGE_VERIFIED', session));
    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
  });

  it('a sign-out wins over a slower level check that started before it', async () => {
    jest.mocked(currentSession).mockResolvedValue(null);
    let finish: (value: boolean) => void = () => undefined;
    jest.mocked(needsSecondStep).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await mount();
    await act(async () => listener('SIGNED_IN', session));
    await act(async () => listener('SIGNED_OUT', null));
    await act(async () => finish(false));
    expect(useSession.getState().status).toBe('signedOut');
  });
});
