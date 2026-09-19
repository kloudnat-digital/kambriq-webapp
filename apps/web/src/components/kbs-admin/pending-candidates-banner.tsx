import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  total: number;
  oldestWaitingDays: number | null;
}

/**
 * I39 - the backlog, said out loud where an administrator already goes.
 *
 * The act of activation was never missing: `PATCH /kbs/admin/candidates/:id/status`
 * has a full state machine and the candidate detail screen puts it under a
 * button. What was missing was any reason to go and look. A candidate enrolled,
 * sat at CANDIDATE, saw "awaiting validation" on every KBS screen, and nothing
 * anywhere counted them or said how long they had been there.
 *
 * That is A10's identity queue in another module - a reviewer route and a
 * reviewer role that both existed while 59 documents sat unreviewed, because
 * the queue did not exist.
 *
 * **A count answers "how many". The age answers "how long has somebody been
 * waiting", which is the question a backlog exists to answer**, so both are
 * here and the age is the one in bold.
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
