import { getTranslations } from 'next-intl/server';
import { adminGetCandidates, adminGetPendingCandidates } from '@/lib/actions/kbs';
import { CandidatesListContent } from '@/components/kbs-admin/candidates-list-content';
import { PendingCandidatesBanner } from '@/components/kbs-admin/pending-candidates-banner';

interface Props {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations('app.adminKbs.candidates');
  return { title: t('title') };
}

export default async function AdminKbsCandidatesPage({ searchParams }: Props) {
  const sp = await searchParams;

  /**
   * I39 - the backlog is read alongside the list, not instead of it.
   *
   * This is the screen an administrator already lands on: `/admin/kbs` is a
   * bare redirect here. Putting the count and the age at the top is what turns
   * an activation control that already existed into one somebody knows to use.
   */
  const [res, pending] = await Promise.all([
    adminGetCandidates({
      search: sp.search,
      status: sp.status,
      page: sp.page ? Number(sp.page) : 1,
      limit: 20,
    }),
    adminGetPendingCandidates(1, 20),
  ]);

  const rows = res.success ? res.data.data : [];
  const meta = res.success ? res.data.meta : { total: 0, totalPages: 1, page: 1, limit: 20 };
  const pendingTotal = pending.success ? pending.data.meta.total : 0;
  const oldestWaitingDays = pending.success ? (pending.data.meta.oldestWaitingDays ?? null) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6 lg:p-8">
      <PendingCandidatesBanner total={pendingTotal} oldestWaitingDays={oldestWaitingDays} />
      <CandidatesListContent rows={rows} meta={meta} />
    </div>
  );
}
