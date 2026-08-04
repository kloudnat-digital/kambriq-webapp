'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileText, Lock, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/kbs';
import type { KbsLessonContentType, ModuleDetail } from '@/types/kbs';

const CONTENT_ICON: Record<KbsLessonContentType, React.ElementType> = {
  VIDEO: Play,
  PDF: FileText,
  HTML: FileText,
  TEXT: FileText,
};

interface Props {
  detail: ModuleDetail;
}

export const KbsModuleDetailContent = ({ detail }: Props) => {
  const t = useTranslations('app.kbs.module');
  const tCommon = useTranslations('app.kbs');
  const { module, lessons, quiz } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/kbs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" />
        {tCommon('backToDashboard')}
      </Link>

      <header className="space-y-1">
        <p className="text-xs tracking-wide text-gray-400 uppercase">
          {t('pageTitle')} {module.order}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{module.title}</h1>
        {module.description && <p className="text-sm text-gray-500">{module.description}</p>}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          {t('lessonsTitle')}
        </h2>
        <div className="grid gap-2">
          {lessons.map((lesson) => {
            const Icon = CONTENT_ICON[lesson.contentType] ?? FileText;
            const done = Boolean(lesson.completedAt);
            return (
              <Link
                key={lesson.id}
                href={`/kbs/lessons/${lesson.id}`}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-primary',
                )}
              >
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    done ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary',
                  )}
                >
                  {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {lesson.order}. {lesson.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {lesson.duration} {t('minutes')}
                    {done && ` · ${t('lessonCompleted')}`}
                  </p>
                </div>
                <span className="text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  {t('openLesson')} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          {t('quizTitle')}
        </h2>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              {quiz.unlocked ? <ClipboardCheck className="size-4" /> : <Lock className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              {!quiz.unlocked && <p className="text-sm text-gray-600">{t('quizLocked')}</p>}
              {quiz.unlocked && !quiz.passed && (
                <>
                  <p className="text-sm font-medium text-gray-900">{t('quizAvailable')}</p>
                  <p className="text-xs text-gray-500">
                    {t('quizAttempts', { used: quiz.attempts, max: quiz.maxAttempts || '∞' })}
                    {quiz.nextAttemptAt &&
                      ` · ${t('quizNextAttempt', { when: formatDateTime(quiz.nextAttemptAt) })}`}
                  </p>
                </>
              )}
              {quiz.passed && (
                <p className="text-sm font-medium text-emerald-700">
                  {t('quizPassed', { score: quiz.score ?? '-' })}
                </p>
              )}
            </div>
            {quiz.unlocked && !quiz.passed && (
              <Button asChild disabled={Boolean(quiz.nextAttemptAt)}>
                <Link href={`/kbs/modules/${module.id}/quiz`}>
                  {quiz.attempts > 0 ? t('retakeQuiz') : t('startQuiz')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
