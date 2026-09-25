'use client';

import { Globe, MessageCircleQuestionMark } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { siteConfig } from '@/config/site.config';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WhatsApp from '../icons/whatsapp';

const WHATSAPP_QUESTIONS = [
  'landInfo',
  'verifyService',
  'kbsFormation',
  'kamnetAgent',
  'pricing',
  'buyingProcess',
  'documentation',
  'other',
] as const;

function QuickActions() {
  const t = useTranslations('quickActions');
  const router = useRouter();
  const pathname = usePathname();
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentLocale = useLocale() as Locale;

  const openWhatsApp = (message?: string) => {
    const { number, message: defaultMsg } = siteConfig.contact.whatsapp;
    const text = message ?? defaultMsg;
    const url = `https://wa.me/${number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowDialog(false);
  };

  /**
   * Switching language is a navigation, not a stored preference.
   *
   * It replaces the current URL with its counterpart under the other locale,
   * so the address bar, the rendered language and what a crawler would index
   * all agree. Writing a cookie and refreshing, which is what this did, left
   * one URL serving two languages.
   */
  const handleLocaleToggle = () => {
    const next: Locale = currentLocale === 'fr' ? 'en' : 'fr';
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <>
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-3">
        {/* WhatsApp button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setShowDialog(true)}
              size="icon"
              aria-label={t('whatsapp')}
              className="h-14 w-14 rounded-full bg-success text-success-foreground shadow-lg transition-[transform,box-shadow,background-color] duration-300 hover:bg-success/90 hover:shadow-xl motion-safe:hover:scale-110"
            >
              <WhatsApp className="size-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('whatsapp')}</TooltipContent>
        </Tooltip>

        {/* Language toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleLocaleToggle}
              size="icon"
              variant="outline"
              disabled={isPending}
              aria-label={t('language')}
              className="relative h-12 w-12 rounded-full bg-card shadow-lg transition-[transform,box-shadow] duration-300 hover:shadow-xl motion-safe:hover:scale-110"
            >
              <Globe className="size-6" />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {isPending ? '…' : currentLocale.toUpperCase()}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('languageToggle')}</TooltipContent>
        </Tooltip>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('selectQuestion')}</DialogTitle>
            <DialogDescription>{t('selectQuestionDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {WHATSAPP_QUESTIONS.map((key) => (
              <Button
                key={key}
                variant="outline"
                className="h-auto justify-start px-4 py-4 text-left hover:bg-muted"
                onClick={() => openWhatsApp(t(`questions.${key}` as 'questions.landInfo'))}
              >
                <MessageCircleQuestionMark className="mr-3 h-4 w-4 shrink-0" />
                <span className="flex-1">{t(`questions.${key}` as 'questions.landInfo')}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QuickActions;
