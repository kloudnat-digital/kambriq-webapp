'use client';

import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Money, HumanDate } from './payment-money';
import { PaymentStateBadge } from './payment-state-badge';
import type { PaymentRow } from '@/types/payments';

interface Props {
  rows: PaymentRow[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}

/**
 * The back-office payment list: state, reference, and what is still owed.
 *
 * `outstanding` is computed by the API from the movement ledger on every read.
 * There is no stored balance to display, and there is deliberately no
 * arithmetic here - the amounts arrive as strings and are formatted, never
 * added up in the browser, because a monetary amount parsed into a JavaScript
 * number is the `Float` defect G1 removed from the schema.
 */
export const PaymentsListContent = ({ rows, meta }: Props) => (
  <div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
      <p className="text-sm text-gray-500">
        {meta.total} paiement{meta.total > 1 ? 's' : ''} — le solde restant est calculé sur le
        journal des mouvements
      </p>
    </header>

    <Card>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Aucun paiement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3 text-right">Dû</th>
                  <th className="px-4 py-3 text-right">Reçu</th>
                  <th className="px-4 py-3 text-right">Reste</th>
                  <th className="px-4 py-3">Échéance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {p.reference ?? '— (antérieur à G2)'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStateBadge state={p.state} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money amount={p.amountDue} currency={p.currency} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money amount={p.amountReceived} currency={p.currency} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <Money amount={p.outstanding} currency={p.currency} />
                    </td>
                    <td className="px-4 py-3">
                      <HumanDate at={p.expiresAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
