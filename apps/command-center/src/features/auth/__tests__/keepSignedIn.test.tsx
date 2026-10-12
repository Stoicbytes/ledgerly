import { fireEvent, screen } from '@testing-library/react-native';
import { setKeptSignedIn } from '@/lib/data/authStorage';
import { useDevicePrefs } from '@/state/devicePrefs';
import { renderWithProviders } from '@/test/render';
import { KeepSignedInCheck } from '../KeepSignedInCheck';

let mockKept = false;
jest.mock('@/lib/data/authStorage', () => ({
  canChooseKeepSignedIn: true,
  isKeptSignedIn: () => mockKept,
  setKeptSignedIn: jest.fn((keep: boolean) => {
    mockKept = keep;
  }),
}));

describe('KeepSignedInCheck', () => {
  it('is off by default and switches where the session lives', async () => {
    useDevicePrefs.setState({ keepSignedIn: false });
    await renderWithProviders(<KeepSignedInCheck />);
    const name = 'Keep me signed in on this device';
    await fireEvent.press(screen.getByRole('checkbox', { name, checked: false }));
    expect(setKeptSignedIn).toHaveBeenCalledWith(true);
    expect(useDevicePrefs.getState().keepSignedIn).toBe(true);
    expect(screen.getByRole('checkbox', { name, checked: true })).toBeTruthy();
  });
});
