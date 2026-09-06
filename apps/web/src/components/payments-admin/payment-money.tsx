import {
  formatHumanDate,
  formatHumanDateTime,
  formatMoney,
} from '@kambriq/common/payments/payment-format';

/**
 * The only place this screen turns an amount or a date into text.
 *
 * Both rules come from messages a client actually received in `G3`:
 * **"750 000 FCFA XAF"** - the currency twice, because a formatter that appends
 * its own currency was composed with the payment's - and a deadline shown as
 * **"2026-10-06"**.
 *
 * The web has its own `formatXAF` and `formatDate`; this surface deliberately
 * uses neither. `formatXAF` appends "FCFA" and would reproduce the first defect
 * exactly. `payment-format.spec.ts` fails if `formatXAF`, `Intl.NumberFormat`,
 * `toLocaleString`, `Intl.DateTimeFormat`, `toISOString` or `toLocaleDateString`
 * appears anywhere under `components/payments-admin`.
 *
 * Imported from `@kambriq/common/payments/payment-format` - the file, not the
 * barrel - so the browser bundle does not pull the Nest runtime behind it.
 */
export const Money = ({ amount, currency }: { amount: string; currency: string }) => (
  <span className="tabular-nums">{formatMoney(BigInt(amount), currency)}</span>
);

export const HumanDate = ({ at }: { at: string | null }) => <span>{formatHumanDate(at)}</span>;

export const HumanDateTime = ({ at }: { at: string | null }) => (
  <span>{formatHumanDateTime(at)}</span>
);
