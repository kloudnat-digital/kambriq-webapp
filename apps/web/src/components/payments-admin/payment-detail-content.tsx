import { Card, CardContent } from '@/components/ui/card';
import { HumanDate, HumanDateTime, Money } from './payment-money';
import { PaymentStateBadge } from './payment-state-badge';
import { PaymentPurposeLabel } from './payment-purpose-label';
import { AdvancePaymentAction } from './advance-payment-action';
import { SendInstructionsAction } from './send-instructions-action';
import { ChannelLabel } from './channel-label';
import { ProofLink } from './proof-link';
import { RecordReceiptForm } from './record-receipt-form';
import { ValidatePaymentAction } from './validate-payment-action';
import type { PaymentDetail } from '@/types/payments';

// Channel labels are derived exclusively from the API registry.
/**
 * Displays the full details, ledger, proofs, and history of a payment.
 *
 * Financial totals (`amountReceived`, `outstanding`, `amountDue`) are provided directly
 * by the API to prevent inconsistencies and avoid floating point calculation errors on the client.
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
      <div className="flex items-center gap-2">
        <PaymentPurposeLabel purpose={payment.purpose} />
        <PaymentStateBadge state={payment.state} />
      </div>
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

    {/* The preferred channel is always displayed, regardless of payment state. */}
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
                      {/* Displays 'le client' by default if no external payer is specified. */}
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
              {/* Renders the receipt details and associated proof if available. */}
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
