import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { SyncNotices } from '../SyncNotices';
import { useSyncStatus } from '../syncStatus';

describe('SyncNotices', () => {
  it('shows each notice until it is dismissed', async () => {
    useSyncStatus.setState({ notices: [] });
    useSyncStatus.getState().notify('warning', '1 change could not be saved: note — not allowed');
    await renderWithProviders(<SyncNotices />);
    expect(screen.getByText('1 change could not be saved: note — not allowed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Dismiss/ }));
    expect(screen.queryByText(/could not be saved/)).toBeNull();
  });
});
