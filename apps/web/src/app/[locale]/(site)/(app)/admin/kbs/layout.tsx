import { AdminKbsSubnav } from '@/components/kbs-admin/admin-kbs-subnav';

/**
 * No role check here, on purpose (I18, decided 15 September).
 *
 * This layout carried a second gate, `['ADMIN_KBS', 'ADMIN_GLOBAL', 'ROOT']`,
 * saying what the proxy's `ROLE_GATES` entry for `/admin/kbs` already says - and
 * it had diverged: it admitted `ROOT`, a role that exists nowhere. One gate, in
 * one place: `routes.ts`, enforced by `proxy.ts` before this renders, and held by
 * `proxy.spec.ts`. The API enforces its own `@Roles` on every admin route.
 */
export default function AdminKbsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <AdminKbsSubnav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
