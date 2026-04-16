'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/nav';

interface NavLinkProps {
  item: NavItem;
  onNavigate?: () => void;
}

export const NavLink = ({ item, onNavigate }: NavLinkProps) => {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
};
