import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/sessionStore';
import { renderWithProviders } from '@/test/render';
import { PortfolioSiteScreen } from '../PortfolioSiteScreen';
import { useSiteStore } from '../state/siteStore';

beforeEach(() => {
  useSiteStore.getState().reset();
  useSession.setState({ status: 'preview', email: null, recovery: false });
});

const openTab = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('Portfolio editor (preview mode)', () => {
  it('shows sample content and cannot preview or publish it', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    expect(await screen.findByText(/Sample content: sign in/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByText('GitHub')).toBeTruthy();
  });

  it('adds a project whose page address follows its title', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await openTab('Projects');
    await fireEvent.press(screen.getByRole('button', { name: 'Add project' }));
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Rail Tracker 2');
    expect(screen.getByLabelText('Page address').props.value).toBe('rail-tracker-2');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Rail Tracker 2')).toBeTruthy();
    const added = useSiteStore.getState().rows.project.find((p) => p.slug === 'rail-tracker-2');
    expect(added).toMatchObject({ title: 'Rail Tracker 2', visible: true, repo_url: null });
  });

  it('refuses links that are not https', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await openTab('Projects');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Sample project' }));
    await fireEvent.changeText(screen.getByLabelText('Repository'), 'http://example.com/repo');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Use an https:// address.')).toBeTruthy();
    expect(useSiteStore.getState().rows.project[0]?.repo_url).toBeNull();
  });

  it('keeps an item as a draft and reorders the list', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await openTab('More');
    await fireEvent.press(screen.getByRole('button', { name: 'Hide 3+ Years building (draft)' }));
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(useSiteStore.getState().rows.fact.find((f) => f.id === 'f1')?.visible).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Move Design systems up' }));
    const order = Object.fromEntries(
      useSiteStore.getState().rows.fact.map((f) => [f.id, f.sort_order]),
    );
    expect(order).toEqual({ f1: 1, f2: 0 });
  });

  it('marks contact messages as read', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await openTab('Messages (1)');
    expect(screen.getByText('A sample message from the contact form.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark as read' }));
    expect(screen.getByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(useSiteStore.getState().messages[0]?.readAt).not.toBeNull();
  });
});
