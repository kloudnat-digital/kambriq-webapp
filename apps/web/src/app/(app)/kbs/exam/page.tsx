import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getExamEligibility, getExamHistory, getMyCandidate } from '@/lib/actions/kbs';
import { KbsExamContent } from '@/components/kbs/kbs-exam-content';
import { KbsAwaitingVerification } from '@/components/kbs/kbs-awaiting-verification';

export async function generateMetadata() {
  const t = await getTranslations('app.kbs.exam');
  return { title: t('pageTitle') };
}

export default async function KbsExamPage() {
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

  const [eligibility, history] = await Promise.all([getExamEligibility(), getExamHistory()]);

  if (!eligibility.success) redirect('/kbs');

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <KbsExamContent
        eligibility={eligibility.data}
        history={history.success ? history.data.history : []}
      />
    </div>
  );
}
