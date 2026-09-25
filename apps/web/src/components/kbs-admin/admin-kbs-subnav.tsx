'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/kbs/candidates', labelKey: 'nav.candidates' },
  { href: '/admin/kbs/course', labelKey: 'nav.course' },
  { href: '/admin/kbs/questions', labelKey: 'nav.questionsQuiz' },
  { href: '/admin/kbs/exams', labelKey: 'nav.exams' },
  { href: '/admin/kbs/certificates', labelKey: 'nav.certificates' },
  { href: '/admin/kbs/settings', labelKey: 'nav.settings' },
];

export const AdminKbsSubnav = () => {
  const t = useTranslations('app.adminKbs');
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-900',
              )}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
