import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';

export default async function AdminKbsIndexPage() {
  redirect({ href: '/admin/kbs/candidates', locale: await getLocale() });
}
