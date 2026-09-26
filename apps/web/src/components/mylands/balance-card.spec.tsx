jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/lands', () => ({
  requestPaymentAction: jest.fn(),
  setPreferredChannelAction: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { RequestPaymentCard } from './request-payment-card';

const card = (amountDue: number, expected: number) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RequestPaymentCard
        reservationId="res-1"
        purpose="SOLDE"
        amountDue={amountDue}
        expected={expected}
      />
    </QueryClientProvider>,
  );

/**
 * G20 - the balance card says what is actually owed, and when a short deposit
 * made that differ from the balance announced at reservation, it says both.
 */
describe('G20 - the balance card', () => {
  beforeEach(() => setTestLocale('en'));

  it('is the balance, not the deposit', () => {
    card(3_230_000, 3_230_000);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Pay the balance');
  });

  it('says nothing more when what is owed is what was announced', () => {
    card(3_230_000, 3_230_000);
    expect(screen.queryByText(/announced at reservation/)).toBeNull();
  });

  it('shows the announced balance beside a larger owed one after a short deposit', () => {
    card(3_240_000, 3_230_000);
    expect(screen.getByText(/The balance announced at reservation was/)).toBeInTheDocument();
  });
});
