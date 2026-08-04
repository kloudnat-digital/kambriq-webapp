import { getTranslations } from 'next-intl/server';
import { Hourglass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const KbsAwaitingVerification = async () => {
  const t = await getTranslations('app.kbs.awaiting');

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Hourglass className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
          <p className="max-w-md text-sm text-gray-600">{t('description')}</p>
          <p className="text-xs text-gray-500">{t('hint')}</p>
        </div>
      </CardContent>
    </Card>
  );
};
