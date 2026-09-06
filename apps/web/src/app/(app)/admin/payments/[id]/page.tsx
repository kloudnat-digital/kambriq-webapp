import { PaymentDetailContent } from '@/components/payments-admin/payment-detail-content';
import { getPayment } from '@/lib/actions/payments';
import { auth } from '@/auth';

export const metadata = { title: 'Paiement' };

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [payment, session] = await Promise.all([getPayment(id), auth()]);

  // Validating is ADMIN_GLOBAL: it is the act that commits money. Recording is
  // ADMIN_LANDS. The screen reflects the same split the API enforces, so a
  // lands admin is not offered a control the API would refuse.
  const canValidate = (session?.user?.roles ?? []).includes('ADMIN_GLOBAL');

  return <PaymentDetailContent payment={payment} canValidate={canValidate} />;
}
