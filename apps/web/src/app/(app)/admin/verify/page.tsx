import { ShieldCheck, Clock, CheckCircle, XCircle } from 'lucide-react';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { VerifyRequestsTable } from '@/components/dashboard/admin-verify/verify-requests-table';

export default function VerifyAdminPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration — Verify</h1>
          <p className="text-sm text-gray-500">
            Gérez les demandes de vérification de titres fonciers.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="En attente"
            value={4}
            icon={<Clock className="size-4 text-amber-600" />}
            accent="text-amber-600"
          />
          <StatCard
            label="En cours"
            value={3}
            icon={<ShieldCheck className="size-4 text-blue-600" />}
            accent="text-blue-600"
          />
          <StatCard
            label="Terminées (mois)"
            value={18}
            icon={<CheckCircle className="size-4 text-success" />}
            accent="text-success"
          />
          <StatCard
            label="Rejetées (mois)"
            value={2}
            icon={<XCircle className="size-4 text-red-500" />}
            accent="text-red-500"
          />
        </div>
        <VerifyRequestsTable />
      </div>
    </div>
  );
}
