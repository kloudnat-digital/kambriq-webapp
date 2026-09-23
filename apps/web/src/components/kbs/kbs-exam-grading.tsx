'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Renders a loading state for candidates immediately after exam submission.
 *
 * Exam grading is processed asynchronously via a queue. During this period,
 * the exam remains in a SUBMITTED state without a score.
 *
 * The component periodically triggers a server-side re-render (`router.refresh()`)
 * to poll for the final grade. Once grading completes, the parent page renders
 * the final result component, unmounting this view.
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
