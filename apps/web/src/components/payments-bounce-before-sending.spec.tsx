jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/payments', () => ({ sendInstructions: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentDetailContent } from './payments-admin/payment-detail-content';
import type { EmailDeliveryIssue, PaymentDetail } from '@/types/payments';

const detail = (clientEmailDelivery: EmailDeliveryIssue | null): PaymentDetail => ({
  id: 'pay-1',
  reference: 'KBQ-2609-BOUNC-1',
  reservationId: 'res-1',
  purpose: 'ACOMPTE',
  state: 'INITIE',
  currency: 'XAF',
  amountDue: '380000',
  amountReceived: '0',
  outstanding: '380000',
  expiresAt: null,
  createdAt: '2026-09-28T00:00:00Z',
  preferredChannel: null,
  channel: null,
  clientUserId: 'user-1',
  identityStatus: 'verified',
  clientEmailDelivery,
  receipts: [],
  transitions: [],
});

const bounce = (type: string): EmailDeliveryIssue => ({
  kind: 'BOUNCE',
  type,
  subType: 'General',
  occurredAt: '2026-09-28T08:25:45.760Z',
});

const sendButton = () => screen.getByRole('button', { name: /Publier les coordonnées/ });

/** Choose a channel and give a reason: what every send needs, whatever the address. */
const fillTheSend = () => {
  fireEvent.change(screen.getByRole('combobox', { name: /Canal retenu/ }), {
    target: { value: 'VIR' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Client bancarisé/), {
    target: { value: 'Virement convenu au téléphone' },
  });
};

/**
 * C26 - the operator sees, where instructions are sent, that the client's mail
 * does not arrive, and confirms the client was told another way before a
 * permanent bounce or a complaint lets the send go.
 */
describe('C26 - a bounced address is seen before instructions are sent', () => {
  it('says nothing, and asks nothing more, when SES reported nothing', () => {
    render(<PaymentDetailContent payment={detail(null)} canValidate={false} />);
    fillTheSend();
    expect(screen.queryByTestId('email-undeliverable')).toBeNull();
    expect(screen.queryByTestId('email-uncertain')).toBeNull();
    expect(sendButton()).toBeEnabled();
  });

  it('shows a permanent bounce, with its date and type, and holds the send until the operator confirms', () => {
    render(<PaymentDetailContent payment={detail(bounce('Permanent'))} canValidate={false} />);
    const warning = screen.getByTestId('email-undeliverable');
    expect(warning).toHaveTextContent('rejetée définitivement depuis le 28 septembre 2026');
    expect(warning).toHaveTextContent('Permanent/General');
    expect(warning).toHaveTextContent('le délai de 30 jours démarrera quand même');

    fillTheSend();
    expect(sendButton()).toBeDisabled();
    fireEvent.click(screen.getByTestId('told-otherwise'));
    expect(sendButton()).toBeEnabled();
  });

  it('treats a complaint like a permanent bounce', () => {
    render(
      <PaymentDetailContent
        payment={detail({
          kind: 'COMPLAINT',
          type: 'abuse',
          subType: null,
          occurredAt: '2026-09-28T08:25:45.760Z',
        })}
        canValidate={false}
      />,
    );
    expect(screen.getByTestId('email-undeliverable')).toHaveTextContent('comme indésirables');
    fillTheSend();
    expect(sendButton()).toBeDisabled();
  });

  it('shows a transient bounce without holding the send', () => {
    render(<PaymentDetailContent payment={detail(bounce('Transient'))} canValidate={false} />);
    expect(screen.getByTestId('email-uncertain')).toHaveTextContent('refusé temporairement');
    expect(screen.queryByTestId('email-undeliverable')).toBeNull();
    fillTheSend();
    expect(sendButton()).toBeEnabled();
  });
});
