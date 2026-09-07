import { RequestQueueContent } from '@/components/payments-admin/request-queue-content';
import { listPaymentRequests } from '@/lib/actions/payments';

export const metadata = { title: 'Demandes de paiement' };

export default async function PaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const res = await listPaymentRequests(Number(page) || 1);

  return (
    <RequestQueueContent
      rows={res.data}
      total={res.meta.total}
      oldestWaitingDays={res.meta.oldestWaitingDays ?? 0}
    />
  );
}
