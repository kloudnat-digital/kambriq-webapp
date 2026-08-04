import { getTranslations } from 'next-intl/server';
import { adminGetCandidates } from '@/lib/actions/kbs';
import { CandidatesListContent } from '@/components/kbs-admin/candidates-list-content';

interface Props {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations('app.adminKbs.candidates');
  return { title: t('title') };
}

export default async function AdminKbsCandidatesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const res = await adminGetCandidates({
    search: sp.search,
    status: sp.status,
    page: sp.page ? Number(sp.page) : 1,
    limit: 20,
  });

  const rows = res.success ? res.data.data : [];
  const meta = res.success ? res.data.meta : { total: 0, totalPages: 1, page: 1, limit: 20 };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <CandidatesListContent rows={rows} meta={meta} />
    </div>
  );
}
