jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));

import { render, screen } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import KamnetApplyPage from './page';

/**
 * P5, the floor - the KAMNET application page never says an application was
 * received unless one was.
 *
 * It rendered a form whose submit waited 800 ms and toasted "Candidature
 * soumise !", and whose "Brouillon" button toasted "Brouillon sauvegardé".
 * Nothing was sent or stored. Recruiting is live, so every submission was a
 * real person told they had applied.
 *
 * Until the page is wired to the API, it says applications are not open online
 * and sends people to the contact form, whose KAMNET subject is stored and
 * notified (L1).
 */
const renderPage = async () => render(<KamnetApplyPage />);

describe.each(['fr', 'en'] as const)('P5 - /kamnet/apply (%s)', (locale) => {
  beforeEach(() => setTestLocale(locale));

  it('offers no form that could pretend to submit', async () => {
    const { container } = await renderPage();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('button', { name: /soumettre|submit|brouillon|draft/i })).toBeNull();
  });

  it('points to a real way to reach KAMBRIQ', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact');
  });
});
