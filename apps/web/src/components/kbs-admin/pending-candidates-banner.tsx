import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  total: number;
  oldestWaitingDays: number | null;
}

/**
 * Renders a banner indicating the number of pending candidates in the queue.
 *
 * Provides visibility into the candidate activation backlog, displaying both
 * the total count and the age of the oldest pending request to prioritize reviews.
 */
export const PendingCandidatesBanner = async ({ total, oldestWaitingDays }: Props) => {
  const t = await getTranslations('app.adminKbs.candidates.pending');

  if (total === 0) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {t('none')}
      </p>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{t('title', { n: total })}</p>
            {oldestWaitingDays !== null && (
              <p className="text-sm text-gray-600">{t('oldest', { days: oldestWaitingDays })}</p>
            )}
          </div>
        </div>
        <Link
          href="/admin/kbs/candidates?status=CANDIDATE"
          className="text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
        >
          {t('cta')}
        </Link>
      </CardContent>
    </Card>
  );
};
