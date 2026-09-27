import { Money, HumanDate } from '@/components/payments-admin/payment-money';
import { formatHumanDate } from '@kambriq/common/payments/payment-format';
import { useLocale, useTranslations } from 'next-intl';
import { REFERENCE_CHANNEL_SEPARATOR } from '@kambriq/common/payments/payment-channels';
import type { MyPayment } from '@/types/payments';

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
 *
 * Read by the client, in their language: every string, the channel names and the
 * coordinate labels come from `myPayment` (it was French only, I43's debt list).
 */
export const MyPaymentContent = ({ payment }: { payment: MyPayment }) => {
  const t = useTranslations('myPayment');
  const dateLocale = useLocale() === 'en' ? 'en-GB' : 'fr-FR';
  const coordinates = payment.coordinates ?? {};
  const channel = (code: string | null | undefined) =>
    code ? `${t(`channels.${code}` as 'channels.VIR')} (${code})` : '—';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-mono text-2xl font-bold text-gray-900">{payment.reference ?? '—'}</h1>
        <p className="text-sm text-gray-500">{payment.subject}</p>
      </header>

      <div className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">{t('amountDue')}</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountDue} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">{t('received')}</p>
          <p className="text-lg font-semibold">
            <Money amount={payment.amountReceived} currency={payment.currency} />
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">{t('dueBy')}</p>
          <p className="text-lg font-semibold">
            <HumanDate at={payment.expiresAt} locale={dateLocale} />
          </p>
        </div>
      </div>

      {/* The wish, shown whether or not it was followed - so the client can see
          their request was heard, and can see plainly when we answered with
          something else. */}
      <p className="text-sm text-gray-600">
        {t('preferred')} <span className="font-semibold">{channel(payment.preferredChannel)}</span>
      </p>

      {payment.channel && payment.coordinates ? (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">
            {t('howToPay', { channel: channel(payment.channel) })}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('referenceBefore')}{' '}
            <span className="font-mono font-semibold">
              {payment.reference}
              {REFERENCE_CHANNEL_SEPARATOR}
              {payment.channel}
            </span>{' '}
            {t('referenceAfter')}
          </p>
          {payment.preferredChannel && payment.preferredChannel !== payment.channel && (
            <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-900">
              {t('chosenOther', { channel: t(`channels.${payment.channel}` as 'channels.VIR') })}
            </p>
          )}

          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y" data-testid="coordinates">
              {Object.entries(coordinates).map(([field, value]) => (
                <tr key={field}>
                  <td className="py-2 pr-4 text-gray-500">
                    {t.has(`fields.${field}` as 'fields.bankName')
                      ? t(`fields.${field}` as 'fields.bankName')
                      : field}
                  </td>
                  <td className="py-2 font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 text-xs text-gray-500">
            {t('communicated', {
              date: formatHumanDate(payment.sentAt, dateLocale),
            })}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4" data-testid="waiting">
          <h2 className="font-semibold text-gray-900">{t('waitingTitle')}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {payment.waitingReason === 'identity' ? t('waitingIdentity') : t('waitingPreparing')}
          </p>
        </div>
      )}
    </div>
  );
};
