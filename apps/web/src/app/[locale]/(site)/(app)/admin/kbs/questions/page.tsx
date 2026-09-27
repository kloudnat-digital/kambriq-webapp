import { adminGetCourse, adminGetSettings, adminListExamQuestions } from '@/lib/actions/kbs';
import { QuestionBanksContent } from '@/components/kbs-admin/question-banks-content';

export default async function AdminKbsQuestionsPage() {
  const settingsRes = await adminGetSettings();
  const courseId = settingsRes.success ? settingsRes.data.activeCourseId : null;
  const [courseRes, examRes] = await Promise.all([
    courseId ? adminGetCourse(courseId) : Promise.resolve(null),
    adminListExamQuestions(),
  ]);
  const course = courseRes?.success ? courseRes.data : null;
  const examQuestions = examRes.success ? examRes.data : [];

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <QuestionBanksContent course={course} initialExamQuestions={examQuestions} />
    </div>
  );
}
