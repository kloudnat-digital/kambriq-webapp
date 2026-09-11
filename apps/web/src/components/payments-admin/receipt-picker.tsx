'use client';

import { formatHumanDate, formatMoney } from '@kambriq/common/payments/payment-format';
import type { PaymentReceipt } from '@/types/payments';

/**
 * One ledger line, as an option a person can recognise.
 *
 * Date, channel code, signed amount, and whether it is itself a correction.
 * The id is what gets sent; the person reads the rest. Formatted through
 * `payment-format` like every other amount on this surface - a select option
 * cannot hold a component, so the strings are built here from the same
 * functions `Money` and `HumanDate` use.
 */
export const describeReceipt = (r: PaymentReceipt): string =>
  `${formatHumanDate(r.receivedAt)} · ${r.channel} · ${formatMoney(BigInt(r.amount), r.currency)}` +
  (r.correctsId ? ' (correction)' : '') +
  ` · ${r.id.slice(0, 8)}`;

/**
 * Picks one line of the ledger.
 *
 * Used twice, for two questions that share a shape: *which line does this
 * correction correct* (G5) and *which encaissement does this decision rest on*
 * (G7). Both answers are a `PaymentReceipt.id`, both are chosen by a person
 * who is looking at the ledger above, and neither may be typed by hand - a
 * pasted id is how a trail ends up pointing at somebody else's receipt.
 *
 * Nothing is preselected. A control that arrives with the latest line already
 * chosen makes accepting it the path of least resistance, which is exactly how
 * "sur quelle preuve" would fill up with the nearest receipt rather than the
 * right one.
 */
export const ReceiptPicker = ({
  receipts,
  value,
  onChange,
  label,
  hint,
  emptyLabel,
  required,
  testId,
}: {
  receipts: PaymentReceipt[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  hint?: string;
  /** The text of the "nothing chosen" option. */
  emptyLabel: string;
  required?: boolean;
  testId?: string;
}) => (
  <label className="block text-sm">
    <span className="mb-1 block text-gray-600">
      {label}
      {required ? ' (obligatoire)' : ''}
    </span>
    <select
      className="w-full rounded border px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    >
      <option value="">{emptyLabel}</option>
      {receipts.map((r) => (
        <option key={r.id} value={r.id}>
          {describeReceipt(r)}
        </option>
      ))}
    </select>
    {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
  </label>
);
