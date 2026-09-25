import { getTranslations } from 'next-intl/server';
import { InviteForm } from '@/components/invite/invite-form';

export async function generateMetadata() {
  const t = await getTranslations('app.invite');
  return { title: t('pageTitle') };
}

export default async function InvitePage() {
  const t = await getTranslations('app.invite');
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Créez un accès portail pour un client afin qu&apos;il puisse suivre l&apos;avancement de
          son dossier.
        </p>
      </div>
      <div className="max-w-xl">
        <InviteForm />
      </div>
    </div>
  );
}
