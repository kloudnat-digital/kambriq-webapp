import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';

const LEGAL_LINKS = [
  { href: '/legal/mentions', labelKey: 'mentions' },
  { href: '/legal/terms', labelKey: 'terms' },
  { href: '/legal/privacy', labelKey: 'privacy' },
  { href: '/legal/rgpd', labelKey: 'rgpd' },
] as const;

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('legal.nav');
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <div className="border-b border-border bg-gray-50">
          <nav className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-6 py-4 sm:px-8">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-8">{children}</div>
      </main>
    </>
  );
}
