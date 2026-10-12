import { fireEvent, screen } from '@testing-library/react-native';
import {
  listTotpFactors,
  removeFactor,
  signOutOtherDevices,
  startTotpEnrollment,
  verifyTotp,
} from '@/lib/data/mfaRepository';
import { renderWithProviders } from '@/test/render';
import { SecurityCard } from '../SecurityCard';
import { groupSecret } from '../TotpSetup';

jest.mock('@/lib/data/mfaRepository', () => ({
  listTotpFactors: jest.fn(),
  removeFactor: jest.fn(),
  signOutOtherDevices: jest.fn(),
  startTotpEnrollment: jest.fn(),
  verifyTotp: jest.fn(),
}));
jest.mock('@/lib/data/authRepository', () => ({ signOut: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('SecurityCard', () => {
  it('sets up two-step sign-in: QR, key, then the first code', async () => {
    jest.mocked(listTotpFactors).mockResolvedValue([]);
    jest.mocked(startTotpEnrollment).mockResolvedValue({
      ok: true,
      enrollment: { factorId: 'f1', qrSvg: '<svg viewBox="0 0 1 1"/>', secret: 'ABCDEFGHIJKL' },
    });
    jest.mocked(verifyTotp).mockResolvedValue({ ok: true });
    await renderWithProviders(<SecurityCard index={0} />);
    expect(await screen.findByText('Off')).toBeTruthy();
    jest.mocked(listTotpFactors).mockResolvedValue([{ id: 'f1', name: 'Phone', verified: true }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));
    expect(await screen.findByLabelText('QR code for your authenticator app')).toBeTruthy();
    expect(screen.getByText('ABCD EFGH IJKL')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on' }));
    expect(verifyTotp).toHaveBeenCalledWith('f1', '123456');
    expect(await screen.findByText('On')).toBeTruthy();
    expect(screen.getByText('Two-step sign-in is on. Other devices were signed out.')).toBeTruthy();
  });

  it('cancelling set-up removes the unfinished factor', async () => {
    jest.mocked(listTotpFactors).mockResolvedValue([]);
    jest.mocked(startTotpEnrollment).mockResolvedValue({
      ok: true,
      enrollment: { factorId: 'f2', qrSvg: '<svg/>', secret: 'ABCD' },
    });
    jest.mocked(removeFactor).mockResolvedValue({ ok: true });
    await renderWithProviders(<SecurityCard index={0} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Set up' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(removeFactor).toHaveBeenCalledWith('f2');
  });

  it('turns two-step sign-in off after confirming', async () => {
    jest.mocked(listTotpFactors).mockResolvedValue([{ id: 'f1', name: 'Phone', verified: true }]);
    jest.mocked(removeFactor).mockResolvedValue({ ok: true });
    await renderWithProviders(<SecurityCard index={0} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn off' }));
    const buttons = screen.getAllByRole('button', { name: 'Turn off' });
    await fireEvent.press(buttons[buttons.length - 1]);
    expect(removeFactor).toHaveBeenCalledWith('f1');
  });

  it('signs out other devices', async () => {
    jest.mocked(listTotpFactors).mockResolvedValue([]);
    jest.mocked(signOutOtherDevices).mockResolvedValue({ ok: true });
    await renderWithProviders(<SecurityCard index={0} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out other devices' }));
    expect(signOutOtherDevices).toHaveBeenCalled();
    expect(screen.getByText(/Other browsers and phones are signed out/)).toBeTruthy();
  });

  it('groups the setup key in fours', () => {
    expect(groupSecret('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  });
});
