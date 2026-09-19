/**
 * The KCA1 training fee, written once.
 *
 * Two figures, one decision: 249 EUR is the published price and 163 333 FCFA is
 * the same money at the fixed parity. They are not two prices and must never be
 * edited independently - the FCFA figure is DERIVED here, in code, so that
 * changing the euro price cannot leave a stale franc price behind it. Two
 * spellings of one price is the defect family this codebase closed twice in one
 * week: `"750 000 FCFA XAF"` in the payment instruction, and the exam threshold
 * living in both a constant and a column default.
 *
 * ---------------------------------------------------------------------------
 * Why this is its own module rather than a line in `constants/kbs/index.ts`
 * ---------------------------------------------------------------------------
 * That index declares `const enum` and `apps/web` compiles with
 * `isolatedModules`. `lesson-content.ts` was split out for exactly this reason;
 * this follows it, because the marketing page and the candidate's waiting
 * screen both have to read these figures and both live in the web app.
 *
 * ---------------------------------------------------------------------------
 * What these figures do NOT do
 * ---------------------------------------------------------------------------
 * Nothing here creates, records or reconciles a payment. The fee is settled
 * outside the platform today, by Visquis's decision of 19 September, and
 * widening `Payment`'s subject to carry a KBS enrolment is deferred until G8 -
 * the end-to-end proof on deployed dev - has actually been taken. These are
 * display figures and a single source for them, nothing more.
 */

/** The published price, in whole euros. The figure Visquis decided. */
export const KCA1_PRICE_EUR = 249 as const;

/**
 * XAF per EUR, fixed by the CFA franc's parity with the euro.
 *
 * Not a market rate and not a configurable setting: it is a peg, so it belongs
 * in code beside the price rather than in a table somebody has to maintain. If
 * the parity itself ever changes, that is a monetary event and this line is the
 * one place that records it.
 */
export const EUR_TO_XAF_PARITY = 655.957 as const;

/**
 * The same price in francs: 249 x 655.957 = 163 333.293, rounded to 163 333.
 *
 * Rounded DOWN to the whole franc rather than to nearest, deliberately: the
 * published figure must never ask for more than the euro price converts to.
 * **XAF has no minor unit** - one indivisible unit is one franc, not a centime -
 * so there is nothing below this to carry the remainder, and a fraction of a
 * franc is not a thing that can be paid.
 *
 * Computed rather than typed, so the two figures cannot drift apart.
 */
export const KCA1_PRICE_XAF = Math.floor(KCA1_PRICE_EUR * EUR_TO_XAF_PARITY);

/**
 * Formatted for display, in the French convention both locales use for francs.
 *
 * `163 333` with a normal space, not `163,333`: this is the figure a candidate
 * reads and repeats to whoever collects it. Note `Intl` renders French groups
 * with U+202F, a narrow no-break space, which is why the separator is applied
 * here rather than left to a formatter - an assertion typed with an ordinary
 * space fails against U+202F while showing two strings that look identical.
 */
export const KCA1_PRICE_XAF_DISPLAY = String(KCA1_PRICE_XAF).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
