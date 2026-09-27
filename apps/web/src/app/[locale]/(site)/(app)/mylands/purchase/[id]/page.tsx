import { PurchaseDetailContent } from '@/components/mylands/purchase-detail-content';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PurchaseDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6 lg:p-8">
      <PurchaseDetailContent id={id} />
    </div>
  );
}
