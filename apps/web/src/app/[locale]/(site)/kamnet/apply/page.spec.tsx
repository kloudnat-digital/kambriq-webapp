jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => ({
  ...jest.requireActual('@/test-utils/navigation-mock'),
  useRouter: () => ({ refresh: mockRefresh }),
}));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/actions/kamnet', () => ({
  getMyApplicationStanding: jest.fn(),
  submitKamnetApplication: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { getMyApplicationStanding, submitKamnetApplication } from '@/lib/actions/kamnet';
import KamnetApplyPage from './page';

const mockRefresh = jest.fn();
const standing = getMyApplicationStanding as jest.Mock;
const submit = submitKamnetApplication as jest.Mock;

/**
 * P5 - `/kamnet/apply` says only what is true.
 *
 * It was a mock that toasted "Candidature soumise !" and stored nothing. Now it
 * renders one of four states read from the API, and the form never claims
 * success itself: a stored application re-renders the page from the API, and a
 * refusal is shown where it happened. The form asks for no name, email, phone
 * or address - the account already has them - and never for the KCA number,
 * which the server reads from the applicant's own certificate.
 */
const renderPage = async () => render(await KamnetApplyPage());
const MOTIVATION = 'Je veux accompagner des acheteurs de la diaspora, avec méthode et honnêteté.';

describe.each(['fr', 'en'] as const)('P5 - /kamnet/apply (%s)', (locale) => {
  beforeEach(() => {
    setTestLocale(locale);
    jest.clearAllMocks();
  });

  it('without a certificate: no form, a way to get one, and a way to write to us', async () => {
    standing.mockResolvedValue({ success: true, data: { state: 'not-certified' } });
    const { container } = await renderPage();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.getByRole('link', { name: /KBS/ })).toHaveAttribute('href', '/products/kbs');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
  });

  it('when the standing cannot be read: says so, and does not say "not certified"', async () => {
    standing.mockResolvedValue({ success: false, error: 'down' });
    const { container } = await renderPage();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('link', { name: /KBS/ })).toBeNull();
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument();
  });

  it('with an application: its real status, from the API, and no form', async () => {
    standing.mockResolvedValue({
      success: true,
      data: {
        state: 'applied',
        application: { id: 'a1', status: 'PENDING', createdAt: '2026-09-26T08:00:00Z' },
      },
    });
    const { container } = await renderPage();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.getByTestId('kamnet-application-status')).toHaveTextContent(
      locale === 'fr' ? 'en attente de revue' : 'awaiting review',
    );
  });

  it('when they may apply: a form asking only for a sponsor code and a motivation', async () => {
    standing.mockResolvedValue({
      success: true,
      data: { state: 'can-apply', kcaNumber: 'KCA-20250101-0001' },
    });
    const { container } = await renderPage();
    const inputs = [...container.querySelectorAll('input, textarea')].map((e) =>
      e.getAttribute('name'),
    );
    expect(inputs).toEqual(['sponsorCode', 'motivation']);
    expect(container).toHaveTextContent('KCA-20250101-0001');
  });

  it('submits to the API and claims nothing itself: success refreshes, a refusal is shown', async () => {
    standing.mockResolvedValue({
      success: true,
      data: { state: 'can-apply', kcaNumber: 'KCA-20250101-0001' },
    });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText(/motivation/i), MOTIVATION);

    submit.mockResolvedValueOnce({ success: false, error: 'Parrain introuvable' });
    await user.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Parrain introuvable');
    expect(mockRefresh).not.toHaveBeenCalled();

    submit.mockResolvedValueOnce({ success: true, data: { id: 'a1', status: 'PENDING' } });
    await user.click(screen.getByRole('button'));
    expect(submit).toHaveBeenLastCalledWith({ sponsorCode: '', motivation: MOTIVATION });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/soumise|submitted/i)).toBeNull();
  });
});
