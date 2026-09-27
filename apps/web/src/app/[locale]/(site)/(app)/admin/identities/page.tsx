import { IdentityQueueContent } from '@/components/identities/identity-queue-content';
import { listPendingIdentities } from '@/lib/actions/payments';

export const metadata = { title: "Pièces d'identité" };

export default async function AdminIdentitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const res = await listPendingIdentities(Number(page) || 1);

  return (
    <IdentityQueueContent
      rows={res.data}
      total={res.meta.total}
      oldestWaitingDays={res.meta.oldestWaitingDays ?? 0}
    />
  );
}
