import { Money, HumanDate } from '@/components/payments-admin/payment-money';
import { ChannelLabel } from '@/components/payments-admin/channel-label';
import {
  PAYMENT_CHANNELS,
  REFERENCE_CHANNEL_SEPARATOR,
} from '@kambriq/common/payments/payment-channels';
import type { MyPayment } from '@/types/payments';

/** The field names the API returns, in the words a client reads. */
const FIELD_LABELS: Record<string, string> = {
  bankName: 'Banque',
  bankAccountName: 'Titulaire du compte',
  bankIban: 'Numéro de compte / IBAN',
  bankSwift: 'Code SWIFT / BIC',
  orangeMoneyNumber: 'Numéro Orange Money',
  orangeMoneyName: 'Nom du compte',
  mtnMoneyNumber: 'Numéro MTN Mobile Money',
  mtnMoneyName: 'Nom du compte',
  notaryName: 'Notaire',
  notaryPhone: 'Téléphone',
  notaryAddress: 'Adresse',
  supportEmail: 'Notre email',
  supportPhone: 'Notre téléphone',
};

/**
 * G14 - where the coordinates actually live.
 *
 * v03 4d: *"Les coordonnees s'affichent sur l'espace du client, derriere son
 * authentification ; l'email n'est qu'une notification."* Three reasons, in the
 * design's order: the whole exchange sits where the payment is; bank details do
 * not lie around in a forwardable mailbox; and on the day of a dispute what was
 * communicated is established by the system rather than by a screenshot.
 *
 * Before the back office has answered, the page says **why** it is still
 * waiting. A client who asked to pay and sees an empty box cannot tell whether
 * the request arrived.
 */
export const MyPaymentContent = ({ payment }: { payment: MyPayment }) => {
  const coordinates = payment.coordinates ?? {};

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-mono text-2xl font-bold text-gray-900">{payment.reference ?? '—'}</h1>
        <p className="text-sm text-gray-500">{payment.subject}</p>
      </header>

      <div className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">Montant à régler</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountDue} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Déjà reçu</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountReceived} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">À régler avant le</p>
          <p className="text-lg font-semibold">
            <HumanDate at={payment.expiresAt} />
          </p>
        </div>
      </div>

      {/* The wish, shown whether or not it was followed - so the client can see
          their request was heard, and can see plainly when we answered with
          something else. */}
      <p className="text-sm text-gray-600">
        Vous avez indiqué préférer :{' '}
        <span className="font-semibold">
          <ChannelLabel channel={payment.preferredChannel} withCode />
        </span>
      </p>

      {payment.channel && payment.coordinates ? (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">
            Comment régler — <ChannelLabel channel={payment.channel} withCode />
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Indiquez la référence{' '}
            <span className="font-mono font-semibold">
              {payment.reference}
              {REFERENCE_CHANNEL_SEPARATOR}
              {payment.channel}
            </span>{' '}
            en motif de votre paiement. Un versement sans cette référence ne peut pas être rattaché
            à votre dossier.
          </p>
          {payment.preferredChannel && payment.preferredChannel !== payment.channel && (
            <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-900">
              Nous avons retenu {PAYMENT_CHANNELS[payment.channel]?.label} plutôt que votre souhait.
              Si cela ne vous convient pas, écrivez-nous : nous pouvons en convenir autrement.
            </p>
          )}

          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y" data-testid="coordinates">
              {Object.entries(coordinates).map(([field, value]) => (
                <tr key={field}>
                  <td className="py-2 pr-4 text-gray-500">{FIELD_LABELS[field] ?? field}</td>
                  <td className="py-2 font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 text-xs text-gray-500">
            Communiquées le <HumanDate at={payment.sentAt} />. Conservez votre reçu : il vous sera
            demandé.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4" data-testid="waiting">
          <h2 className="font-semibold text-gray-900">Vos coordonnées de paiement</h2>
          {payment.waitingReason === 'identity' ? (
            <p className="mt-1 text-sm text-gray-600">
              Nous devons d&apos;abord vérifier votre pièce d&apos;identité. Les coordonnées
              bancaires ne se donnent qu&apos;à quelqu&apos;un que nous avons reconnu. Déposez votre
              pièce depuis votre profil si ce n&apos;est pas déjà fait ; nous revenons vers vous dès
              qu&apos;elle est vérifiée.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">
              Votre demande est bien arrivée. Nous préparons les coordonnées du moyen de paiement
              qui vous convient et elles apparaîtront ici. Vous recevrez un email dès qu&apos;elles
              sont disponibles.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
