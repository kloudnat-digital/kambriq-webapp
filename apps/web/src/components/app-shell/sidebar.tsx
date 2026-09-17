'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { NavLink } from './nav-item';
import { UserMenu } from './user-menu';
import { filterNavForRoles, NAV_SECTIONS } from '@/lib/nav';

interface SidebarProps {
  userRoles: string[];
  userName: string;
  userRole: string;
  initials: string;
  onNavigate?: () => void;
}

export const Sidebar = ({ userRoles, userName, userRole, initials, onNavigate }: SidebarProps) => {
  const t = useTranslations('app.nav');
  const sections = filterNavForRoles(NAV_SECTIONS, userRoles);

  return (
    <div className="flex h-full flex-col bg-accent-800">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative size-8">
            <Image
              fill
              src="/assets/images/kambriq-logo.png"
              alt="KAMBRIQ"
              className="object-contain"
            />
          </div>
          <span className="text-sm font-bold tracking-tighter text-white uppercase">KAMBRIQ</span>
        </Link>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.labelKey}>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
              {t(section.labelKey)}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-4 h-px bg-white/10" />

      {/* User */}
      <div className="shrink-0 p-2">
        <UserMenu name={userName} role={userRole} initials={initials} />
      </div>
    </div>
  );
};
