import { adminGetSettings, adminListCourses } from '@/lib/actions/kbs';
import { SettingsForm } from '@/components/kbs-admin/settings-form';

export default async function AdminKbsSettingsPage() {
  const [settingsRes, coursesRes] = await Promise.all([adminGetSettings(), adminListCourses()]);
  const settings = settingsRes.success ? settingsRes.data : null;
  const courses = coursesRes.success ? coursesRes.data : [];

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <SettingsForm settings={settings} courses={courses} />
    </div>
  );
}
