import { ReservationDetailContent } from '@/components/reservations/reservation-detail-content';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReservationDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6 lg:p-8">
      <ReservationDetailContent id={id} />
    </div>
  );
}
