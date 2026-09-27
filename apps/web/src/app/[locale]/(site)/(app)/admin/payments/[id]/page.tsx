import { RoleCode } from '@/lib/roles';
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

  // Validation is restricted to ADMIN_GLOBAL, while recording is restricted to ADMIN_LANDS.
  // The UI reflects this access control parity with the API.
  const canValidate = (session?.user?.roles ?? []).includes(RoleCode.ADMIN_GLOBAL);

  return <PaymentDetailContent payment={payment} canValidate={canValidate} />;
}
