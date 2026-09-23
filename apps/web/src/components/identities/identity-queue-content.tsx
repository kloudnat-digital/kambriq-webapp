import Link from 'next/link';
import { HumanDate } from '@/components/payments-admin/payment-money';

type Row = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  documentCount: number;
  submittedAt: string;
  waitingDays: number;
};

/**
 * Renders the queue of pending identity review requests.
 *
 * Unverified clients are blocked from receiving payment coordinates.
 * This queue allows reviewers to process pending identity documents.
 * Requests are ordered by age, with the oldest requests explicitly highlighted.
 */
export const IdentityQueueContent = ({
  rows,
  oldestWaitingDays,
  total,
}: {
  rows: Row[];
  oldestWaitingDays: number;
  total: number;
}) => (
  <div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold text-gray-900">Pièces d&apos;identité à vérifier</h1>
      <p className="text-sm text-gray-500">
        {total} en attente
        {total > 0 && (
          <>
            {' '}
            — la plus ancienne attend depuis{' '}
            <span className="font-semibold text-gray-900">{oldestWaitingDays} jour(s)</span>
          </>
        )}
        . Un paiement ne peut pas partir tant que le client n&apos;est pas vérifié.
      </p>
    </header>

    {rows.length === 0 ? (
      <p className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        Rien en attente. Les demandes de paiement dont le client n&apos;est pas encore vérifié
        restent visibles dans la file des demandes.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 text-right">Pièces</th>
              <th className="px-4 py-2">Déposée le</th>
              <th className="px-4 py-2 text-right">Attend depuis</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y" data-testid="identity-queue">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-4 py-2 font-medium">
                  {r.firstName} {r.lastName}
                </td>
                <td className="px-4 py-2 text-gray-600">{r.email}</td>
                <td className="px-4 py-2 text-right">{r.documentCount}</td>
                <td className="px-4 py-2">
                  <HumanDate at={r.submittedAt} />
                </td>
                <td
                  className={`px-4 py-2 text-right font-semibold ${
                    r.waitingDays >= 7 ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  {r.waitingDays} j
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/identities/${r.userId}`}
                    className="text-emerald-700 underline underline-offset-2"
                  >
                    Examiner
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
