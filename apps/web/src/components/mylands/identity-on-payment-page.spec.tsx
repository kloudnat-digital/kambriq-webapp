jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/identity', () => ({
  getIdUploadUrl: jest.fn(),
  submitIdDocuments: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { getIdUploadUrl, submitIdDocuments } from '@/lib/actions/identity';
import type { MyPayment } from '@/types/payments';
import { MyPaymentContent } from './my-payment-content';

/**
 * I47 - a payment waiting on the buyer's identity asks for the document on
 * the payment page itself, and sends it through the same identity endpoints the
 * KBS enrolment uses (a storage key, never an address).
 */
const waiting = (identityStatus: MyPayment['identityStatus']) =>
  ({
    reference: 'KBQ-2609-ABCDE-7',
    subject: 'Acompte',
    amountDue: '750000',
    amountReceived: '0',
    currency: 'XAF',
    expiresAt: null,
    preferredChannel: null,
    channel: null,
    coordinates: null,
    sentAt: null,
    identityStatus,
    waitingReason: 'identity',
  }) as unknown as MyPayment;

const renderPage = (payment: MyPayment) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MyPaymentContent payment={payment} />
    </QueryClientProvider>,
  );

describe('I47 - the identity document, asked for on the payment page', () => {
  beforeEach(() => {
    setTestLocale('en');
    jest.mocked(getIdUploadUrl).mockReset();
    jest.mocked(submitIdDocuments).mockReset();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
  });

  it('offers the upload when no document has been sent, and sends the storage key', async () => {
    jest.mocked(getIdUploadUrl).mockResolvedValue({
      success: true,
      data: { uploadUrl: 'https://s3.example/put', fileUrl: 'users/u1/id/cni.pdf' },
    });
    jest.mocked(submitIdDocuments).mockResolvedValue({ success: true, data: {} } as never);
    renderPage(waiting('none'));

    const file = new File(['%PDF'], 'cni.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('identity-file'), file);

    await waitFor(() => expect(submitIdDocuments).toHaveBeenCalledWith(['users/u1/id/cni.pdf']));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://s3.example/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(await screen.findByTestId('identity-sent')).toBeInTheDocument();
  });

  it('says the document is being checked once it has been sent', () => {
    renderPage(waiting('pending'));
    expect(screen.getByTestId('identity-sent')).toBeInTheDocument();
    expect(screen.queryByTestId('identity-file')).toBeNull();
  });

  it('asks again when the document was refused', () => {
    renderPage(waiting('rejected'));
    expect(screen.getByTestId('identity-file')).toBeInTheDocument();
    expect(screen.getByTestId('identity-rejected')).toBeInTheDocument();
  });

  it('no longer sends the buyer to a profile that has no such control', () => {
    renderPage(waiting('none'));
    expect(screen.getByTestId('waiting')).not.toHaveTextContent(/profile|profil/i);
  });
});
