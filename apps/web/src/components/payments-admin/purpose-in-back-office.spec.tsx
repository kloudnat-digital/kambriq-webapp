jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/payments', () => ({}));

import { render, screen, within } from '@testing-library/react';
import { PaymentsListContent } from './payments-list-content';
import { PaymentDetailContent } from './payment-detail-content';
import { RequestQueueContent } from './request-queue-content';
import type { PaymentDetail, PaymentRequestRow, PaymentRow } from '@/types/payments';

const row = (purpose: PaymentRow['purpose'], id: string): PaymentRow => ({
  id,
  reference: `KBQ-${id}`,
  reservationId: 'res-1',
  purpose,
  state: 'INITIE',
  currency: 'XAF',
  amountDue: '3230000',
  amountReceived: '0',
  outstanding: '3230000',
  expiresAt: null,
  createdAt: '2026-09-20T00:00:00Z',
});

const lineOf = (reference: string) => screen.getByText(reference).closest('tr') as HTMLElement;

/**
 * G20 - two payments of one reservation, a deposit and a balance, used to look
 * identical in the back office. Every screen where a person decides on a
 * payment now says which one it is.
 */
describe('G20 - the back office says deposit or balance', () => {
  it('on the payment list, row by row', () => {
    render(
      <PaymentsListContent
        rows={[row('ACOMPTE', 'a'), row('SOLDE', 'b')]}
        meta={{ total: 2, totalPages: 1, page: 1, limit: 20 }}
      />,
    );
    expect(within(lineOf('KBQ-a')).getByText('Acompte')).toBeInTheDocument();
    expect(within(lineOf('KBQ-b')).getByText('Solde')).toBeInTheDocument();
  });

  it('on the payment detail, beside its state', () => {
    const detail: PaymentDetail = {
      ...row('SOLDE', 'b'),
      preferredChannel: null,
      channel: null,
      clientUserId: 'user-1',
      identityStatus: 'verified',
      receipts: [],
      transitions: [],
    };
    render(<PaymentDetailContent payment={detail} canValidate={false} />);
    expect(within(screen.getByRole('banner')).getByText('Solde')).toBeInTheDocument();
  });

  it('on the request queue', () => {
    const request: PaymentRequestRow = {
      id: 'b',
      reference: 'KBQ-b',
      purpose: 'SOLDE',
      clientName: 'A Client',
      clientUserId: 'user-1',
      subject: 'Lot 12',
      currency: 'XAF',
      amountDue: '3230000',
      preferredChannel: null,
      identityStatus: 'verified',
      blockedByIdentity: false,
      requestedAt: '2026-09-20T00:00:00Z',
      waitingDays: 6,
    };
    render(<RequestQueueContent rows={[request]} total={1} oldestWaitingDays={6} />);
    expect(within(lineOf('KBQ-b')).getByText('Solde')).toBeInTheDocument();
  });
});
