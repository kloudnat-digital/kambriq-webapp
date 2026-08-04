'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KBS_MODULE_TONE, KBS_STATUS_TONE } from '@/lib/kbs';
import type { KbsNextAction, MyCandidate, OverviewPayload } from '@/types/kbs';

interface Props {
  overview: OverviewPayload | null;
  candidate: MyCandidate;
}

const NEXT_HREF = (action: KbsNextAction, overview: OverviewPayload | null): string => {
  if (action === 'certified') return '/kbs/certificate';
  if (action === 'exam') return '/kbs/exam';
  const currentModule = overview?.modules.find(
    (m) => m.order === overview?.overall.currentModuleOrder,
  );
  if (!currentModule) return '/kbs';
  return `/kbs/modules/${currentModule.id}`;
};

export const KbsDashboardContent = ({ overview, candidate }: Props) => {
  const t = useTranslations('app.kbs');
  const tDash = useTranslations('app.kbs.dashboard');

  if (!overview) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        {t('empty')}
      </div>
    );
  }

  const nextActionKey =
    `action${overview.overall.nextAction.charAt(0).toUpperCase()}${overview.overall.nextAction.slice(1)}` as
      | 'actionLesson'
      | 'actionMcq'
      | 'actionExam'
      | 'actionCertified';
  const nextHref = NEXT_HREF(overview.overall.nextAction, overview);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tDash('pageTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {overview.course?.title ?? tDash('subtitle')}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
            KBS_STATUS_TONE[candidate.status],
          )}
        >
          {t(`status.${candidate.status}`)}
        </span>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{tDash('overall')}</p>
            <p className="text-sm text-gray-500">
              {overview.overall.modulesDone} {tDash('moduleOf')} {overview.overall.modulesTotal}{' '}
              {tDash('modules')}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${overview.overall.percent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs tracking-wide text-gray-400 uppercase">{tDash('nextAction')}</p>
              <p className="text-sm font-medium text-gray-900">{tDash(nextActionKey)}</p>
            </div>
            <Button asChild>
              <Link href={nextHref} className="gap-2">
                {tDash(nextActionKey)}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          {tDash('modules')}
        </h2>
        <div className="grid gap-3">
          {overview.modules.map((module) => {
            const locked = module.status === 'locked';
            return (
              <Card key={module.id} className={cn(locked && 'opacity-70')}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {module.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{module.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {module.lessonsCompleted}/{module.lessonsCount} {tDash('lessons')}
                      {module.quiz.passed && (
                        <>
                          {' · '}
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            {tDash('quizPassed')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      KBS_MODULE_TONE[module.status],
                    )}
                  >
                    {t(`moduleStatus.${module.status}`)}
                  </span>
                  <Button
                    asChild
                    variant={locked ? 'ghost' : 'outline'}
                    size="sm"
                    disabled={locked}
                  >
                    {locked ? (
                      <span className="gap-2">
                        <Lock className="size-4" />
                      </span>
                    ) : (
                      <Link href={`/kbs/modules/${module.id}`} className="gap-2">
                        {module.status === 'completed' ? (
                          <GraduationCap className="size-4" />
                        ) : (
                          <BookOpen className="size-4" />
                        )}
                        {tDash('openModule')}
                      </Link>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};
