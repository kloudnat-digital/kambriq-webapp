import Link from 'next/link';
import { Rocket, MapPin, ShieldCheck, Users, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import Navbar from '@/components/layout/navbar';

const CURRENT_SERVICES = [
  { icon: MapPin, key: 'lands', href: '/admin/lands/search' },
  { icon: ShieldCheck, key: 'verify', href: '/products/verify' },
  { icon: Users, key: 'kamnet', href: '/products/kamnet' },
  { icon: BookOpen, key: 'kbs', href: '/products/kbs' },
];

export default function ComingSoonPage() {
  const t = useTranslations('comingSoon');
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center sm:px-8">
          <div className="mb-6 flex size-24 items-center justify-center rounded-3xl bg-primary-500/10">
            <Rocket className="size-12 text-primary-600" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-gray-900 sm:text-5xl">{t('title')}</h1>
          <p className="mb-10 max-w-lg text-gray-500">{t('subtitle')}</p>

          <div className="mb-16 w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary-600 uppercase">
              {t('upcoming')}
            </p>
            <h2 className="text-xl font-bold text-gray-900">{t('kcpi.title')}</h2>
            <p className="mt-2 text-sm text-gray-500">{t('kcpi.description')}</p>
          </div>

          <h2 className="mb-6 text-lg font-semibold text-gray-700">{t('currentServices')}</h2>
          <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
            {CURRENT_SERVICES.map(({ icon: Icon, key, href }) => (
              <Link
                key={key}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                  <Icon className="size-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t(`services.${key}.title`)}</p>
                  <p className="text-xs text-gray-500">{t(`services.${key}.description`)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
