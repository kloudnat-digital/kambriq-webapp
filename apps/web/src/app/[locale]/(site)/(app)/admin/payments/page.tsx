import { PaymentsListContent } from '@/components/payments-admin/payments-list-content';
import { listPayments } from '@/lib/actions/payments';

export const metadata = { title: 'Paiements' };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const res = await listPayments(Number(page) || 1);
  return <PaymentsListContent rows={res.data} meta={res.meta} />;
}
