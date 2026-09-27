'use client';

import { useEffect, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { followLanguage } from '@/lib/actions/account';
import { useToastStore } from '@/store/toast.store';

type Notice = 'saved' | 'failed';

/** Carries the notice across the navigation, which may remount the switcher. */
const NOTICE_KEY = 'kambriq.languageFollowed';

/** Stored with the locale switched to, so only the page in that locale reads it. */
const writeNotice = (notice: Notice, locale: Locale) => {
  try {
    sessionStorage.setItem(NOTICE_KEY, `${notice}:${locale}`);
  } catch {
    // Storage unavailable: the switch still happens, only the notice is lost.
  }
};

const takeNotice = (locale: Locale): Notice | null => {
  try {
    const [notice, target] = (sessionStorage.getItem(NOTICE_KEY) ?? '').split(':');
    if (target !== locale) return null;
    sessionStorage.removeItem(NOTICE_KEY);
    return notice === 'saved' || notice === 'failed' ? notice : null;
  } catch {
    return null;
  }
};

/**
 * Switches the page to the other locale and, for a signed-in person, the
 * account language with it (J4). A switch that changed the account, or tried
 * to and failed, is announced in the new language with a link to the profile,
 * where it can be undone. A visitor's switch changes the page and nothing else.
 */
export const useSwitchLanguage = () => {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('languageSwitch');
  const { createToast } = useToastStore();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const notice = takeNotice(locale);
    if (!notice) return;
    createToast({
      status: notice === 'saved' ? 'success' : 'warning',
      title: t(`${notice}.title`),
      description: t(`${notice}.description`),
      duration: 15000,
      action: { label: t('profile'), onClick: () => router.push('/account') },
    });
  }, [locale, createToast, router, t]);

  const switchLanguage = () => {
    const next: Locale = locale === 'fr' ? 'en' : 'fr';
    startTransition(async () => {
      try {
        const result = await followLanguage(next);
        if (!result.success) writeNotice('failed', next);
        else if (result.data === 'saved') writeNotice('saved', next);
      } catch {
        writeNotice('failed', next);
      }
      router.replace(pathname, { locale: next });
    });
  };

  return { locale, switchLanguage, isPending };
};
