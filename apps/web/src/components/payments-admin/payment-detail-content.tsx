import { Card, CardContent } from '@/components/ui/card';
import { HumanDate, HumanDateTime, Money } from './payment-money';
import { PaymentStateBadge } from './payment-state-badge';
import { AdvancePaymentAction } from './advance-payment-action';
import { SendInstructionsAction } from './send-instructions-action';
import { ChannelLabel } from './channel-label';
import { ProofLink } from './proof-link';
import { RecordReceiptForm } from './record-receipt-form';
import { ValidatePaymentAction } from './validate-payment-action';
import type { PaymentDetail } from '@/types/payments';

// Channel labels come from the registry the API reads, not from a second map
// here. Two lists that must say the same thing end up not saying it.
/**
 * One payment: its ledger, its proofs and its full history.
 *
 * The three totals - dû, reçu, reste - all come from the API, which computes
 * `amountReceived` and `outstanding` from the movement ledger on every read.
 * **Nothing is summed here**, because a monetary amount parsed into a
 * JavaScript number is the `Float` defect G1 removed from the schema, and a
 * total computed in two places is a total that disagrees with itself.
 */
export const PaymentDetailContent = ({
  payment,
  canValidate,
}: {
  payment: PaymentDetail;
  canValidate: boolean;
}) => (
  <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="font-mono text-2xl font-bold text-gray-900">
          {payment.reference ?? '— (antérieur à G2)'}
        </h1>
        <p className="text-sm text-gray-500">
          Créé le <HumanDate at={payment.createdAt} /> — échéance{' '}
          <HumanDate at={payment.expiresAt} />
        </p>
      </div>
      <PaymentStateBadge state={payment.state} />
    </header>

    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">Montant dû</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountDue} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Encaissé</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountReceived} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Reste à percevoir</p>
          <p className="text-lg font-semibold" data-testid="outstanding">
            <Money amount={payment.outstanding} currency={payment.currency} />
          </p>
        </div>
      </CardContent>
    </Card>

    {/* v03 4c: the wish is shown wherever the payment is shown, decided or not. */}
    <Card>
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-gray-500 uppercase">Canal souhaité par le client</p>
          <p className="text-lg font-semibold">
            <ChannelLabel channel={payment.preferredChannel} withCode />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Canal retenu et communiqué</p>
          <p className="text-lg font-semibold">
            <ChannelLabel channel={payment.channel} withCode />
          </p>
        </div>
      </CardContent>
    </Card>

    {payment.state === 'INITIE' && (
      <SendInstructionsAction
        paymentId={payment.id}
        preferredChannel={payment.preferredChannel}
        identityVerified={payment.identityStatus === 'verified'}
        identityStatus={payment.identityStatus}
        clientUserId={payment.clientUserId}
      />
    )}

    <Card>
      <CardContent className="p-0">
        <h2 className="px-4 pt-4 font-semibold text-gray-900">Journal des mouvements</h2>
        <p className="px-4 pb-2 text-xs text-gray-500">
          Le total encaissé est la somme de ces lignes. Une correction ajoute une ligne signée ;
          elle n&apos;en remplace jamais une.
        </p>
        {payment.receipts.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Aucun encaissement enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Reçu le</th>
                  <th className="px-4 py-2">Canal</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2">Justificatif</th>
                  <th className="px-4 py-2">Versé par</th>
                  <th className="px-4 py-2">Saisi par</th>
                </tr>
              </thead>
              <tbody className="divide-y" data-testid="ledger">
                {payment.receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <HumanDate at={r.receivedAt} />
                    </td>
                    <td className="px-4 py-2">
                      <ChannelLabel channel={r.channel} withCode />
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      <Money amount={r.amount} currency={r.currency} />
                      {r.correctsId && (
                        <span className="ml-1 text-xs text-orange-700">(correction)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.evidenceUrl ? (
                        <ProofLink paymentId={payment.id} receiptId={r.id} />
                      ) : (
                        <span className="text-gray-400">aucun (ligne historique)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {/* Named only where it is not the client - a deposit is
                          made at a counter, often by somebody else. */}
                      {r.paidBy ?? <span className="text-gray-400">le client</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    {payment.state !== 'VALIDE' && (
      <RecordReceiptForm
        paymentId={payment.id}
        currency={payment.currency}
        receipts={payment.receipts}
      />
    )}

    {payment.state !== 'VALIDE' && (
      <AdvancePaymentAction
        paymentId={payment.id}
        state={payment.state}
        isGlobalAdmin={canValidate}
        receipts={payment.receipts}
      />
    )}

    {payment.state !== 'VALIDE' && (
      <ValidatePaymentAction
        paymentId={payment.id}
        currency={payment.currency}
        amountReceived={payment.amountReceived}
        outstanding={payment.outstanding}
        canValidate={canValidate}
        receipts={payment.receipts}
      />
    )}

    <Card>
      <CardContent className="p-0">
        <h2 className="px-4 pt-4 font-semibold text-gray-900">Piste d&apos;audit</h2>
        <p className="px-4 pb-2 text-xs text-gray-500">
          Qui, quand, pourquoi, sur quelle preuve. Rien n&apos;est réécrivable après coup.
        </p>
        <ol className="divide-y" data-testid="audit-trail">
          {payment.transitions.map((tr) => (
            <li key={tr.id} className="px-4 py-3 text-sm">
              <p>
                <span className="font-medium">
                  {tr.fromState ? `${tr.fromState} → ${tr.toState}` : `→ ${tr.toState}`}
                </span>{' '}
                <span className="text-gray-500">
                  le <HumanDateTime at={tr.occurredAt} />
                </span>
              </p>
              <p className="text-gray-700">{tr.reason}</p>
              <p className="font-mono text-xs text-gray-500">par {tr.actorUserId}</p>
              {/* G7 - "sur quelle preuve". The receipt is named by what a person
                  can recognise on the ledger above, and its proof opens from
                  here. A step that rests on no receipt says so rather than
                  leaving a blank a reader has to interpret. */}
              <p className="text-xs text-gray-500" data-testid="audit-evidence">
                {tr.evidenceReceiptId ? (
                  (() => {
                    const receipt = payment.receipts.find((r) => r.id === tr.evidenceReceiptId);
                    return (
                      <>
                        sur preuve :{' '}
                        {receipt ? (
                          <>
                            encaissement du <HumanDate at={receipt.receivedAt} /> de{' '}
                            <Money amount={receipt.amount} currency={receipt.currency} />{' '}
                            <span className="font-mono">({receipt.id.slice(0, 8)})</span>
                            {receipt.evidenceUrl && (
                              <>
                                {' — '}
                                <ProofLink paymentId={payment.id} receiptId={receipt.id} />
                              </>
                            )}
                          </>
                        ) : (
                          <span className="font-mono">{tr.evidenceReceiptId}</span>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <span className="text-gray-400">
                    sans preuve rattachée — cette étape ne repose sur aucun encaissement
                  </span>
                )}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  </div>
);
