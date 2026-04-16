import { ReserveForm } from '@/components/lands/app/reserve-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReserveLandPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6 lg:p-8">
      <ReserveForm landId={id} />
    </div>
  );
}
