import { screen } from '@testing-library/react-native';
import { useSyncStatus } from '@/features/sync/syncStatus';
import { renderWithProviders } from '@/test/render';
import { SampleDataBadge } from '../SampleDataBadge';

describe('SampleDataBadge', () => {
  it('labels sample data in preview', async () => {
    useSyncStatus.getState().set('off');
    await renderWithProviders(<SampleDataBadge />);
    expect(screen.getByText(/design preview/)).toBeTruthy();
  });

  it('shows nothing on a read-only screen with the user’s own data', async () => {
    useSyncStatus.getState().set('saved');
    await renderWithProviders(<SampleDataBadge />);
    expect(screen.queryByText(/design preview/)).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('shows the save state on an editable screen with the user’s own data', async () => {
    useSyncStatus.getState().set('expired');
    await renderWithProviders(<SampleDataBadge editable />);
    expect(screen.getByText('Signed out — sign in again to save')).toBeTruthy();
  });
});
