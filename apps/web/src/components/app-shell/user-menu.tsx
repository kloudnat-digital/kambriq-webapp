'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { logOutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  name: string;
  role: string;
  initials: string;
}

export const UserMenu = ({ name, role, initials }: UserMenuProps) => {
  const t = useTranslations('a11y');
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-3">
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          'bg-primary text-xs font-bold text-white',
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-gray-400">{role}</p>
      </div>
      <form action={logOutAction}>
        <button
          type="submit"
          className="text-gray-400 transition-colors hover:text-white"
          aria-label={t('signOut')}
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
};
