'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import { updateMe } from '@/lib/actions/account';
import { setLocale } from '@/lib/actions/locale';
import type { Me } from '@/types/account';

type Lang = 'fr' | 'en';

interface AccountPreferencesCardProps {
  me: Me;
}

export const AccountPreferencesCard = ({ me }: AccountPreferencesCardProps) => {
  const t = useTranslations('app.account.preferences');
  const pathname = usePathname();
  const { createToast } = useToastStore();

  const initialLang: Lang = me.language === 'en' ? 'en' : 'fr';
  const [lang, setLang] = useState<Lang>(initialLang);
  const [emailNotif, setEmailNotif] = useState(me.profile?.emailNotifications ?? false);
  const [langPending, startLangTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const applyLanguage = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    startLangTransition(async () => {
      const result = await updateMe({ language: next }, pathname);
      if (!result.success) {
        setLang(lang);
        createToast({ status: 'error', title: result.error || t('languageSaveError') });
        return;
      }
      await setLocale(next);
      createToast({ status: 'success', title: t('languageSaved') });
    });
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    const result = await updateMe(
      {
        emailNotifications: emailNotif,
      },
      pathname,
    );
    setSaving(false);
    if (!result.success) {
      createToast({ status: 'error', title: result.error || t('notificationsSaveError') });
      return;
    }
    createToast({ status: 'success', title: t('notificationsSaved') });
  };

  const notificationsDirty = emailNotif !== (me.profile?.emailNotifications ?? false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">{t('language')}</p>
          <div className="inline-flex rounded-md border border-input p-0.5">
            <LanguagePill
              active={lang === 'fr'}
              disabled={langPending}
              onClick={() => applyLanguage('fr')}
            >
              {t('languageFr')}
            </LanguagePill>
            <LanguagePill
              active={lang === 'en'}
              disabled={langPending}
              onClick={() => applyLanguage('en')}
            >
              {t('languageEn')}
            </LanguagePill>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">{t('notifications')}</p>
          <Field orientation="horizontal" className="flex items-center justify-between">
            <FieldLabel htmlFor="pref-email" className="text-sm font-normal">
              {t('emailNotifications')}
            </FieldLabel>
            <Checkbox
              id="pref-email"
              checked={emailNotif}
              onCheckedChange={(v) => setEmailNotif(v === true)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSaveNotifications}
            disabled={saving || !notificationsDirty}
          >
            {saving && <Spinner className="size-4" />}
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface LanguagePillProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const LanguagePill = ({ active, disabled, onClick, children }: LanguagePillProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'rounded px-3 py-1 text-sm transition-colors disabled:opacity-50',
      active ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-muted',
    )}
  >
    {children}
  </button>
);
