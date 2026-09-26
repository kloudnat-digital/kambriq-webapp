import { notFound } from 'next/navigation';
import { getQuiz } from '@/lib/actions/kbs';
import { KbsQuizTaker } from '@/components/kbs/kbs-quiz-taker';

interface Props {
  params: Promise<{ moduleId: string }>;
}

export default async function KbsModuleQuizPage({ params }: Props) {
  const { moduleId } = await params;
  const res = await getQuiz(moduleId);
  if (!res.success || !res.data) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <KbsQuizTaker quiz={res.data} />
    </div>
  );
}
