import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminKbsSubnav } from '@/components/kbs-admin/admin-kbs-subnav';

const ADMIN_ROLES = ['ADMIN_KBS', 'ADMIN_GLOBAL', 'ROOT'];

export default async function AdminKbsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const allowed = ADMIN_ROLES.some((r) => roles.includes(r));
  if (!allowed) redirect('/');

  return (
    <div className="flex h-full flex-col">
      <AdminKbsSubnav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
