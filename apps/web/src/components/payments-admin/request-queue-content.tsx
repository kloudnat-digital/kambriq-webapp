import { Link } from '@/i18n/navigation';
import { Money, HumanDate } from './payment-money';
import { ChannelLabel } from './channel-label';
import type { PaymentRequestRow } from '@/types/payments';

/**
 * G12 - every payment still waiting for an answer, oldest first.
 *
 * v03 4d: *"Un client qui a demande a payer et a qui personne n'a repondu est
 * exactement le genre de silence que ce systeme existe pour rendre
 * impossible."*
 *
 * Two facts sit beside each other on every row because together they decide
 * what happens next: how long it has waited, and whether the client's identity
 * is verified. An old request whose client is unverified is waiting on the
 * identity queue, not on the person reading this screen - and the row says so
 * and links there.
 *
 * The client's stated preference is shown here, before anything has been
 * decided, so the operator picking up the telephone already knows what was
 * asked for.
 */
export const RequestQueueContent = ({
  rows,
  total,
  oldestWaitingDays,
}: {
  rows: PaymentRequestRow[];
  total: number;
  oldestWaitingDays: number;
}) => (
  <div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold text-gray-900">Demandes de paiement</h1>
      <p className="text-sm text-gray-500">
        {total} en attente de réponse
        {total > 0 && (
          <>
            {' '}
            — la plus ancienne depuis{' '}
            <span className="font-semibold text-gray-900">{oldestWaitingDays} jour(s)</span>
          </>
        )}
        . Le canal indiqué est le souhait du client ; le choix reste au back-office.
      </p>
    </header>

    {rows.length === 0 ? (
      <p className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        Aucune demande en attente.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">Référence</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Terrain</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2">Canal souhaité</th>
              <th className="px-4 py-2">Identité</th>
              <th className="px-4 py-2">Demandé le</th>
              <th className="px-4 py-2 text-right">Attend</th>
            </tr>
          </thead>
          <tbody className="divide-y" data-testid="request-queue">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono">
                  <Link
                    href={`/admin/payments/${r.id}`}
                    className="text-emerald-700 underline underline-offset-2"
                  >
                    {r.reference ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.clientName ?? '—'}</td>
                <td className="px-4 py-2 text-gray-600">{r.subject ?? '—'}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  <Money amount={r.amountDue} currency={r.currency} />
                </td>
                <td className="px-4 py-2">
                  <ChannelLabel channel={r.preferredChannel} withCode />
                </td>
                <td className="px-4 py-2">
                  {r.blockedByIdentity ? (
                    <Link
                      href={
                        r.clientUserId ? `/admin/identities/${r.clientUserId}` : '/admin/identities'
                      }
                      className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 underline underline-offset-2"
                    >
                      à vérifier ({r.identityStatus})
                    </Link>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      vérifiée
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <HumanDate at={r.requestedAt} />
                </td>
                <td
                  className={`px-4 py-2 text-right font-semibold ${
                    r.waitingDays >= 3 ? 'text-red-700' : 'text-gray-900'
                  }`}
                >
                  {r.waitingDays} j
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
