import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getMyCandidate } from '@/lib/actions/kbs';
import { KbsEnrollForm } from '@/components/kbs/kbs-enroll-form';

export async function generateMetadata() {
  const t = await getTranslations('app.kbs.enroll');
  return { title: t('pageTitle') };
}

export default async function KbsEnrollPage() {
  const res = await getMyCandidate();
  if (res.success && res.data) redirect({ href: '/kbs', locale: await getLocale() });

  return (
    <div className="flex min-h-full justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-150">
        <KbsEnrollForm />
      </div>
    </div>
  );
}
