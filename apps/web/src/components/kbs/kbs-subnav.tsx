'use client';

import { RoleCode } from '@/lib/roles';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface KbsSubnavProps {
  roles: string[];
}

type Tab = { href: string; labelKey: string; requires?: string };

const TABS: Tab[] = [
  { href: '/kbs/enroll', labelKey: 'items.kbsEnroll' },
  { href: '/kbs', labelKey: 'items.kbsDashboard', requires: RoleCode.CANDIDATE_KBS },
  { href: '/kbs/exam', labelKey: 'items.kbsExam', requires: RoleCode.CANDIDATE_KBS },
  { href: '/kbs/certificate', labelKey: 'items.kbsCertificate', requires: RoleCode.KCA_CERTIFIED },
];

export const KbsSubnav = ({ roles }: KbsSubnavProps) => {
  const t = useTranslations('app.nav');
  const pathname = usePathname();

  const visible = TABS.filter((tab) => !tab.requires || roles.includes(tab.requires));

  const isActive = (href: string) => {
    if (href === '/kbs') return pathname === '/kbs';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {visible.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              isActive(tab.href)
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </div>
    </div>
  );
};
