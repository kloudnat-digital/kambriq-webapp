'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import { saveExamAnswer, submitExam } from '@/lib/actions/kbs';
import type { ExamRunning } from '@/types/kbs';

interface Props {
  running: ExamRunning;
}

const AUTOSAVE_DEBOUNCE_MS = 400;

export const KbsExamSession = ({ running }: Props) => {
  const t = useTranslations('app.kbs.exam');
  const tQuiz = useTranslations('app.kbs.quiz');
  const { createToast } = useToastStore();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const start = new Date(running.startedAt).getTime();
    const end = start + running.durationMinutes * 60_000;
    const tick = () => setRemainingMs(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running.startedAt, running.durationMinutes]);

  const setAnswer = (questionId: string, next: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      saveExamAnswer(running.examId, questionId, next).catch(() => undefined);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const toggle = (questionId: string, answerId: string, single: boolean) => {
    const current = answers[questionId] ?? [];
    if (single) return setAnswer(questionId, [answerId]);
    const next = current.includes(answerId)
      ? current.filter((id) => id !== answerId)
      : [...current, answerId];
    setAnswer(questionId, next);
  };

  const answered = Object.values(answers).filter((v) => v.length > 0).length;

  const handleSubmit = () => {
    startTransition(async () => {
      const payload = running.questions.map((q) => ({
        questionId: q.id,
        answerIds: answers[q.id] ?? [],
      }));
      const res = await submitExam(running.examId, payload);
      if (!res.success) {
        createToast({ status: 'error', title: res.error });
        return;
      }
      router.push(`/kbs/exam/${running.examId}/results`);
      router.refresh();
    });
  };

  const timeLabel = remainingMs != null ? formatMs(remainingMs) : '—';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
          <p className="text-sm text-gray-500">
            {t('totalQuestions', { n: running.questions.length })}
            {' · '}
            {t('durationMinutes', { n: running.durationMinutes })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900">
          <Clock className="size-4 text-gray-500" />
          <span className={cn(remainingMs != null && remainingMs < 60_000 && 'text-red-600')}>
            {timeLabel}
          </span>
        </div>
      </header>

      <ol className="space-y-4">
        {running.questions.map((q, idx) => {
          const single = q.type === 'SINGLE';
          const selected = answers[q.id] ?? [];
          return (
            <Card key={q.id}>
              <CardContent className="space-y-3 pt-5">
                <p className="text-xs tracking-wide text-gray-400 uppercase">
                  {tQuiz('questionOf', {
                    current: idx + 1,
                    total: running.questions.length,
                  })}
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

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <span className="text-sm text-gray-600">{t('answerCount', { n: answered })}</span>
        {confirming ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              {tQuiz('backToModule')}
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending && <Spinner className="size-4" />}
              {t('confirmSubmit')}
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)}>{t('submit')}</Button>
        )}
      </div>
    </div>
  );
};

const formatMs = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
