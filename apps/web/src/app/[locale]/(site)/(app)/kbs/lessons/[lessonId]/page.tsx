import { notFound } from 'next/navigation';
import { getLessonView } from '@/lib/actions/kbs';
import { KbsLessonView } from '@/components/kbs/kbs-lesson-view';

interface Props {
  params: Promise<{ lessonId: string }>;
}

export default async function KbsLessonPage({ params }: Props) {
  const { lessonId } = await params;
  const res = await getLessonView(lessonId);
  if (!res.success || !res.data) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <KbsLessonView lesson={res.data} />
    </div>
  );
}
