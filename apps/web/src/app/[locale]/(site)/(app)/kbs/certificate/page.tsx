import { getTranslations } from 'next-intl/server';
import { getMyCertificate } from '@/lib/actions/kbs';
import { KbsCertificateView } from '@/components/kbs/kbs-certificate-view';

export async function generateMetadata() {
  const t = await getTranslations('app.kbs.certificate');
  return { title: t('pageTitle') };
}

export default async function KbsCertificatePage() {
  const res = await getMyCertificate();
  const cert = res.success ? res.data : null;

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <KbsCertificateView certificate={cert} />
    </div>
  );
}
