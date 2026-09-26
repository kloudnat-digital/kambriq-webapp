import { adminListExams } from '@/lib/actions/kbs';
import { ExamsListContent } from '@/components/kbs-admin/exams-list-content';

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminKbsExamsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const res = await adminListExams({
    status: sp.status,
    page: sp.page ? Number(sp.page) : 1,
    limit: 20,
  });
  const rows = res.success ? res.data.data : [];
  const meta = res.success ? res.data.meta : { total: 0, totalPages: 1, page: 1, limit: 20 };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <ExamsListContent rows={rows} meta={meta} initialStatus={sp.status ?? ''} />
    </div>
  );
}
