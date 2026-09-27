import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getMe } from '@/lib/actions/account';
import { AccountContent } from '@/components/account/account-content';

export default async function AccountPage() {
  const t = await getTranslations('app.account');
  const result = await getMe();

  if (!result.success) {
    if (result.status === 401) {
      redirect({
        href: { pathname: '/login', query: { callbackUrl: '/account' } },
        locale: await getLocale(),
      });
    }
    return (
      <div className="h-full p-6 lg:p-8">
        <p className="text-sm text-destructive">{t('loadError')}</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <AccountContent me={result.data} />
    </div>
  );
}
