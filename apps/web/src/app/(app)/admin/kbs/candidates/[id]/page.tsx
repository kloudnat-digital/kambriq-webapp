import { notFound } from 'next/navigation';
import { adminGetCandidate } from '@/lib/actions/kbs';
import { CandidateDetailContent } from '@/components/kbs-admin/candidate-detail-content';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminKbsCandidateDetailPage({ params }: Props) {
  const { id } = await params;
  const res = await adminGetCandidate(id);
  if (!res.success || !res.data) notFound();

  console.log(res.data);
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <CandidateDetailContent candidate={res.data} />
    </div>
  );
}
