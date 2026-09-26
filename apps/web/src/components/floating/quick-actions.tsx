'use client';

import { Globe, MessageCircleQuestionMark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { siteConfig } from '@/config/site.config';
import { useSwitchLanguage } from '@/hooks/use-switch-language';
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
  const [showDialog, setShowDialog] = useState(false);
  const { locale: currentLocale, switchLanguage, isPending } = useSwitchLanguage();

  const openWhatsApp = (message?: string) => {
    const { number, message: defaultMsg } = siteConfig.contact.whatsapp;
    const text = message ?? defaultMsg;
    const url = `https://wa.me/${number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowDialog(false);
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
              onClick={switchLanguage}
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
