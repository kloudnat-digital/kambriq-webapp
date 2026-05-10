'use client';

import { Menu, ArrowRight, X, User, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { KambriqLogo } from '@/components/ui/kambriq-logo';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { logOutAction } from '@/lib/actions/auth';
import { generateAvatar } from '@/lib/avatar';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/products/lands', labelKey: 'lands' },
  { href: '/products/verify', labelKey: 'verify' },
  { href: '/products/kbs', labelKey: 'kbs' },
  { href: '/products/kamnet', labelKey: 'kamnet' },
] as const;

type UserMenuProps = {
  avatarSrc: string | null;
  fullName: string;
  initials: string;
  email: string;
};

function NavUserMenuDesktop({ avatarSrc, fullName, initials, email }: UserMenuProps) {
  const t = useTranslations('nav');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none">
          <Avatar className="size-8 cursor-pointer">
            <AvatarImage src={avatarSrc ?? undefined} alt={fullName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="size-4" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void logOutAction();
          }}
        >
          <LogOut className="size-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavUserMenuMobile({ avatarSrc, fullName, initials, email }: UserMenuProps) {
  const t = useTranslations('nav');
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={avatarSrc ?? undefined} alt={fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-accent">{fullName}</p>
          <p className="truncate text-xs text-surface-500">{email}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Link
          href="/profile"
          className="block py-2 text-base/7 font-semibold text-accent hover:bg-surface-50"
        >
          {t('profile')}
        </Link>
        <Link
          href="/settings"
          className="block py-2 text-base/7 font-semibold text-accent hover:bg-surface-50"
        >
          {t('settings')}
        </Link>
        <button
          onClick={() => {
            void logOutAction();
          }}
          className="block py-2 text-base/7 font-semibold text-destructive hover:bg-surface-50"
        >
          {t('signOut')}
        </button>
      </div>
    </>
  );
}

const Navbar: FC = () => {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const avatarSrc = useMemo(
    () => (user ? generateAvatar('bigEarsNeutral', user.email) : null),
    [user],
  );
  const fullName = user ? `${user.firstName} ${user.lastName}` : null;
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky inset-x-0 top-0 z-50 font-sans">
        <nav
          aria-label="Global"
          className="flex items-center justify-between border-b border-white/[0.06] bg-accent/92 px-6 py-4 backdrop-blur-xl lg:px-8"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 lg:flex-1">
            <Link
              href="/"
              className="-m-1.5 flex items-center gap-2.5 p-1.5"
              aria-label={t('homeAriaLabel')}
            >
              <span className="sr-only">Kambriq</span>
              <KambriqLogo className="size-8" />
              <span className="hidden font-serif text-lg font-bold tracking-[0.04em] text-white sm:inline">
                KAMBRIQ
              </span>
            </Link>
          </div>

          {/* Mobile trigger */}
          <SheetTrigger asChild className="flex lg:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-m-2.5 bg-transparent text-white hover:bg-white/10 hover:text-white aria-expanded:bg-white/10"
            >
              <span className="sr-only">{t('openMenu')}</span>
              <Menu aria-hidden="true" className="size-6" />
            </Button>
          </SheetTrigger>

          {/* Desktop nav links */}
          <div className="hidden lg:flex lg:items-center lg:gap-x-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'border-b-2 pb-1 text-[13px] font-medium transition-colors',
                  isActive(link.href)
                    ? 'border-gold text-white'
                    : 'border-transparent text-accent-200 hover:text-white',
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-4 lg:flex lg:flex-1 lg:justify-end">
            {user && fullName && initials ? (
              <NavUserMenuDesktop
                avatarSrc={avatarSrc}
                fullName={fullName}
                initials={initials}
                email={user.email}
              />
            ) : (
              <Link
                href="/login"
                className="text-[13px] font-medium text-accent-200 hover:text-white"
              >
                {t('login')}
              </Link>
            )}
            <Button size="sm" asChild>
              <Link href="/contact">
                {t('contact')} <ArrowRight />
              </Link>
            </Button>
          </div>
        </nav>

        {/* Mobile sheet */}
        <div className="lg:hidden">
          <SheetContent
            side="top"
            showCloseButton={false}
            className="bg-accent text-white data-[side=top]:border-white/[0.06] sm:max-w-sm sm:ring-1 sm:ring-white/10"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <SheetHeader className="flex flex-row items-center justify-between px-6 py-0">
              <SheetTitle>
                <Link
                  href="/"
                  className="-m-1.5 flex items-center gap-2.5 p-1.5"
                  aria-label={t('homeAriaLabel')}
                >
                  <span className="sr-only">Kambriq</span>
                  <KambriqLogo className="size-8" />
                  <span className="font-serif text-lg font-bold tracking-[0.04em] text-white">
                    KAMBRIQ
                  </span>
                </Link>
              </SheetTitle>
              <SheetClose asChild className="-m-2.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <X />
                </Button>
              </SheetClose>
            </SheetHeader>
            <div className="flow-root px-6 pb-10">
              <div className="-my-6">
                <div className="space-y-2 pb-6">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        '-mx-3 block rounded-lg px-3 py-2 text-base/7 font-medium hover:bg-white/5',
                        isActive(link.href) ? 'text-white' : 'text-accent-200',
                      )}
                    >
                      {t(link.labelKey)}
                    </Link>
                  ))}
                </div>
                <div className="-mx-6 border-t border-white/10" />
                <div className="flex flex-col gap-4 pt-6">
                  {user && fullName && initials ? (
                    <NavUserMenuMobile
                      avatarSrc={avatarSrc}
                      fullName={fullName}
                      initials={initials}
                      email={user.email}
                    />
                  ) : (
                    <>
                      <Button size="lg" asChild className="h-12 rounded-md text-base">
                        <Link href="/contact">
                          {t('contact')} <ArrowRight />
                        </Link>
                      </Button>
                      <p className="text-center text-base text-accent-200">
                        {t('existingCustomer')}{' '}
                        <Link href="/login" className="text-white hover:underline">
                          {t('login')}
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </div>
      </header>
    </Sheet>
  );
};

export default Navbar;
