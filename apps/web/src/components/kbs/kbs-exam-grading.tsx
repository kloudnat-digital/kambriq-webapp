'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * I40 - what a candidate sees in the seconds after submitting.
 *
 * Grading runs on a queue, so an exam sits at SUBMITTED briefly before it has a
 * score. The page used to call `notFound()` on the API's refusal, so somebody
 * who had just sat a certification exam was shown a **404**. I met it myself
 * driving a real candidate through on dev.
 *
 * Grading stays asynchronous on purpose: making it synchronous would put a
 * queue's work on the request path for every candidate, to save a few seconds
 * of waiting. So the screen waits instead, and says what it is waiting for.
 *
 * It polls by asking the SERVER component to re-render rather than by fetching
 * in the browser: the verdict, the score and the breakdown are all assembled
 * server-side, and `router.refresh()` is how the rest of this codebase asks for
 * fresh server data. When the exam has been graded the page renders the result
 * instead of this component, and the interval is torn down with it.
 */
const POLL_MS = 3000;

export const KbsExamGrading = () => {
  const t = useTranslations('app.kbs.exam');
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <Card>
      <CardContent
        className="flex flex-col items-center gap-4 py-10 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">{t('gradingTitle')}</h1>
          <p className="max-w-md text-sm text-gray-600">{t('gradingText')}</p>
        </div>
      </CardContent>
    </Card>
  );
};
