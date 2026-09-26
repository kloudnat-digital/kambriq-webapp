jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/lands', () => ({
  requestPaymentAction: jest.fn(),
  setPreferredChannelAction: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { requestPaymentAction } from '@/lib/actions/lands';
import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';
import type { MyPayment } from '@/types/payments';
import { MyPaymentContent } from './my-payment-content';
import { RequestPaymentCard } from './request-payment-card';

/**
 * The two payment screens a customer reads, in the customer's language.
 *
 * Both were French only and on I43's hardcoded-copy debt list: an English
 * speaker paying a deposit read "Montant à régler", "Virement bancaire" and
 * "Titulaire du compte". Everything now comes from `myPayment`, the channel
 * names and coordinate labels included, and the English render is checked for
 * any French string of that namespace.
 */
const leaves = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [];
/** French strings that differ from their English counterpart (brand names read the same). */
const FRENCH_ONLY = leaves(fr.myPayment).filter((s) => !leaves(en.myPayment).includes(s));

const PAID_BY_TRANSFER = {
  reference: 'KBQ-2609-ABCDE-7',
  subject: 'Acompte',
  amountDue: '750000',
  amountReceived: '0',
  currency: 'XAF',
  expiresAt: '2026-10-06T00:00:00Z',
  preferredChannel: 'OMO',
  channel: 'VIR',
  coordinates: { bankName: 'DEV-BANQUE', bankIban: 'DEV-COMPTE-FICTIF-NE-PAS-UTILISER' },
  sentAt: '2026-09-26T08:00:00Z',
  waitingReason: null,
} as unknown as MyPayment;

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RequestPaymentCard reservationId="r1" amountDue={750000} />
    </QueryClientProvider>,
  );

describe.each([
  ['fr', fr],
  ['en', en],
] as const)('the client payment screens (%s)', (locale, messages) => {
  beforeEach(() => setTestLocale(locale));

  it('the payment screen: labels, channel names and coordinate labels in the reader’s language', () => {
    const { container } = render(<MyPaymentContent payment={PAID_BY_TRANSFER} />);
    const text = container.textContent ?? '';
    expect(text).toContain(messages.myPayment.amountDue);
    expect(text).toContain(messages.myPayment.channels.VIR);
    expect(text).toContain(messages.myPayment.fields.bankName);
    expect(screen.getByTestId('coordinates')).toHaveTextContent(
      'DEV-COMPTE-FICTIF-NE-PAS-UTILISER',
    );
    if (locale === 'en') for (const s of FRENCH_ONLY) expect(text).not.toContain(s);
  });

  it('the payment screen while it waits for identity', () => {
    const { container } = render(
      <MyPaymentContent
        payment={
          {
            ...PAID_BY_TRANSFER,
            channel: null,
            coordinates: null,
            waitingReason: 'identity',
          } as MyPayment
        }
      />,
    );
    expect(screen.getByTestId('waiting')).toHaveTextContent(messages.myPayment.waitingIdentity);
    if (locale === 'en')
      for (const s of FRENCH_ONLY) expect(container.textContent).not.toContain(s);
  });

  it('the request card, before and after a reference is issued', async () => {
    (requestPaymentAction as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 'p1', reference: 'KBQ-2609-ABCDE-7', amountDue: '750000', currency: 'XAF' },
    });
    const user = userEvent.setup();
    const { container } = renderCard();
    expect(container).toHaveTextContent(messages.myPayment.request.notOnline);

    await user.click(screen.getByRole('button', { name: messages.myPayment.request.create }));
    expect(await screen.findByText(messages.myPayment.request.recorded)).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: messages.myPayment.channels.OMO }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: messages.myPayment.request.follow })).toHaveAttribute(
      'href',
      '/mylands/payment/p1',
    );
    if (locale === 'en')
      for (const s of FRENCH_ONLY) expect(container.textContent).not.toContain(s);
  });
});
