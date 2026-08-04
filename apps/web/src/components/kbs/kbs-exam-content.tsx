'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { KBS_EXAM_TONE, formatDateTime } from '@/lib/kbs';
import { useToastStore } from '@/store/toast.store';
import { scheduleExam } from '@/lib/actions/kbs';
import type { ExamEligibility, ExamHistoryItem } from '@/types/kbs';

interface Props {
  eligibility: ExamEligibility;
  history: ExamHistoryItem[];
}

export const KbsExamContent = ({ eligibility, history }: Props) => {
  const t = useTranslations('app.kbs.exam');
  const tCommon = useTranslations('app.kbs');
  const { createToast } = useToastStore();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const activeExam = history.find((e) => e.status === 'SCHEDULED' || e.status === 'IN_PROGRESS');

  const handleSchedule = () => {
    startTransition(async () => {
      const res = await scheduleExam(pathname);
      if (!res.success) {
        createToast({ status: 'error', title: res.error });
        return;
      }
      createToast({ status: 'success', title: t('startsAt') });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </header>

      {activeExam ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" />
            </div>
            <CardTitle>{t('attempt', { n: activeExam.attemptNumber })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('startsAt')}</span>
              <span className="text-gray-900">{formatDateTime(activeExam.scheduledAt)}</span>
            </div>
            <div className="flex justify-end">
              <Button asChild>
                <Link href={`/kbs/exam/${activeExam.id}`} className="gap-2">
                  <Play className="size-4" />
                  {t('start')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : eligibility.eligible ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <CardTitle>{t('eligibleTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{t('eligibleText')}</p>
            <p className="text-xs text-gray-500">
              {t('attemptsLeft')}: {eligibility.attemptsLeft} / {eligibility.maxAttempts}
            </p>
            <div className="flex justify-end">
              <Button onClick={handleSchedule} disabled={pending}>
                {pending && <Spinner className="size-4" />}
                {t('schedule')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="size-5" />
            </div>
            <CardTitle>{t('notEligibleTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eligibility.reason && <p className="text-sm text-gray-600">{eligibility.reason}</p>}
            {eligibility.nextAttemptAt && (
              <p className="text-sm text-gray-500">
                {t('cooldownText', { when: formatDateTime(eligibility.nextAttemptAt) })}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {t('attemptsLeft')}: {eligibility.attemptsLeft} / {eligibility.maxAttempts}
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            {t('history')}
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <span className="text-sm font-medium text-gray-900">
                    {t('attempt', { n: h.attemptNumber })}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      KBS_EXAM_TONE[h.status],
                    )}
                  >
                    {tCommon(
                      `status.${h.status === 'PASSED' ? 'CERTIFIED' : h.status === 'FAILED' ? 'FAILED' : 'IN_TRAINING'}`,
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(h.submittedAt ?? h.scheduledAt)}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    {h.score != null && (
                      <span className="text-sm font-semibold text-gray-900">{h.score}%</span>
                    )}
                    {(h.status === 'PASSED' || h.status === 'FAILED') && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/kbs/exam/${h.id}/results`}>{t('viewResults')}</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
