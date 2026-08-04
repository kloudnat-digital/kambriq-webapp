'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ExamResult } from '@/types/kbs';

interface Props {
  result: ExamResult;
}

export const KbsExamResults = ({ result }: Props) => {
  const t = useTranslations('app.kbs.exam');
  const passed = result.status === 'PASSED';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-full',
              passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            {passed ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
          </div>
          <CardTitle>{t('resultTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{t('score')}</span>
            <span className="font-semibold text-gray-900">{result.score ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{t('correctAnswers')}</span>
            <span className="text-gray-900">
              {result.correctCount} / {result.totalQuestions}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/kbs/exam">{t('history')}</Link>
        </Button>
        {passed && (
          <Button asChild>
            <Link href="/kbs/certificate">{t('viewResults')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
};
