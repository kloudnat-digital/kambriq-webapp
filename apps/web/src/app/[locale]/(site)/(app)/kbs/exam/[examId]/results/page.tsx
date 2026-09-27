import { notFound } from 'next/navigation';
import { getExamResults } from '@/lib/actions/kbs';
import { KbsExamResults } from '@/components/kbs/kbs-exam-results';
import { KbsExamGrading } from '@/components/kbs/kbs-exam-grading';

interface Props {
  params: Promise<{ examId: string }>;
}

export default async function KbsExamResultsPage({ params }: Props) {
  const { examId } = await params;
  const res = await getExamResults(examId);
  if (!res.success || !res.data) notFound();

  /**
   * I40 - a submitted exam is waiting, not missing.
   *
   * `submitExam` enqueues grading and the session pushes straight here, so for
   * a few seconds the exam has no score. This page used to answer that with
   * `notFound()`, showing a 404 to somebody who had just sat their
   * certification exam. A missing exam is still a 404 - that is the line above,
   * and it stays - but "not graded yet" is a state to wait on, not a fault.
   */
  if (res.data.status === 'SUBMITTED') {
    return (
      <div className="mx-auto max-w-3xl p-6 lg:p-8">
        <KbsExamGrading />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <KbsExamResults result={res.data} />
    </div>
  );
}
