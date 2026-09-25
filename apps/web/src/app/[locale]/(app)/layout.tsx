import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { Sidebar } from '@/components/app-shell/sidebar';
import { MobileNav } from '@/components/app-shell/mobile-nav';
import { getRoleLabelKey, getInitials } from '@/lib/user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, t, locale] = await Promise.all([auth(), getTranslations('app.nav'), getLocale()]);
  if (!session?.user) redirect({ href: '/login', locale });

  const user = session.user;

  const userRoles = user.roles ?? [];
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || t('userFallback');
  const userRole = t(getRoleLabelKey(userRoles));
  const initials = getInitials(user.firstName, user.lastName);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
        <Sidebar
          userRoles={userRoles}
          userName={userName}
          userRole={userRole}
          initials={initials}
        />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:hidden">
          <MobileNav
            userRoles={userRoles}
            userName={userName}
            userRole={userRole}
            initials={initials}
          />
          <span className="text-sm font-bold tracking-widest text-gray-900 uppercase">KAMBRIQ</span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
