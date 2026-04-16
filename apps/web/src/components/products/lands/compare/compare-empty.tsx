'use client';

import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export const CompareEmpty = () => {
  const t = useTranslations('landsCompare');
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary-500/10">
        <Layers className="size-10 text-primary-500" />
      </div>
      <h1 className="mb-3 text-2xl font-semibold text-gray-900">{t('title')}</h1>
      <p className="mb-8 max-w-md text-sm text-gray-500">{t('emptyMessage')}</p>
      <Button asChild size="lg">
        <Link href="/admin/lands/search">
          <ArrowLeft className="size-4" />
          {t('backToSearch')}
        </Link>
      </Button>
    </div>
  );
};
