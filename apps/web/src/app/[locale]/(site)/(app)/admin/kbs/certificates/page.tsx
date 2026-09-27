import { adminListCertificates } from '@/lib/actions/kbs';
import { CertificatesListContent } from '@/components/kbs-admin/certificates-list-content';

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminKbsCertificatesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const res = await adminListCertificates({
    page: sp.page ? Number(sp.page) : 1,
    limit: 20,
  });
  const rows = res.success ? res.data.data : [];
  const meta = res.success ? res.data.meta : { total: 0, totalPages: 1, page: 1, limit: 20 };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <CertificatesListContent rows={rows} meta={meta} />
    </div>
  );
}
