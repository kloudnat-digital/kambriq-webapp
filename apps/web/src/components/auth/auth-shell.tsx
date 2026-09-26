'use client';

import { ArrowLeft, Globe } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { KambriqLogo } from '@/components/ui/kambriq-logo';
import { useSwitchLanguage } from '@/hooks/use-switch-language';

type AccountLink = { text: string; href: string; linkText: string };

type RouteConfig = {
  title: string;
  subtitle: string | null;
  accountLink: AccountLink | null;
  showBackToHome: boolean;
};

function getRouteConfig(
  pathname: string,
  t: ReturnType<typeof useTranslations<'auth'>>,
): RouteConfig {
  if (pathname.endsWith('/login'))
    return {
      title: t('login.title'),
      subtitle: t('login.subtitle'),
      accountLink: { text: t('login.footer'), href: '/register', linkText: t('login.footerLink') },
      showBackToHome: true,
    };
  if (pathname.endsWith('/register'))
    return {
      title: t('register.title'),
      subtitle: t('register.subtitle'),
      accountLink: {
        text: t('register.footer'),
        href: '/login',
        linkText: t('register.footerLink'),
      },
      showBackToHome: true,
    };
  if (pathname.includes('/forgot-password'))
    return {
      title: t('forgotPassword.title'),
      subtitle: t('forgotPassword.subtitle'),
      accountLink: null,
      showBackToHome: true,
    };
  if (pathname.includes('/reset-password'))
    return {
      title: t('resetPassword.title'),
      subtitle: t('resetPassword.subtitle'),
      accountLink: null,
      showBackToHome: true,
    };
  if (pathname.includes('/reactivate'))
    return {
      title: t('reactivate.title'),
      subtitle: t('reactivate.subtitle'),
      accountLink: null,
      showBackToHome: true,
    };
  if (pathname.includes('/verify-email'))
    return {
      title: t('verifyEmail.title'),
      subtitle: t('verifyEmail.subtitle'),
      accountLink: null,
      showBackToHome: false,
    };
  return { title: '', subtitle: null, accountLink: null, showBackToHome: true };
}

export const AuthShell = ({ children }: { children: ReactNode }) => {
  const t = useTranslations('auth');
  const pathname = usePathname();
  const { locale, switchLanguage, isPending } = useSwitchLanguage();

  const { title, subtitle, accountLink, showBackToHome } = getRouteConfig(pathname, t);

  return (
    <div className="relative flex min-h-svh flex-col justify-center bg-background py-12 sm:px-6 lg:px-8">
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={switchLanguage}
          disabled={isPending}
          className="gap-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Globe className="size-4" />
          {isPending ? '…' : locale === 'fr' ? 'EN' : 'FR'}
        </Button>
      </div>

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" aria-label="KAMBRIQ - Accueil">
          <KambriqLogo className="mx-auto" />
        </Link>
        <h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      {/* Card */}
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">{children}</div>

        {/* Account link - only on login / register */}
        {accountLink && (
          <p className="mt-8 text-center text-sm/6 text-muted-foreground">
            {accountLink.text}{' '}
            <Link
              href={accountLink.href}
              className="font-semibold text-primary hover:text-primary/80"
            >
              {accountLink.linkText}
            </Link>
          </p>
        )}

        {/* Back to home */}
        {showBackToHome && (
          <p className="mt-6 text-center text-sm/6">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t('backToHome')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};
