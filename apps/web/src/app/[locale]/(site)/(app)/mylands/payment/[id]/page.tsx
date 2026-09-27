import { MyPaymentContent } from '@/components/mylands/my-payment-content';
import { getMyPayment } from '@/lib/actions/lands';

export const metadata = { title: 'Mon paiement' };

export default async function MyPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await getMyPayment(id);
  return (
    <div className="p-6 lg:p-8">
      <MyPaymentContent payment={payment} />
    </div>
  );
}
