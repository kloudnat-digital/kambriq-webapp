import { notFound } from 'next/navigation';
import { startExam } from '@/lib/actions/kbs';
import { KbsExamSession } from '@/components/kbs/kbs-exam-session';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function KbsExamSessionPage({ params }: Props) {
  const { examId } = await params;
  const res = await startExam(examId);
  if (!res.success || !res.data) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <KbsExamSession running={res.data} />
    </div>
  );
}
