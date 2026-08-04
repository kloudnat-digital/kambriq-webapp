'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import { submitQuiz } from '@/lib/actions/kbs';
import type { QuizResult, QuizView } from '@/types/kbs';

interface Props {
  quiz: QuizView;
}

export const KbsQuizTaker = ({ quiz }: Props) => {
  const t = useTranslations('app.kbs.quiz');
  const { createToast } = useToastStore();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (questionId: string, answerId: string, single: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (single) return { ...prev, [questionId]: [answerId] };
      const has = current.includes(answerId);
      return {
        ...prev,
        [questionId]: has ? current.filter((id) => id !== answerId) : [...current, answerId],
      };
    });
  };

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  const handleSubmit = () => {
    if (!allAnswered) {
      createToast({ status: 'error', title: t('answersRequired') });
      return;
    }
    startTransition(async () => {
      const payload = quiz.questions.map((q) => ({
        questionId: q.id,
        answerIds: answers[q.id] ?? [],
      }));
      const res = await submitQuiz(quiz.moduleId, payload);
      if (!res.success) {
        createToast({ status: 'error', title: res.error });
        return;
      }
      setResult(res.data);
    });
  };

  if (result) {
    const passed = result.passed;
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
            <CardTitle>{passed ? t('resultPassed') : t('resultFailed')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('score')}</span>
              <span className="font-semibold text-gray-900">{result.score}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t('passingScore')}</span>
              <span className="text-gray-900">{result.passingScore}%</span>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          {!passed && (
            <Button
              variant="outline"
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
            >
              {t('retake')}
            </Button>
          )}
          <Button asChild>
            <Link href={`/kbs/modules/${quiz.moduleId}`} onClick={() => router.refresh()}>
              {t('backToModule')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/kbs/modules/${quiz.moduleId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" />
        {t('backToModule')}
      </Link>
      <header>
        <p className="text-xs tracking-wide text-gray-400 uppercase">{quiz.moduleTitle}</p>
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
      </header>

      <ol className="space-y-4">
        {quiz.questions.map((q, idx) => {
          const single = q.type === 'SINGLE';
          const selected = answers[q.id] ?? [];
          return (
            <Card key={q.id}>
              <CardContent className="space-y-3 pt-5">
                <p className="text-xs tracking-wide text-gray-400 uppercase">
                  {t('questionOf', { current: idx + 1, total: quiz.questions.length })}
                  {' · '}
                  {single ? t('single') : t('multiple')}
                </p>
                <p className="text-sm font-medium text-gray-900">{q.text}</p>
                <ul className="space-y-2">
                  {q.answers.map((a) => {
                    const active = selected.includes(a.id);
                    return (
                      <li key={a.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                            active
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300',
                          )}
                        >
                          {single ? (
                            <input
                              type="radio"
                              name={q.id}
                              checked={active}
                              onChange={() => toggle(q.id, a.id, true)}
                              className="size-4 accent-primary"
                            />
                          ) : (
                            <Checkbox
                              checked={active}
                              onCheckedChange={() => toggle(q.id, a.id, false)}
                            />
                          )}
                          <span className="flex-1">{a.text}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </ol>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={pending || !allAnswered}>
          {pending && <Spinner className="size-4" />}
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  );
};
