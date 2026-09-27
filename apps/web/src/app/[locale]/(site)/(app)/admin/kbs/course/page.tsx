import { adminGetCourse, adminGetSettings } from '@/lib/actions/kbs';
import { CourseEditorContent } from '@/components/kbs-admin/course-editor-content';

export default async function AdminKbsCoursePage() {
  const settingsRes = await adminGetSettings();
  const settings = settingsRes.success ? settingsRes.data : null;
  const courseId = settings?.activeCourseId ?? null;
  const courseRes = courseId ? await adminGetCourse(courseId) : null;
  const course = courseRes?.success ? courseRes.data : null;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <CourseEditorContent course={course} activeCourseId={courseId} />
    </div>
  );
}
