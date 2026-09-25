import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

/**
 * I44 - this screen showed invented data, and has no real source yet. It says
 * what it is and that it is not built (I43). `admin/invented-data.spec.tsx`
 * pins the invented values out.
 */
export async function generateMetadata() {
  const t = await getTranslations('app.adminVerify');
  return { title: t('pageTitle') };
}

export default function VerifyAdminPage() {
  return <PlaceholderPage namespace="app.adminVerify" titleKey="pageTitle" />;
}
