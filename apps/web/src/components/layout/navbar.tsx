'use client';

import { Menu, ArrowRight, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { KambriqLogo } from '@/components/ui/kambriq-logo';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const NAV_LINKS = [
  { href: '/products/lands', labelKey: 'lands' },
  { href: '/products/verify', labelKey: 'verify' },
  { href: '/products/kbs', labelKey: 'kbs' },
  { href: '/products/kamnet', labelKey: 'kamnet' },
] as const;

const Navbar: FC = () => {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky inset-x-0 top-0 z-50 font-sans">
        <nav
          aria-label="Global"
          className="flex items-center justify-between border-b border-border/45 bg-white p-6 lg:px-8"
        >
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5" aria-label={t('homeAriaLabel')}>
              <span className="sr-only">Kambriq</span>
              <KambriqLogo />
            </Link>
          </div>

          <SheetTrigger asChild className="flex lg:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-m-2.5 bg-transparent text-gray-700 hover:bg-transparent hover:text-gray-700 aria-expanded:bg-transparent"
            >
              <span className="sr-only">{t('openMenu')}</span>
              <Menu aria-hidden="true" className="size-6" />
            </Button>
          </SheetTrigger>

          {/* Desktop nav links */}
          <div className="hidden lg:flex lg:gap-x-12">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm/6 font-semibold text-gray-900 uppercase"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          <div className="hidden space-x-4 lg:flex lg:flex-1 lg:items-center lg:justify-end">
            <Button
              size="lg"
              asChild
              variant="ghost"
              className="border-0 bg-transparent text-gray-700 hover:bg-transparent hover:text-gray-700"
            >
              <Link href="/login">{t('login')}</Link>
            </Button>
            <Button size="lg" asChild className="rounded-md">
              <Link href="/contact">
                {t('contact')} <ArrowRight />
              </Link>
            </Button>
          </div>
        </nav>

        <div className="lg:hidden">
          <SheetContent
            side="top"
            showCloseButton={false}
            className="bg-white data-[side=top]:border-gray-500/10 sm:max-w-sm sm:ring-1 sm:ring-gray-500/10"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <SheetHeader className="flex flex-row items-center justify-between px-6 py-0">
              <SheetTitle>
                <Link href="/" className="-m-1.5 p-1.5" aria-label={t('homeAriaLabel')}>
                  <span className="sr-only">Kambriq</span>
                  <KambriqLogo />
                </Link>
              </SheetTitle>
              <SheetClose asChild className="-m-2.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-gray-700 hover:bg-transparent hover:text-gray-900"
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
                      className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 uppercase hover:bg-gray-50"
                    >
                      {t(link.labelKey)}
                    </Link>
                  ))}
                </div>
                <div className="-mx-6 border-t border-gray-500/10" />
                <div className="flex flex-col gap-4 pt-6">
                  <Button size="lg" asChild className="h-10 rounded-md text-base">
                    <Link href="/contact">
                      {t('contact')} <ArrowRight />
                    </Link>
                  </Button>
                  <p className="text-center text-base font-medium text-gray-500">
                    {t('existingCustomer')}{' '}
                    <Link href="/login" className="text-gray-900 hover:underline">
                      {t('login')}
                    </Link>
                  </p>
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
