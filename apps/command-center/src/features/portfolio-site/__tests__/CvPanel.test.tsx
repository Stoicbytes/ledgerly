import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/sessionStore';
import { renderWithProviders } from '@/test/render';
import { PortfolioSiteScreen } from '../PortfolioSiteScreen';
import { useSiteStore } from '../state/siteStore';

beforeEach(() => {
  useSiteStore.getState().reset();
  useSession.setState({ status: 'preview', email: null, recovery: false });
});

describe('Portfolio → CV', () => {
  it('scores the CV, updates with the phone and a job description, and keeps both local', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await screen.findByText(/Sample content: sign in/);
    await fireEvent.press(screen.getByRole('button', { name: 'CV' }));
    expect(screen.getByText('ATS readiness')).toBeTruthy();
    expect(screen.getByText('Phone number')).toBeTruthy();
    expect(screen.getByText('Type it above; it is not saved.')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('Phone (only on this CV, not saved)'),
      '+91 90000 11111',
    );
    expect(screen.queryByText('Type it above; it is not saved.')).toBeNull();

    await fireEvent.changeText(
      screen.getByLabelText('Job description (optional)'),
      'Looking for Java and Kubernetes skills. Kubernetes in production, Java daily.',
    );
    expect(screen.getByText(/^Job keywords found: \d+%$/)).toBeTruthy();
    expect(screen.getByText(/Missing from your CV: .*kubernetes/)).toBeTruthy();
    // Neither the phone nor the job description goes into the portfolio.
    expect(JSON.stringify(useSiteStore.getState().profile)).not.toContain('90000');
  });

  it('says downloads need the web app on phones', async () => {
    await renderWithProviders(<PortfolioSiteScreen />);
    await screen.findByText(/Sample content: sign in/);
    await fireEvent.press(screen.getByRole('button', { name: 'CV' }));
    expect(screen.getByText('Downloading the CV works in the web app for now.')).toBeTruthy();
  });
});
