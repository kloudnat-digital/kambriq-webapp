import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMyCandidate, getMyOverview } from '@/lib/actions/kbs';
import { KbsDashboardContent } from '@/components/kbs/kbs-dashboard-content';
import { KbsAwaitingVerification } from '@/components/kbs/kbs-awaiting-verification';

export async function generateMetadata() {
  const t = await getTranslations('app.kbs.dashboard');
  return { title: t('pageTitle') };
}

export default async function KbsDashboardPage() {
  const candidateRes = await getMyCandidate();
  const candidate = candidateRes.success ? candidateRes.data : null;
  if (!candidate) redirect('/kbs/enroll');

  if (candidate.status === 'CANDIDATE') {
    return (
      <div className="mx-auto max-w-2xl p-6 lg:p-8">
        <KbsAwaitingVerification />
      </div>
    );
  }

  const overviewRes = await getMyOverview();
  const overview = overviewRes.success ? overviewRes.data : null;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <KbsDashboardContent overview={overview} candidate={candidate} />
    </div>
  );
}
