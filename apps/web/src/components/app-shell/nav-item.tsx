'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/nav';

interface NavLinkProps {
  item: NavItem;
  onNavigate?: () => void;
}

export const NavLink = ({ item, onNavigate }: NavLinkProps) => {
  const pathname = usePathname();
  const t = useTranslations('app.nav');
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {t(item.labelKey)}
    </Link>
  );
};
