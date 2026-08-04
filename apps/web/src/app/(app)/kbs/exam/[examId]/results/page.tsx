import { notFound } from 'next/navigation';
import { getExamResults } from '@/lib/actions/kbs';
import { KbsExamResults } from '@/components/kbs/kbs-exam-results';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function KbsExamResultsPage({ params }: Props) {
  const { examId } = await params;
  const res = await getExamResults(examId);
  if (!res.success || !res.data) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <KbsExamResults result={res.data} />
    </div>
  );
}
