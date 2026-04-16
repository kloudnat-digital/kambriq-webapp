import { LandDetailContent } from '@/components/lands/app/land-detail-content';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LandDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6 lg:p-8">
      <LandDetailContent id={id} />
    </div>
  );
}
